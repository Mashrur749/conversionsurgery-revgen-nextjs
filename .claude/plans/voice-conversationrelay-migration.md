# Feature Plan: Voice AI — ConversationRelay Migration

> **Created:** 2026-04-04
> **Status:** Complete
> **Slices:** 5

## Overview

Migrate Voice AI from the current Gather/Say/Redirect webhook chain (2-5s dead air per turn, robotic Polly.Matthew TTS, no interruptions) to Twilio ConversationRelay backed by a Cloudflare Durable Object (streaming Claude responses through ElevenLabs TTS, Deepgram STT, ~1s response latency, natural interruption handling).

The Durable Object lives in a standalone Cloudflare Worker package (`packages/voice-agent/`), keeping the voice WebSocket concern separate from the Next.js app. The Next.js app continues to own call routing decisions (TwiML), post-call processing (session-end), and all admin/portal UI.

## Success Criteria

1. Inbound voice call answered with ElevenLabs voice (using existing `voiceVoiceId` from admin picker)
2. Multi-turn conversation with token-streamed Claude responses (~1s to first audio)
3. Caller can interrupt naturally mid-response
4. Claude can check calendar availability and book appointments via tool_use
5. Warm transfer to owner/team via `end` + `handoffData` → action URL → `<Dial>`
6. Missed transfer recovery (SMS + escalation + team alert) unchanged from current behavior
7. Full transcript + AI summary stored in `voiceCalls` after call ends
8. Kill switch, business hours, and voiceMode logic unchanged
9. Existing admin voice-ai page, voice-usage-rollup cron, and billing all work without changes
10. `npm run build` passes at every slice merge; `npm run quality:no-regressions` green at final slice

---

## Slices

### Slice 0: Monorepo + Worker Scaffold
> **Branch:** `feature/voice-cr/slice-0`
> **Dependencies:** None
> **Status:** ⬜ Not Started

**What:** Set up npm workspaces, create the `packages/voice-agent/` Cloudflare Worker with Durable Object binding, wrangler config, and a minimal "echo" WebSocket handler that proves the plumbing works.

**Scope:**
- `package.json` (add `"workspaces": ["packages/*"]` — does NOT affect the root app)
- `packages/voice-agent/package.json`
- `packages/voice-agent/tsconfig.json`
- `packages/voice-agent/wrangler.toml`
- `packages/voice-agent/src/index.ts` (Worker entry — routes WebSocket upgrade to DO)
- `packages/voice-agent/src/voice-session.ts` (Durable Object class — accepts WS, echoes `setup`/`prompt` events back as `text` messages)

**Contract:**
- Produces: A deployable Cloudflare Worker at `voice-agent.<account>.workers.dev` that accepts a WebSocket connection and echoes received messages
- Consumes: nothing from the Next.js app
- Does NOT modify any existing files (except root `package.json` workspaces field)

**Done when:**
- [ ] `cd packages/voice-agent && npm run typecheck` passes
- [ ] `npx wrangler dev` starts locally and accepts WebSocket connections
- [ ] Root `npm run build` still passes (Next.js app unaffected)
- [ ] Durable Object binding declared in `wrangler.toml`

---

### Slice 1: Voice Session — Claude Streaming + Interruptions
> **Branch:** `feature/voice-cr/slice-1`
> **Dependencies:** Slice 0
> **Status:** ⬜ Not Started

**What:** Replace the echo handler with the real voice conversation engine: system prompt construction from custom parameters, Claude token streaming over the WebSocket, and interruption handling.

**Scope:**
- `packages/voice-agent/src/voice-session.ts` (replace echo with real handler)
- `packages/voice-agent/src/prompts.ts` (system prompt builder — voice-specific version of guardrails)
- `packages/voice-agent/src/db.ts` (Neon HTTP client for loading client/KB/agent-settings on `setup`)
- `packages/voice-agent/src/types.ts` (shared types: WebSocket messages, session state, tool schemas)

**Contract:**
- Produces: A Durable Object that on `setup` loads client + KB + agent settings from Neon, on `prompt` streams Claude response tokens to the WebSocket, on `interrupt` truncates conversation history
- Consumes: Neon connection string (env var), Anthropic API key (env var), `clientId` + `leadId` from `setup.customParameters`
- Does NOT call any Next.js routes; reads DB directly via Neon HTTP driver

**Key implementation details:**
- `setup` event: extract `clientId`, `leadId`, `callSid` from `customParameters`. Query Neon for: client (businessName, voiceGreeting, phone, voiceMode), knowledgeBase entries (clientId), clientAgentSettings (agentTone, canDiscussPricing). Build system prompt from `prompts.ts` (adapted from `buildGuardrailPrompt` but voiced — "under 50 words", "conversational", "one question at a time"). Store in session state.
- `prompt` event: append `{ role: "user", content: voicePrompt }` to conversation history. Call `anthropic.messages.create({ stream: true, tools })`. For each `content_block_delta` with `text_delta`, send `{ type: "text", token, last: false }`. After stream ends, send `{ type: "text", token: "", last: true }`. Append full response to conversation history.
- `interrupt` event: find last assistant message containing `utteranceUntilInterrupt`, truncate to that point, remove subsequent assistant messages.
- Conversation history lives in-memory on the DO instance (garbage-collected when WS closes).

**Done when:**
- [ ] `cd packages/voice-agent && npm run typecheck` passes
- [ ] Manual test: connect WebSocket, send `setup` with real `clientId`, send `prompt`, receive streamed tokens
- [ ] Interruption truncation unit-tested (pure function, no IO)
- [ ] System prompt includes all guardrail rules from existing `buildGuardrailPrompt` adapted for voice

---

### Slice 2: Claude Tool Use — Booking, Transfer, Callback
> **Branch:** `feature/voice-cr/slice-2`
> **Dependencies:** Slice 1
> **Status:** ⬜ Not Started

**What:** Add Claude tool_use support to the voice session. Define tools for appointment booking, human transfer, callback scheduling, and project detail capture. Execute tools during the streaming loop.

**Scope:**
- `packages/voice-agent/src/tools.ts` (tool definitions + execution handlers)
- `packages/voice-agent/src/voice-session.ts` (add tool handling to streaming loop)

**Tools:**

| Tool | Input | Execution | Output to Claude |
|------|-------|-----------|-----------------|
| `check_availability` | `{ date: string, service_type?: string }` | Query Neon: `appointments` + `calendar_events` for date range, compute available 1-hour slots | `{ available_slots: ["9:00 AM", "2:00 PM", ...] }` |
| `book_appointment` | `{ date, time, caller_name, project_type, notes? }` | Insert into `appointments` + `calendar_events` (sync pending). Update lead `name`, `projectType` if captured. | `{ confirmed: true, date, time }` |
| `transfer_to_human` | `{ reason: string }` | Send `{ type: "end", handoffData: JSON.stringify({ reasonCode: "live-agent-handoff", reason, callSummary, transferTo: client.phone }) }` | N/A (session ends) |
| `schedule_callback` | `{ preferred_time?, caller_name? }` | Update `voiceCalls.callbackRequested = true`, `callbackTime`. Update lead name if captured. Send `{ type: "end", handoffData: { reasonCode: "callback-scheduled", ... } }` | N/A (session ends after confirmation) |
| `capture_project_details` | `{ name?, project_type?, estimated_value?, address?, notes? }` | Update lead record in Neon with captured fields | `{ captured: true }` (conversation continues) |

**Streaming with tool_use:**
- During streaming, detect `content_block_start` with `type: "tool_use"` + accumulate `input_json_delta`
- On `message_stop`, if tool_use blocks present: execute tool, append `tool_use` + `tool_result` to conversation, make follow-up Claude call (streaming) to generate the spoken response
- While tool executes, optionally send a filler token: `{ type: "text", token: "Let me check on that for you...", last: true }` (non-interruptible)

**Contract:**
- Produces: Tool-equipped voice session that can book appointments, initiate transfers, and capture lead data
- Consumes: Neon for DB reads/writes, session state from Slice 1

**Done when:**
- [ ] `cd packages/voice-agent && npm run typecheck` passes
- [ ] `transfer_to_human` sends correct `end` message with handoffData
- [ ] `check_availability` queries calendar correctly
- [ ] `book_appointment` creates appointment + calendar event
- [ ] `capture_project_details` updates lead record
- [ ] Tool execution doesn't break the streaming loop

---

### Slice 3: Next.js TwiML + Session-End Routes
> **Branch:** `feature/voice-cr/slice-3`
> **Dependencies:** Slices 0-2 (Worker must be deployable)
> **Status:** ⬜ Not Started

**What:** Modify the existing `/api/webhooks/twilio/voice/ai` route to return ConversationRelay TwiML (instead of Gather/Say). Create the new `/api/webhooks/twilio/voice/ai/session-end` route that handles post-call actions (transfer, summary, notifications, DB updates).

**Scope:**
- `src/app/api/webhooks/twilio/voice/ai/route.ts` (modify: replace Gather/Say TwiML with `<Connect><ConversationRelay>` TwiML)
- `src/app/api/webhooks/twilio/voice/ai/session-end/route.ts` (new: action URL handler)
- `src/lib/env.ts` or similar (add `VOICE_WS_URL` env var — the Worker's WebSocket URL)

**Changes to `/voice/ai/route.ts`:**
- Everything before the TwiML generation stays the same (client lookup, kill switch, business hours, voiceMode check, lead lookup/create, voiceCalls insert)
- Replace the Gather/Say TwiML block with:
  ```xml
  <Connect action="{appUrl}/api/webhooks/twilio/voice/ai/session-end">
    <ConversationRelay
      url="{VOICE_WS_URL}"
      welcomeGreeting="{greeting}"
      ttsProvider="ElevenLabs"
      voice="{voiceVoiceId}-flash_v2_5-1.0_0.7_0.8"
      transcriptionProvider="Deepgram"
      interruptSensitivity="medium"
      dtmfDetection="true"
      elevenlabsTextNormalization="on"
      hints="{businessName}">
      <Parameter name="clientId" value="{clientId}" />
      <Parameter name="leadId" value="{leadId}" />
      <Parameter name="callSid" value="{callSid}" />
    </ConversationRelay>
  </Connect>
  ```
- Fallback: if `voiceVoiceId` is null, use `ttsProvider="Amazon" voice="Matthew-Neural"`
- During-hours direct dial (non-AI path) is unchanged — still uses `<Dial>` with dial-complete action

**New `/voice/ai/session-end/route.ts`:**
- Parse `HandoffData` from POST body (JSON-stringified by the DO)
- Parse `SessionStatus`, `SessionDuration`, `CallSid`
- Update `voiceCalls` record: `status`, `duration` (from `SessionDuration`), `endedAt`, `transcript` (from handoffData), `callerIntent`, `outcome`
- If `reasonCode === "live-agent-handoff"`: return `<Dial>` TwiML to transfer to the phone number in `handoffData.transferTo` (with dial-complete action for missed-transfer recovery — reuse existing logic)
- If `reasonCode === "callback-scheduled"`: return `<Say>` goodbye + `<Hangup>`. Fire post-call: generate summary, notify contractor.
- If `reasonCode === "call-ended"` or no handoff: return `<Hangup>`. Fire post-call: generate summary, notify contractor (reuse `generateCallSummary` + `notifyClientOfCall` from `voice-summary.ts`).

**Contract:**
- Produces: ConversationRelay-powered voice AI entry point + session-end handler with full post-call processing
- Consumes: Worker WebSocket URL (env var), existing services (voice-summary, compliance-gateway, escalation, agency-communication)

**Done when:**
- [ ] `npm run build` passes
- [ ] TwiML output is valid XML with correct ConversationRelay attributes
- [ ] Session-end handles all three paths: transfer, callback, normal hangup
- [ ] Missed-transfer recovery (SMS + escalation + team alert) preserved from current dial-complete logic
- [ ] Post-call summary + contractor notification fires on every call end
- [ ] `npm run quality:no-regressions` passes

---

### Slice 4: Cleanup + Env + Docs
> **Branch:** `feature/voice-cr/slice-4`
> **Dependencies:** Slice 3
> **Status:** ⬜ Not Started

**What:** Remove the obsolete webhook chain (gather, process, transfer — their logic now lives in the DO + session-end), add environment variables, update documentation, and verify the full flow end-to-end.

**Scope:**
- `src/app/api/webhooks/twilio/voice/ai/gather/route.ts` (delete)
- `src/app/api/webhooks/twilio/voice/ai/process/route.ts` (delete)
- `src/app/api/webhooks/twilio/voice/ai/transfer/route.ts` (delete)
- `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts` (keep — still used for during-hours direct dial and missed-transfer-from-session-end)
- `docs/product/PLATFORM-CAPABILITIES.md` (update Voice AI section — mention ConversationRelay, ElevenLabs, streaming, interruptions)
- `docs/engineering/01-TESTING-GUIDE.md` (update voice AI test steps)
- `DEPLOYMENT.md` (add Worker deployment instructions)
- `cloudflare-env.d.ts` (add `VOICE_WS_URL` env var type)
- `.dev.vars` or equivalent (document required env vars: `VOICE_WS_URL`, and for the Worker: `ANTHROPIC_API_KEY`, `DATABASE_URL`)

**Contract:**
- Produces: Clean codebase with no dead webhook routes, updated docs, deployment guide for the Worker
- Consumes: All previous slices merged

**Done when:**
- [ ] Deleted routes no longer in the build output
- [ ] `npm run build` passes
- [ ] `npm run quality:no-regressions` passes
- [ ] PLATFORM-CAPABILITIES.md Voice AI section reflects new architecture
- [ ] TESTING-GUIDE.md has updated voice test steps
- [ ] DEPLOYMENT.md includes Worker deployment steps
- [ ] No references to deleted routes remain in codebase (grep for `/voice/ai/gather`, `/voice/ai/process`, `/voice/ai/transfer` returns 0)

---

## Merge Order

```
Slice 0 (monorepo + Worker scaffold)
  → Slice 1 (Claude streaming + interruptions)
    → Slice 2 (tool use — booking, transfer, callback)
      → Slice 3 (Next.js TwiML + session-end routes)
        → Slice 4 (cleanup + env + docs)
```

Slices 0-2 are Worker-only — they never touch the Next.js app, so they can't break the build.
Slice 3 is the switchover — modifies the TwiML route to point at ConversationRelay.
Slice 4 is cleanup — removes dead code after the switchover is verified.

## Risks

1. **Cloudflare Workers + Anthropic SDK streaming:** The Anthropic SDK uses `fetch` internally which is supported in Workers, but streaming via `for await` over the response needs testing in the Durable Object runtime. Mitigation: test in Slice 1 with `npx wrangler dev`.

2. **Neon HTTP driver in Workers:** The `@neondatabase/serverless` HTTP driver (not WebSocket) should work in Cloudflare Workers since it's just fetch. Mitigation: verify in Slice 1 during setup event testing.

3. **WebSocket URL stability:** The Worker URL must be stable and accessible from Twilio. In production, this means a custom domain or Cloudflare Workers route. Mitigation: use a `voice-ws.yourdomain.com` CNAME pointing to the Worker in production.

4. **Feature flag / rollback:** There's no gradual rollout mechanism in this plan — Slice 3 switches all voice AI calls to ConversationRelay at once. Mitigation: the existing kill switch (`ops.kill_switch.voice_ai`) still works and bypasses all AI (both old and new) to direct forwarding. For a more granular rollback, add a `useConversationRelay` boolean to the client config (default true) that falls back to the old Gather/Say path if false. Consider adding this in Slice 3 if needed.

5. **Cost increase:** ConversationRelay adds $0.07/min. Current pass-through to clients is $0.15/min. New margin per minute drops from ~$0.12 to ~$0.067. Still healthy, but monitor usage.
