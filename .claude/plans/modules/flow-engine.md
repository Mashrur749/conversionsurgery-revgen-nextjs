# Module: flow-engine
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Automated flow engine — manages flow templates (multi-step automation sequences), executes flows against leads, tracks step completion, suggests flows based on conversation signals, and provides flow admin UI.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/flow-enums.ts` | Flow-related enum types |
| `src/db/schema/flow-templates.ts` | `flowTemplates`, `flowTemplateSteps`, `flowTemplateVersions` tables |
| `src/db/schema/flows.ts` | `flows`, `flowSteps` tables — active flow instances |
| `src/db/schema/flow-executions.ts` | `flowExecutions`, `flowStepExecutions`, `suggestedActions` tables |
| `src/db/schema/client-flow-outcomes.ts` | `clientFlowOutcomes` table — outcome tracking |
| `src/lib/services/flow-templates.ts` | Template CRUD and versioning service |
| `src/lib/services/flow-execution.ts` | Flow execution engine |
| `src/lib/services/flow-metrics.ts` | Flow performance metrics |
| `src/lib/services/flow-resolution.ts` | Flow resolution and outcome tracking |
| `src/lib/services/flow-suggestions.ts` | Signal-based flow suggestion service |
| `src/lib/services/signal-detection.ts` | Conversation signal detection |
| `src/app/api/admin/flow-templates/route.ts` | GET/POST — list and create templates |
| `src/app/api/admin/flow-templates/[id]/route.ts` | GET/PATCH — view and update template |
| `src/app/api/admin/flow-templates/[id]/publish/route.ts` | POST — publish template version |
| `src/app/api/admin/flow-templates/[id]/push/route.ts` | POST — push template update to clients |
| `src/app/api/clients/[id]/outcomes/route.ts` | POST — record flow outcome |
| `src/app/(dashboard)/admin/flow-templates/page.tsx` | Flow templates list page |
| `src/app/(dashboard)/admin/flow-templates/[id]/page.tsx` | Template detail/editor page |
| `src/app/(dashboard)/admin/flow-templates/[id]/push/page.tsx` | Template push update page |
| `src/components/flows/template-list.tsx` | Template list component |
| `src/components/flows/template-editor.tsx` | Template editor component |
| `src/components/flows/push-update-view.tsx` | Push update view component |
| `src/components/flows/sequence-view.tsx` | Sequence visualization component |
| `src/components/dashboard/client-outcomes.tsx` | Client outcomes dashboard widget |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/flow-suggestions.ts
export async function checkAndSuggestFlows(
  clientId: string,
  leadId: string,
  conversationId: string
): Promise<SuggestedFlow[]>

export async function handleApprovalResponse(
  clientId: string,
  leadId: string,
  approved: boolean
): Promise<void>

// From src/lib/services/flow-execution.ts
export async function startFlowExecution(
  flowId: string,
  leadId: string
): Promise<{ executionId: string }>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `conversations` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `sendSMS` from `@/lib/services/twilio`
- `generateAIResponse` from `@/lib/services/openai`
- `renderTemplate` from `@/lib/utils/templates`
- `trackUsage` from `@/lib/services/usage-tracking`

## REFACTORING GOALS

1. **Type safety** — Define `FlowTemplate`, `FlowStep`, `FlowExecution`, `SuggestedFlow` interfaces
2. **Execution engine** — Type the step execution state machine (pending → running → completed/failed/skipped)
3. **Signal detection** — Type signal types and detection results
4. **Template versioning** — Clean up version management logic
5. **Metrics service** — Type flow performance metrics and aggregation
6. **API consistency** — Zod validation, admin auth, consistent responses
7. **Component types** — Type all flow component props

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Flow lifecycle states fully typed
- [ ] Signal detection typed
- [ ] All admin routes check `isAdmin`
- [ ] All routes use Zod validation
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(flow-engine): ...` format
- [ ] `.refactor-complete` sentinel created
