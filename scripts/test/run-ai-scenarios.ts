#!/usr/bin/env npx tsx
/**
 * Visual AI Scenario Runner
 *
 * Runs all multi-turn conversation scenarios against the real AI and produces:
 * 1. Color-coded terminal output showing each conversation as it happens
 * 2. An HTML report at .scratch/ai-scenario-report.html
 *
 * Usage:
 *   npx tsx scripts/test/run-ai-scenarios.ts
 *
 * Requires: ANTHROPIC_API_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssertionResult {
  description: string;
  passed: boolean;
  error?: string;
}

interface TurnResult {
  customerMessage: string;
  aiResponse: string;
  assertions: AssertionResult[];
  durationMs: number;
}

interface ScenarioResult {
  name: string;
  description: string;
  turns: TurnResult[];
  finalAssertions: AssertionResult[];
  passed: boolean;
  totalDurationMs: number;
}

interface CheckFn {
  (response: string, history: Array<{ role: 'user' | 'assistant'; content: string }>): void;
}

interface TurnDef {
  customer: string;
  checks: Array<{ description: string; assert: CheckFn }>;
}

interface ScenarioDef {
  name: string;
  description: string;
  systemPrompt: string;
  turns: TurnDef[];
  finalChecks?: Array<{
    description: string;
    assert: (history: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  }>;
}

// ---------------------------------------------------------------------------
// Terminal colors
// ---------------------------------------------------------------------------

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

// ---------------------------------------------------------------------------
// AI Client
// ---------------------------------------------------------------------------

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function chat(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.3,
  });
  const block = response.content.find(b => b.type === 'text');
  return block && 'text' in block ? block.text : '';
}

// ---------------------------------------------------------------------------
// Guardrail prompt builder (copied from source to avoid import issues)
// ---------------------------------------------------------------------------

function buildGuardrailPrompt(config: {
  ownerName: string;
  businessName: string;
  agentTone: 'professional' | 'friendly' | 'casual';
  canDiscussPricing: boolean;
  messagesWithoutResponse: number;
}): string {
  const { ownerName, businessName, agentTone, canDiscussPricing, messagesWithoutResponse } = config;
  const harassmentWarning = messagesWithoutResponse >= 2
    ? `\n\nIMPORTANT: You have sent ${messagesWithoutResponse} messages without a reply. DO NOT send another unprompted message. Only respond if the customer messages you first.`
    : '';
  const pricingRule = canDiscussPricing
    ? 'If asked about pricing, share only the ranges provided in the business knowledge above. Never quote exact prices — always say "typically" or "starting from".'
    : `If asked about pricing, say: "I'd want ${ownerName} to give you an accurate quote. Let me set that up for you."`;

  return `## ABSOLUTE RULES — NEVER BREAK THESE
1. KNOWLEDGE BOUNDARIES: If the business knowledge above does not contain the answer, DO NOT guess or make things up. Instead say: "Let me have ${ownerName} get back to you on that — I want to make sure you get accurate info."
2. NO PROMISES: Never promise specific pricing, exact timelines, guarantees, or outcomes the business hasn't authorized.
3. NO PROFESSIONAL ADVICE: Never provide medical, legal, financial, or safety advice. Refer to qualified professionals.
4. HONESTY: If asked whether you're a real person or AI, be honest: "I'm an AI assistant helping ${businessName} respond quickly — ${ownerName} oversees everything."
5. PRIVACY: Never reference other customers' information, jobs, or details.
6. NO PRESSURE: Never use urgency/scarcity tactics ("limited time", "book now before spots fill up", "prices going up").
7. NO REAL-WORLD CLAIMS: Never reference weather, current events, market conditions, sports, news, or any external facts you cannot verify.
8. OPT-OUT RESPECT: If the customer says "leave me alone", "stop texting", "not interested" — treat it exactly like STOP.
9. ${pricingRule}
10. STAY IN LANE: You represent ${businessName} only. Do not comment on competitors.${harassmentWarning}

## TONE RULES (${agentTone})
${agentTone === 'professional' ? '- Be courteous and direct. Use proper grammar but avoid being stiff or corporate.' : ''}${agentTone === 'friendly' ? '- Be warm and conversational. Use casual language but stay respectful.' : ''}${agentTone === 'casual' ? '- Be relaxed and natural, like texting a friend.' : ''}
- If frustrated, acknowledge feelings first.
- Ask only ONE question at a time.
- Keep responses concise (1-3 sentences).

## CONFIDENCE LEVELS
- Known from KB → respond confidently.
- Partial match → soften: "Typically...", "Usually..."
- No relevant knowledge → defer to ${ownerName}. Never guess.`;
}

function buildPrompt(overrides: {
  businessName?: string;
  ownerName?: string;
  agentTone?: 'professional' | 'friendly' | 'casual';
  canDiscussPricing?: boolean;
  knowledgeContext?: string;
  sentiment?: string;
  strategy?: string;
} = {}): string {
  const {
    businessName = "Mike's Plumbing",
    ownerName = 'Mike',
    agentTone = 'professional',
    canDiscussPricing = true,
    knowledgeContext = `Services offered:
- Drain cleaning: $150-300, takes 1-2 hours
- Water heater install: $800-2000, takes 4-6 hours
- Pipe repair: $200-500, depends on scope
- Sewer line inspection: $200-400, camera inspection included

Business hours: Mon-Fri 8am-5pm, emergency service available weekends.
Service area: Greater Portland metro.
Licensed, bonded, insured. 15 years in business.
We offer free estimates for larger jobs.`,
    sentiment = 'neutral',
    strategy = 'Answer their question helpfully and guide toward booking.',
  } = overrides;

  const guardrails = buildGuardrailPrompt({
    ownerName, businessName, agentTone, canDiscussPricing, messagesWithoutResponse: 0,
  });

  return `You are Alex, a ${agentTone} assistant for ${businessName}. ${ownerName} manages the business.

## BUSINESS KNOWLEDGE
${knowledgeContext}

## CURRENT CONTEXT
- Customer Stage: qualifying
- Customer Sentiment: ${sentiment}
- Their Project: Not yet specified
- Objections to Address: None

${guardrails}

## YOUR TASK
Goal: book an appointment
Max response length: 300 characters
Strategy: ${strategy}

Generate the response message. DO NOT include any prefix like "Agent:" — just write the message text.`;
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function mentions(...patterns: Array<string | RegExp>): CheckFn {
  return (response: string) => {
    const lower = response.toLowerCase();
    const matched = patterns.some(p =>
      typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(lower)
    );
    if (!matched) throw new Error(`Expected to mention: ${patterns.map(String).join(' | ')}`);
  };
}

function doesNotMention(...patterns: Array<string | RegExp>): CheckFn {
  return (response: string) => {
    const lower = response.toLowerCase();
    for (const p of patterns) {
      const found = typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(lower);
      if (found) throw new Error(`Should NOT mention: ${String(p)}`);
    }
  };
}

function maxLength(limit: number): CheckFn {
  return (response: string) => {
    if (response.length > limit) throw new Error(`Too long: ${response.length} > ${limit}`);
  };
}

function noRepetition(): CheckFn {
  return (response: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const prev = history.filter(h => h.role === 'assistant').slice(0, -1).map(h => h.content.toLowerCase());
    const words = response.toLowerCase().split(/\s+/);
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (phrase.length < 20) continue;
      for (const p of prev) {
        if (p.includes(phrase)) throw new Error(`Repeated phrase: "${phrase}"`);
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

const scenarios: ScenarioDef[] = [
  {
    name: 'Smooth Booking',
    description: 'Happy path: inquiry → qualify → pricing → schedule appointment',
    systemPrompt: buildPrompt(),
    turns: [
      {
        customer: 'Hey, my kitchen drain is really slow. Is that something you can help with?',
        checks: [
          { description: 'Acknowledges drain issue', assert: mentions('drain', /clog|slow|block/) },
          { description: 'Asks qualifying question or offers help', assert: mentions(/help|look|take a look|more|tell me/) },
          { description: 'Under length limit', assert: maxLength(400) },
        ],
      },
      {
        customer: "Yeah it's been slow for about a week. Water barely goes down now.",
        checks: [
          { description: 'Acknowledges the detail', assert: mentions(/week|worse|getting|sounds/) },
          { description: 'Moves toward booking', assert: mentions(/schedul|appointment|come out|take a look|availab|free estimate/) },
        ],
      },
      {
        customer: 'Sure, what does something like that usually cost?',
        checks: [
          { description: 'Shares price range', assert: mentions(/\$?1[0-9]{2}|150|300|range|typically/) },
          { description: 'No exact fixed price', assert: doesNotMention(/exactly \$|will cost \$\d+ flat/) },
        ],
      },
      {
        customer: "That's reasonable. I'm free Thursday afternoon, does that work?",
        checks: [
          { description: 'Engages with availability', assert: mentions(/thursday|afternoon|great|perfect|sounds good/) },
          { description: 'Confirms booking progress', assert: mentions(/book|schedul|set|confirm|appointment|pencil/) },
          { description: 'No repetition', assert: noRepetition() },
        ],
      },
    ],
    finalChecks: [
      {
        description: 'All responses are unique (no stuck loops)',
        assert: (history) => {
          const ai = history.filter(h => h.role === 'assistant');
          const unique = new Set(ai.map(r => r.content));
          if (unique.size !== ai.length) throw new Error('Duplicate responses detected');
        },
      },
    ],
  },
  {
    name: 'Price Objection → Recovery',
    description: 'Lead balks at cost, AI addresses value without pressure, lead re-engages',
    systemPrompt: buildPrompt({ strategy: 'Address pricing concern with value, not pressure.' }),
    turns: [
      {
        customer: 'I need my water heater replaced. How much does that run?',
        checks: [
          { description: 'Shares price range', assert: mentions(/\$?[0-9]{3,4}|800|2000|range|depends/) },
        ],
      },
      {
        customer: "Wow that's way more than I expected. A buddy of mine said he got his done for $400.",
        checks: [
          { description: 'Acknowledges concern', assert: mentions(/understand|hear you|know|cost|price|budget/) },
          { description: 'Addresses value', assert: mentions(/licens|insur|warranty|quality|include|proper|code/) },
          { description: 'No pressure tactics', assert: doesNotMention(/limited time|act now|prices going up|hurry/) },
        ],
      },
      {
        customer: "I guess that makes sense. What's included in that price?",
        checks: [
          { description: 'Answers what is included', assert: mentions(/install|include|hour|old|remov|haul/) },
          { description: 'Does not re-state the objection', assert: doesNotMention(/your buddy|\$400/) },
        ],
      },
      {
        customer: 'Ok that sounds fair. Can I get a free estimate first?',
        checks: [
          { description: 'Confirms free estimate', assert: mentions(/free estimate|absolutely|of course|happy to|sure/) },
          { description: 'Moves toward scheduling', assert: mentions(/schedul|when|availab|time|come out/) },
        ],
      },
    ],
  },
  {
    name: 'Frustrated Escalation',
    description: 'Angry customer → empathy → demands manager → clean handoff',
    systemPrompt: buildPrompt({
      sentiment: 'frustrated',
      strategy: 'De-escalate and empathize. If they ask for a manager, facilitate handoff.',
    }),
    turns: [
      {
        customer: 'I called two days ago about a leaking pipe and NOBODY got back to me. This is terrible service.',
        checks: [
          { description: 'Empathizes first', assert: mentions(/sorry|apologize|understand|frustrat/) },
          { description: 'No excuses', assert: doesNotMention(/but we|actually we|in our defense/) },
          { description: 'Offers to fix', assert: mentions(/help|resolve|fix|right away|priority|get.*on this/) },
        ],
      },
      {
        customer: "Sorry doesn't fix my flooded kitchen. The water damage is getting worse every hour.",
        checks: [
          { description: 'Acknowledges urgency', assert: mentions(/urgent|right away|immediately|priority|emergency|understand/) },
          { description: 'No verbatim repeat', assert: noRepetition() },
          { description: 'Offers concrete next step', assert: mentions(/mike|call|send|someone|today|right now|emergency/) },
        ],
      },
      {
        customer: 'I want to speak to Mike directly. Get me your manager.',
        checks: [
          { description: 'Acknowledges request', assert: mentions(/understand|of course|absolutely|sure|right away/) },
          { description: 'Commits to connecting', assert: mentions(/mike|reach|connect|get.*for you|have.*call|owner/) },
          { description: 'Does not try to handle it instead', assert: doesNotMention(/I can help with that instead|let me try|give me a chance/) },
        ],
      },
    ],
  },
  {
    name: 'Slow Nurture',
    description: 'Casual inquiry → not ready → returns later → books',
    systemPrompt: buildPrompt({ strategy: "Be helpful but don't push. Let them take their time." }),
    turns: [
      {
        customer: 'Just curious — do you guys do sewer line inspections?',
        checks: [
          { description: 'Confirms service', assert: mentions(/sewer|inspection|camera|yes|we do/) },
        ],
      },
      {
        customer: "Cool, not sure I need it yet. My realtor mentioned it for a house I'm looking at buying.",
        checks: [
          { description: 'Respects no rush', assert: mentions(/no rush|no problem|take your time|understand|whenever|happy to/) },
          { description: 'Does NOT push', assert: doesNotMention(/book now|schedule today|don't wait/) },
        ],
      },
      {
        customer: 'What would I be looking for that means I need an inspection?',
        checks: [
          { description: 'Gives helpful info', assert: mentions(/older|tree|root|crack|slow|backup|age/) },
          { description: 'Educational, not salesy', assert: doesNotMention(/limited|special|deal|discount/) },
        ],
      },
      {
        customer: "The house is from 1965 so yeah probably a good idea. If I get the house I'll definitely reach out.",
        checks: [
          { description: 'Supportive', assert: mentions(/great|sounds|good idea|luck|wish|exciting|here/) },
          { description: 'Leaves door open', assert: mentions(/here|reach|anytime|ready|whenever|happy to/) },
          { description: 'No booking push', assert: doesNotMention(/let's go ahead and book|schedule it now/) },
        ],
      },
      {
        customer: 'Hey I got the house! Can we schedule that sewer inspection?',
        checks: [
          { description: 'Congratulates', assert: mentions(/congrat|great|exciting|awesome|wonderful/) },
          { description: 'Moves to scheduling', assert: mentions(/schedul|when|availab|book|set up/) },
          { description: 'References context', assert: mentions(/sewer|inspection/) },
        ],
      },
    ],
  },
  {
    name: 'Knowledge Boundary',
    description: 'AI defers on unknown topics, answers confidently on known topics',
    systemPrompt: buildPrompt({
      knowledgeContext: `Services offered:
- Drain cleaning: $150-300
- Pipe repair: $200-500
Business hours: Mon-Fri 8am-5pm.
Service area: Portland only.`,
    }),
    turns: [
      {
        customer: 'Do you install tankless water heaters?',
        checks: [
          { description: 'Does not confirm unknown service', assert: doesNotMention(/yes we install|we offer tankless|we do tankless/) },
          { description: 'Defers to owner', assert: mentions(/mike|check|confirm|get back|not sure|find out/) },
        ],
      },
      {
        customer: 'Ok. What about drain cleaning? My bathroom drain is slow.',
        checks: [
          { description: 'Answers confidently (known service)', assert: mentions(/drain|clean|\$|150|300/) },
          { description: 'No unnecessary deferral', assert: doesNotMention(/I'd need to check with Mike about drain/) },
        ],
      },
      {
        customer: "Do you guys service Beaverton? It's about 20 minutes from Portland.",
        checks: [
          { description: 'Does not confirm unknown area', assert: doesNotMention(/yes we service beaverton|we cover beaverton/) },
          { description: 'References what they know', assert: mentions(/portland|service area|mike|check|confirm/) },
        ],
      },
      {
        customer: "What's your warranty on drain cleaning?",
        checks: [
          { description: 'Does not invent warranty', assert: doesNotMention(/\d+.year warranty|lifetime warranty|we guarantee for/) },
          { description: 'Defers to owner', assert: mentions(/mike|specifics|details|check|confirm|get back/) },
        ],
      },
    ],
  },
  {
    name: 'Mid-Conversation Opt-Out',
    description: 'Engaged lead abruptly opts out — AI must respect immediately',
    systemPrompt: buildPrompt(),
    turns: [
      {
        customer: "Hi, I'm looking for someone to fix a pipe under my sink.",
        checks: [
          { description: 'Engages helpfully', assert: mentions(/pipe|sink|help|look/) },
        ],
      },
      {
        customer: "It's been leaking for a couple days. Probably need it replaced.",
        checks: [
          { description: 'Continues naturally', assert: mentions(/leak|replac|come|take a look|schedul/) },
        ],
      },
      {
        customer: 'Actually you know what, I just found someone else. Please stop texting me.',
        checks: [
          { description: 'No retention attempt', assert: doesNotMention(/before you go|one more thing|we can match|reconsider|better deal/) },
          { description: 'Acknowledges and respects', assert: mentions(/understand|respect|no problem|wish.*luck|take care|sorry|good luck/) },
          { description: 'Short response', assert: maxLength(250) },
        ],
      },
    ],
    finalChecks: [
      {
        description: 'Last response is farewell, not a sales pitch',
        assert: (history) => {
          const last = history.filter(h => h.role === 'assistant').pop();
          if (!last) throw new Error('No AI response');
          const lower = last.content.toLowerCase();
          if (/schedule|book|appointment|offer|price|discount/.test(lower)) {
            throw new Error('Last response contains sales language');
          }
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runScenario(scenario: ScenarioDef): Promise<ScenarioResult> {
  const start = Date.now();
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  const turnResults: TurnResult[] = [];
  let allPassed = true;

  console.log(`\n${c.bold}${c.cyan}━━━ ${scenario.name} ━━━${c.reset}`);
  console.log(`${c.dim}${scenario.description}${c.reset}\n`);

  for (let i = 0; i < scenario.turns.length; i++) {
    const turn = scenario.turns[i];
    const turnStart = Date.now();

    // Print customer message
    console.log(`  ${c.blue}👤 Customer:${c.reset} ${turn.customer}`);

    // Get AI response
    const messages = [...history, { role: 'user' as const, content: turn.customer }];
    const aiResponse = await chat(scenario.systemPrompt, messages);

    history.push({ role: 'user', content: turn.customer });
    history.push({ role: 'assistant', content: aiResponse });

    console.log(`  ${c.magenta}🤖 AI:${c.reset} ${aiResponse}`);

    // Run assertions
    const assertions: AssertionResult[] = [];
    for (const check of turn.checks) {
      try {
        check.assert(aiResponse, history);
        assertions.push({ description: check.description, passed: true });
        console.log(`     ${c.green}✓${c.reset} ${c.dim}${check.description}${c.reset}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        assertions.push({ description: check.description, passed: false, error: msg });
        console.log(`     ${c.red}✗ ${check.description}${c.reset}`);
        console.log(`       ${c.red}${c.dim}${msg}${c.reset}`);
        allPassed = false;
      }
    }

    const turnDuration = Date.now() - turnStart;
    console.log(`     ${c.dim}(${turnDuration}ms)${c.reset}\n`);

    turnResults.push({
      customerMessage: turn.customer,
      aiResponse,
      assertions,
      durationMs: turnDuration,
    });
  }

  // Final checks
  const finalAssertions: AssertionResult[] = [];
  if (scenario.finalChecks) {
    console.log(`  ${c.dim}Final checks:${c.reset}`);
    for (const check of scenario.finalChecks) {
      try {
        check.assert(history);
        finalAssertions.push({ description: check.description, passed: true });
        console.log(`     ${c.green}✓${c.reset} ${c.dim}${check.description}${c.reset}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        finalAssertions.push({ description: check.description, passed: false, error: msg });
        console.log(`     ${c.red}✗ ${check.description}: ${msg}${c.reset}`);
        allPassed = false;
      }
    }
  }

  const total = Date.now() - start;
  const badge = allPassed
    ? `${c.bgGreen}${c.white} PASS ${c.reset}`
    : `${c.bgRed}${c.white} FAIL ${c.reset}`;
  console.log(`  ${badge} ${c.dim}(${total}ms)${c.reset}`);

  return {
    name: scenario.name,
    description: scenario.description,
    turns: turnResults,
    finalAssertions,
    passed: allPassed,
    totalDurationMs: total,
  };
}

// ---------------------------------------------------------------------------
// HTML report generator
// ---------------------------------------------------------------------------

function generateHTML(results: ScenarioResult[]): string {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalAssertions = results.reduce((sum, r) =>
    sum + r.turns.reduce((s, t) => s + t.assertions.length, 0) + r.finalAssertions.length, 0);
  const passedAssertions = results.reduce((sum, r) =>
    sum + r.turns.reduce((s, t) => s + t.assertions.filter(a => a.passed).length, 0)
    + r.finalAssertions.filter(a => a.passed).length, 0);

  const scenarioHTML = results.map(r => {
    const turnsHTML = r.turns.map((t, i) => {
      const assertionsHTML = t.assertions.map(a => `
        <div class="assertion ${a.passed ? 'pass' : 'fail'}">
          <span class="icon">${a.passed ? '✓' : '✗'}</span>
          <span class="desc">${a.description}</span>
          ${a.error ? `<span class="error">${escapeHtml(a.error)}</span>` : ''}
        </div>`).join('');

      return `
        <div class="turn">
          <div class="turn-header">Turn ${i + 1} <span class="duration">${t.durationMs}ms</span></div>
          <div class="message customer">
            <div class="role">👤 Customer</div>
            <div class="content">${escapeHtml(t.customerMessage)}</div>
          </div>
          <div class="message ai">
            <div class="role">🤖 AI Response</div>
            <div class="content">${escapeHtml(t.aiResponse)}</div>
          </div>
          <div class="assertions">${assertionsHTML}</div>
        </div>`;
    }).join('');

    const finalHTML = r.finalAssertions.length > 0 ? `
      <div class="final-checks">
        <div class="turn-header">Final Checks</div>
        ${r.finalAssertions.map(a => `
          <div class="assertion ${a.passed ? 'pass' : 'fail'}">
            <span class="icon">${a.passed ? '✓' : '✗'}</span>
            <span class="desc">${a.description}</span>
            ${a.error ? `<span class="error">${escapeHtml(a.error)}</span>` : ''}
          </div>`).join('')}
      </div>` : '';

    return `
      <div class="scenario ${r.passed ? 'passed' : 'failed'}">
        <div class="scenario-header">
          <span class="badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'PASS' : 'FAIL'}</span>
          <h2>${escapeHtml(r.name)}</h2>
          <span class="duration">${r.totalDurationMs}ms</span>
        </div>
        <p class="description">${escapeHtml(r.description)}</p>
        ${turnsHTML}
        ${finalHTML}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Scenario Report — ${new Date().toISOString().split('T')[0]}</title>
  <style>
    :root { --forest: #1B2F26; --olive: #6B7E54; --sage: #C8D4CC; --moss: #E3E9E1; --sienna: #C15B2E; --terracotta: #D4754A; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #333; line-height: 1.5; }
    .header { background: var(--forest); color: white; padding: 2rem; }
    .header h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .header .stats { display: flex; gap: 2rem; font-size: 0.9rem; opacity: 0.9; }
    .header .stat-value { font-weight: bold; font-size: 1.2rem; }
    .container { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    .scenario { background: white; border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden; border: 1px solid #e0e0e0; }
    .scenario.failed { border-color: var(--sienna); }
    .scenario-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.25rem; background: #fafafa; border-bottom: 1px solid #eee; }
    .scenario-header h2 { font-size: 1.1rem; flex: 1; }
    .description { padding: 0.5rem 1.25rem; color: #666; font-size: 0.85rem; border-bottom: 1px solid #f0f0f0; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; }
    .badge.pass { background: #e8f5e9; color: #2e7d32; }
    .badge.fail { background: #fdeae4; color: var(--sienna); }
    .duration { font-size: 0.8rem; color: #999; }
    .turn { padding: 1rem 1.25rem; border-bottom: 1px solid #f5f5f5; }
    .turn:last-child { border-bottom: none; }
    .turn-header { font-size: 0.8rem; font-weight: 600; color: #888; margin-bottom: 0.5rem; display: flex; justify-content: space-between; }
    .message { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 0.5rem; }
    .message .role { font-size: 0.75rem; font-weight: 600; margin-bottom: 0.25rem; }
    .message .content { font-size: 0.9rem; white-space: pre-wrap; }
    .message.customer { background: #e3f2fd; }
    .message.customer .role { color: #1565c0; }
    .message.ai { background: var(--moss); }
    .message.ai .role { color: var(--forest); }
    .assertions { margin-top: 0.5rem; }
    .assertion { display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.2rem 0; font-size: 0.82rem; }
    .assertion .icon { width: 1.2rem; text-align: center; flex-shrink: 0; }
    .assertion.pass .icon { color: #2e7d32; }
    .assertion.fail .icon { color: var(--sienna); font-weight: bold; }
    .assertion.fail .desc { color: var(--sienna); font-weight: 500; }
    .assertion .error { display: block; color: #999; font-size: 0.78rem; margin-left: 1.6rem; }
    .final-checks { padding: 0.75rem 1.25rem; background: #fafafa; }
    .summary-bar { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
    .summary-card { flex: 1; padding: 1rem; background: white; border-radius: 8px; text-align: center; border: 1px solid #e0e0e0; }
    .summary-card .value { font-size: 1.5rem; font-weight: 700; }
    .summary-card .label { font-size: 0.8rem; color: #888; }
    .summary-card.green .value { color: #2e7d32; }
    .summary-card.red .value { color: var(--sienna); }
  </style>
</head>
<body>
  <div class="header">
    <h1>ConversionSurgery — AI Scenario Report</h1>
    <div class="stats">
      <div>Generated: ${new Date().toLocaleString()}</div>
      <div>Model: claude-haiku-4-5-20251001</div>
    </div>
  </div>
  <div class="container">
    <div class="summary-bar">
      <div class="summary-card green"><div class="value">${passed}</div><div class="label">Scenarios Passed</div></div>
      <div class="summary-card ${failed > 0 ? 'red' : ''}"><div class="value">${failed}</div><div class="label">Scenarios Failed</div></div>
      <div class="summary-card"><div class="value">${passedAssertions}/${totalAssertions}</div><div class="label">Assertions Passed</div></div>
      <div class="summary-card"><div class="value">${results.reduce((s, r) => s + r.totalDurationMs, 0)}ms</div><div class="label">Total Time</div></div>
    </div>
    ${scenarioHTML}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${c.red}Error: ANTHROPIC_API_KEY is required${c.reset}`);
    process.exit(1);
  }

  console.log(`${c.bold}ConversionSurgery AI Scenario Runner${c.reset}`);
  console.log(`${c.dim}Running ${scenarios.length} multi-turn conversation scenarios...${c.reset}`);

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\n${c.bold}━━━ Summary ━━━${c.reset}`);
  console.log(`  ${c.green}${passed} passed${c.reset}, ${failed > 0 ? c.red : c.dim}${failed} failed${c.reset} out of ${results.length} scenarios`);

  // Generate HTML report
  const scratchDir = resolve(process.cwd(), '.scratch');
  if (!existsSync(scratchDir)) mkdirSync(scratchDir, { recursive: true });

  const reportPath = resolve(scratchDir, 'ai-scenario-report.html');
  writeFileSync(reportPath, generateHTML(results));
  console.log(`\n  ${c.cyan}HTML report: ${reportPath}${c.reset}`);
  console.log(`  ${c.dim}Open in browser: open ${reportPath}${c.reset}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
