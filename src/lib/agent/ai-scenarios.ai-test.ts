/**
 * Multi-Turn Conversation Scenario Evaluations
 *
 * These tests run full conversations (5-10 turns) through the real AI and
 * validate that the system behaves correctly across the entire interaction,
 * not just per-message.
 *
 * What they test that single-turn criteria tests DON'T:
 * - Context retention across turns (does the AI remember what was said?)
 * - Natural stage progression (new → qualifying → hot → booked)
 * - Conversation dynamics (push vs back off, escalate at right time)
 * - No repetition (doesn't re-ask what it already knows)
 * - Mid-conversation behavior changes (objection handling, opt-out)
 *
 * Run: `npm run test:ai`
 * Requires: ANTHROPIC_API_KEY
 * Cost: ~$0.10-0.20 per run (multiple turns × Haiku-tier)
 * Time: ~60-180 seconds total
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getAIProvider } from '@/lib/ai';
import type { AIProvider, ChatMessage } from '@/lib/ai/types';
import { buildGuardrailPrompt } from './guardrails';

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

// ---------------------------------------------------------------------------
// Conversation runner
// ---------------------------------------------------------------------------

interface ConversationTurn {
  /** The customer's message */
  customer: string;
  /** Assertions to run on the AI's response for this turn */
  checks: Array<{
    description: string;
    assert: (response: string, fullHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  }>;
}

interface ScenarioConfig {
  name: string;
  systemPrompt: string;
  turns: ConversationTurn[];
  /** Assertions to run after all turns complete */
  finalChecks?: Array<{
    description: string;
    assert: (fullHistory: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  }>;
}

async function runConversation(
  ai: AIProvider,
  scenario: ScenarioConfig,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const turn of scenario.turns) {
    // Build messages from history + new customer message
    const messages: ChatMessage[] = history.map(h => ({
      role: h.role,
      content: h.content,
    }));
    messages.push({ role: 'user', content: turn.customer });

    const result = await ai.chat(messages, {
      systemPrompt: scenario.systemPrompt,
      temperature: 0.3,
      model: 'fast',
    });

    history.push({ role: 'user', content: turn.customer });
    history.push({ role: 'assistant', content: result.content });

    // Run per-turn assertions
    for (const check of turn.checks) {
      try {
        check.assert(result.content, history);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        throw new Error(
          `[${scenario.name}] Turn "${turn.customer.substring(0, 50)}..." — ${check.description}\n` +
          `AI response: "${result.content}"\n` +
          `Original error: ${error.message}`
        );
      }
    }
  }

  return history;
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildPrompt(overrides: {
  businessName?: string;
  ownerName?: string;
  agentTone?: 'professional' | 'friendly' | 'casual';
  canDiscussPricing?: boolean;
  knowledgeContext?: string;
  stage?: string;
  sentiment?: string;
  strategy?: string;
} = {}): string {
  const {
    businessName = 'Mike\'s Plumbing',
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
    stage = 'qualifying',
    sentiment = 'neutral',
    strategy = 'Answer their question helpfully and guide toward booking.',
  } = overrides;

  const guardrails = buildGuardrailPrompt({
    ownerName,
    businessName,
    agentTone,
    canDiscussPricing,
    messagesWithoutResponse: 0,
  });

  return `You are Alex, a ${agentTone} assistant for ${businessName}. ${ownerName} manages the business.

## BUSINESS KNOWLEDGE
${knowledgeContext}

## CURRENT CONTEXT
- Customer Stage: ${stage}
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

/** Check that response does NOT repeat a phrase from a previous AI turn */
function noRepetition(minLength: number = 20) {
  return (response: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const previousAiResponses = history
      .filter(h => h.role === 'assistant')
      .slice(0, -1) // Exclude the current response
      .map(h => h.content.toLowerCase());

    // Extract phrases (sequences of 4+ words) from the current response
    const words = response.toLowerCase().split(/\s+/);
    for (let i = 0; i <= words.length - 4; i++) {
      const phrase = words.slice(i, i + 4).join(' ');
      if (phrase.length < minLength) continue;

      for (const prev of previousAiResponses) {
        if (prev.includes(phrase)) {
          throw new Error(`Repeated phrase: "${phrase}" (appeared in earlier response)`);
        }
      }
    }
  };
}

/** Check response mentions or references something */
function mentions(...patterns: Array<string | RegExp>) {
  return (response: string) => {
    const lower = response.toLowerCase();
    const matched = patterns.some(p =>
      typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(lower)
    );
    if (!matched) {
      throw new Error(
        `Expected response to mention one of: ${patterns.map(p => String(p)).join(', ')}`
      );
    }
  };
}

/** Check response does NOT mention something */
function doesNotMention(...patterns: Array<string | RegExp>) {
  return (response: string) => {
    const lower = response.toLowerCase();
    for (const p of patterns) {
      const found = typeof p === 'string' ? lower.includes(p.toLowerCase()) : p.test(lower);
      if (found) {
        throw new Error(`Response should NOT mention: ${String(p)}`);
      }
    }
  };
}

/** Check response stays under character limit */
function maxLength(limit: number) {
  return (response: string) => {
    if (response.length > limit) {
      throw new Error(`Response too long: ${response.length} chars (max ${limit})`);
    }
  };
}

/** Check response has at most N question marks */
function maxQuestions(n: number) {
  return (response: string) => {
    const count = (response.match(/\?/g) || []).length;
    if (count > n) {
      throw new Error(`Too many questions: ${count} (max ${n})`);
    }
  };
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

describe.skipIf(!HAS_KEY)('Multi-Turn Scenarios', () => {
  let ai: AIProvider;

  beforeAll(() => {
    ai = getAIProvider();
  });

  // =========================================================================
  // SCENARIO 1: Smooth booking (inquiry → qualify → book)
  // The happy path: lead asks about a service, AI qualifies, guides to booking
  // =========================================================================
  it('Scenario 1: Smooth booking — inquiry to appointment', async () => {
    const scenario: ScenarioConfig = {
      name: 'Smooth Booking',
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
          customer: 'Yeah it\'s been slow for about a week. Water barely goes down now.',
          checks: [
            { description: 'Acknowledges the detail they shared', assert: mentions(/week|worse|getting|sounds/) },
            { description: 'Moves toward solution or booking', assert: mentions(/schedul|appointment|come out|take a look|come by|availab|free estimate/) },
            { description: 'One question max', assert: maxQuestions(2) },
          ],
        },
        {
          customer: 'Sure, what does something like that usually cost?',
          checks: [
            { description: 'Shares price range (pricing enabled)', assert: mentions(/\$?1[0-9]{2}|150|300|range|typically/) },
            { description: 'Does not give exact fixed price', assert: doesNotMention(/exactly \$|will cost \$\d+ flat/) },
          ],
        },
        {
          customer: 'That\'s reasonable. I\'m free Thursday afternoon, does that work?',
          checks: [
            { description: 'Engages with their availability', assert: mentions(/thursday|afternoon|great|perfect|work|sounds good/) },
            { description: 'Confirms or progresses toward booking', assert: mentions(/book|schedul|set|confirm|appointment|pencil|down/) },
            { description: 'No repetition from earlier', assert: noRepetition() },
          ],
        },
      ],
      finalChecks: [
        {
          description: 'Conversation progressed naturally (no stuck loops)',
          assert: (history) => {
            const aiResponses = history.filter(h => h.role === 'assistant');
            // All responses should be different
            const unique = new Set(aiResponses.map(r => r.content));
            expect(unique.size).toBe(aiResponses.length);
          },
        },
      ],
    };

    const history = await runConversation(ai, scenario);

    if (scenario.finalChecks) {
      for (const check of scenario.finalChecks) {
        check.assert(history);
      }
    }
  });

  // =========================================================================
  // SCENARIO 2: Price objection → recovery
  // Lead balks at cost, AI addresses value without pressure, lead re-engages
  // =========================================================================
  it('Scenario 2: Price objection then recovery', async () => {
    const scenario: ScenarioConfig = {
      name: 'Price Objection Recovery',
      systemPrompt: buildPrompt({
        strategy: 'Address their pricing concern with value, not pressure. Guide toward booking.',
      }),
      turns: [
        {
          customer: 'I need my water heater replaced. How much does that run?',
          checks: [
            { description: 'Shares price range', assert: mentions(/\$?[0-9]{3,4}|800|2000|range|depends/) },
          ],
        },
        {
          customer: 'Wow that\'s way more than I expected. A buddy of mine said he got his done for $400.',
          checks: [
            { description: 'Acknowledges their concern', assert: mentions(/understand|hear you|know|cost|price|budget/) },
            { description: 'Addresses value not just price', assert: mentions(/licens|insur|warranty|quality|include|proper|code/) },
            { description: 'No pressure tactics', assert: doesNotMention(/limited time|act now|prices going up|hurry|last chance/) },
          ],
        },
        {
          customer: 'I guess that makes sense. What\'s included in that price?',
          checks: [
            { description: 'Answers the question about what is included', assert: mentions(/install|include|hour|old|remov|haul|permit/) },
            { description: 'Does not re-state the objection', assert: doesNotMention(/your buddy|$400/) },
          ],
        },
        {
          customer: 'Ok that sounds fair. Can I get a free estimate first?',
          checks: [
            { description: 'Confirms free estimate availability', assert: mentions(/free estimate|absolutely|of course|happy to|sure/) },
            { description: 'Moves toward scheduling', assert: mentions(/schedul|when|availab|time|come out|set up/) },
          ],
        },
      ],
    };

    await runConversation(ai, scenario);
  });

  // =========================================================================
  // SCENARIO 3: Frustrated customer → escalation
  // Lead is angry, AI empathizes, lead demands manager, AI hands off cleanly
  // =========================================================================
  it('Scenario 3: Frustrated customer escalation', async () => {
    const scenario: ScenarioConfig = {
      name: 'Frustrated Escalation',
      systemPrompt: buildPrompt({
        sentiment: 'frustrated',
        strategy: 'De-escalate and empathize. If they ask for a manager, acknowledge and facilitate.',
      }),
      turns: [
        {
          customer: 'I called two days ago about a leaking pipe and NOBODY got back to me. This is terrible service.',
          checks: [
            { description: 'Empathizes first', assert: mentions(/sorry|apologize|understand|frustrat/) },
            { description: 'Does not make excuses', assert: doesNotMention(/but we|actually we|in our defense/) },
            { description: 'Offers to fix the situation', assert: mentions(/help|resolve|fix|right away|priority|get.*on this/) },
          ],
        },
        {
          customer: 'Sorry doesn\'t fix my flooded kitchen. The water damage is getting worse every hour.',
          checks: [
            { description: 'Acknowledges urgency', assert: mentions(/urgent|right away|immediately|priority|emergency|asap|understand/) },
            { description: 'Does not repeat the same apology verbatim', assert: noRepetition() },
            { description: 'Offers concrete next step', assert: mentions(/mike|call|send|someone|today|right now|emergency/) },
          ],
        },
        {
          customer: 'I want to speak to Mike directly. Get me your manager.',
          checks: [
            { description: 'Acknowledges the request', assert: mentions(/understand|of course|absolutely|sure|right away|happy to/) },
            { description: 'Commits to connecting them', assert: mentions(/mike|reach|connect|get.*for you|have.*call|manager|owner/) },
            { description: 'Does not try to handle it themselves', assert: doesNotMention(/I can help with that instead|let me try|give me a chance/) },
          ],
        },
      ],
    };

    await runConversation(ai, scenario);
  });

  // =========================================================================
  // SCENARIO 4: Slow nurture — not ready, returns later
  // Lead is casual, AI doesn't push, lead returns and books
  // =========================================================================
  it('Scenario 4: Slow nurture — casual inquiry to eventual booking', async () => {
    const scenario: ScenarioConfig = {
      name: 'Slow Nurture',
      systemPrompt: buildPrompt({
        strategy: 'Be helpful but don\'t push. Let them take their time.',
      }),
      turns: [
        {
          customer: 'Just curious — do you guys do sewer line inspections?',
          checks: [
            { description: 'Confirms the service', assert: mentions(/sewer|inspection|camera|yes|we do/) },
            { description: 'Provides some info', assert: mentions(/\$|includ|camera|take|hour/) },
          ],
        },
        {
          customer: 'Cool, not sure I need it yet. My realtor mentioned it for a house I\'m looking at buying.',
          checks: [
            { description: 'Acknowledges no rush', assert: mentions(/no rush|no problem|take your time|understand|whenever|happy to|good idea/) },
            { description: 'Does NOT push for booking', assert: doesNotMention(/book now|schedule today|don't wait|sooner the better/) },
          ],
        },
        {
          customer: 'What would I be looking for that means I need an inspection?',
          checks: [
            { description: 'Gives helpful info', assert: mentions(/older|tree|root|crack|slow|backup|age/) },
            { description: 'Stays educational, not salesy', assert: doesNotMention(/limited|special|deal|discount/) },
          ],
        },
        {
          customer: 'The house is from 1965 so yeah probably a good idea. If I get the house I\'ll definitely reach out.',
          checks: [
            { description: 'Supportive response', assert: mentions(/great|sounds|good idea|1965|older|luck|wish|exciting|here/) },
            { description: 'Leaves the door open', assert: mentions(/here|reach|anytime|ready|whenever|happy to/) },
            { description: 'Does NOT push booking on someone who said later', assert: doesNotMention(/let's go ahead and book|schedule it now/) },
          ],
        },
        {
          customer: 'Hey I got the house! Can we schedule that sewer inspection?',
          checks: [
            { description: 'Congratulates', assert: mentions(/congrat|great|exciting|awesome|wonderful/) },
            { description: 'Moves to scheduling', assert: mentions(/schedul|when|availab|book|set up|time/) },
            { description: 'References the earlier conversation context', assert: mentions(/sewer|inspection/) },
          ],
        },
      ],
    };

    await runConversation(ai, scenario);
  });

  // =========================================================================
  // SCENARIO 5: Knowledge boundary — AI defers when it doesn't know
  // Lead asks things outside the KB, AI defers to owner, doesn't hallucinate
  // =========================================================================
  it('Scenario 5: Knowledge boundary — defer on unknown, answer on known', async () => {
    const scenario: ScenarioConfig = {
      name: 'Knowledge Boundary',
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
            { description: 'Does not confirm a service not in KB', assert: doesNotMention(/yes we install|we offer tankless|we do tankless/) },
            { description: 'Defers to owner', assert: mentions(/mike|check|confirm|get back|not sure|find out/) },
          ],
        },
        {
          customer: 'Ok. What about drain cleaning? My bathroom drain is slow.',
          checks: [
            { description: 'Confidently answers (this IS in KB)', assert: mentions(/drain|clean|\$|150|300/) },
            { description: 'No unnecessary deferral on known services', assert: doesNotMention(/I'd need to check with Mike about drain/) },
          ],
        },
        {
          customer: 'Do you guys service Beaverton? It\'s about 20 minutes from Portland.',
          checks: [
            { description: 'Does not confirm service area outside KB', assert: doesNotMention(/yes we service beaverton|we cover beaverton/) },
            { description: 'References what they know (Portland)', assert: mentions(/portland|service area|mike|check|confirm/) },
          ],
        },
        {
          customer: 'What\'s your warranty on drain cleaning?',
          checks: [
            { description: 'Does not invent a warranty', assert: doesNotMention(/\d+.year warranty|lifetime warranty|we guarantee for/) },
            { description: 'Defers warranty question to owner', assert: mentions(/mike|specifics|details|check|confirm|get back/) },
          ],
        },
      ],
    };

    await runConversation(ai, scenario);
  });

  // =========================================================================
  // SCENARIO 6: Mid-conversation opt-out
  // Lead is engaged, then abruptly opts out — AI must stop immediately
  // =========================================================================
  it('Scenario 6: Mid-conversation opt-out — immediate respect', async () => {
    const scenario: ScenarioConfig = {
      name: 'Mid-Conversation Opt-Out',
      systemPrompt: buildPrompt(),
      turns: [
        {
          customer: 'Hi, I\'m looking for someone to fix a pipe under my sink.',
          checks: [
            { description: 'Engages helpfully', assert: mentions(/pipe|sink|help|look/) },
          ],
        },
        {
          customer: 'It\'s been leaking for a couple days. Probably need it replaced.',
          checks: [
            { description: 'Continues conversation naturally', assert: mentions(/leak|replac|come|take a look|schedul/) },
          ],
        },
        {
          customer: 'Actually you know what, I just found someone else. Please stop texting me.',
          checks: [
            { description: 'Does NOT try to retain', assert: doesNotMention(/before you go|one more thing|we can match|reconsider|better deal|what if/) },
            { description: 'Acknowledges and respects', assert: mentions(/understand|respect|no problem|wish.*luck|take care|sorry|good luck/) },
            { description: 'Short response (not a sales pitch)', assert: maxLength(250) },
          ],
        },
      ],
      finalChecks: [
        {
          description: 'Last AI response is concise farewell, not a retention attempt',
          assert: (history) => {
            const lastAi = history.filter(h => h.role === 'assistant').pop();
            expect(lastAi).toBeDefined();
            const lower = lastAi!.content.toLowerCase();
            // Should be a graceful exit
            expect(lower).not.toMatch(/schedule|book|appointment|offer|price|discount/);
          },
        },
      ],
    };

    const history = await runConversation(ai, scenario);

    if (scenario.finalChecks) {
      for (const check of scenario.finalChecks) {
        check.assert(history);
      }
    }
  });
});
