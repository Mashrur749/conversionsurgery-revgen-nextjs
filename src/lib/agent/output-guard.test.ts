import { describe, it, expect } from 'vitest';
import { checkOutputGuardrails, type GuardResult } from './output-guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function allowed(): { canDiscussPricing: boolean } {
  return { canDiscussPricing: true };
}

function gated(): { canDiscussPricing: boolean } {
  return { canDiscussPricing: false };
}

function passed(result: GuardResult) {
  expect(result.passed).toBe(true);
  expect(result.violation).toBeUndefined();
}

function failed(result: GuardResult, violation: GuardResult['violation']) {
  expect(result.passed).toBe(false);
  expect(result.violation).toBe(violation);
  expect(result.detail).toBeDefined();
}

// ---------------------------------------------------------------------------
// 1. Pricing leak
// ---------------------------------------------------------------------------
describe('pricing leak', () => {
  it('passes when canDiscussPricing=true and response contains dollar amount', () => {
    const result = checkOutputGuardrails(
      'Our drain cleaning typically starts at $150.',
      'How much does it cost?',
      allowed(),
    );
    passed(result);
  });

  it('fails when canDiscussPricing=false and response contains a dollar amount', () => {
    const result = checkOutputGuardrails(
      'Our drain cleaning typically starts at $150.',
      'How much does it cost?',
      gated(),
    );
    failed(result, 'pricing_leak');
  });

  it('fails when canDiscussPricing=false and response contains "prices start from"', () => {
    const result = checkOutputGuardrails(
      'Prices start from 200 dollars for a standard repair.',
      'How much?',
      gated(),
    );
    failed(result, 'pricing_leak');
  });

  it('fails when canDiscussPricing=false and response contains numeric cost pattern like "200 dollars"', () => {
    const result = checkOutputGuardrails(
      'The job would run around 200 dollars.',
      'What would it cost?',
      gated(),
    );
    failed(result, 'pricing_leak');
  });

  it('passes on "free estimates" without dollar amounts when gated', () => {
    const result = checkOutputGuardrails(
      'We offer free estimates — Mike will come out and give you an accurate quote.',
      'Will you charge me just to look?',
      gated(),
    );
    passed(result);
  });

  it('passes on "quote" reference without numbers when gated', () => {
    const result = checkOutputGuardrails(
      "I'd want Mike to give you an accurate quote. Let me set that up for you.",
      'What does a kitchen faucet repair cost?',
      gated(),
    );
    passed(result);
  });
});

// ---------------------------------------------------------------------------
// 2. Opt-out retention
// ---------------------------------------------------------------------------
describe('opt-out retention', () => {
  it('passes on normal conversation without opt-out inbound', () => {
    const result = checkOutputGuardrails(
      'Happy to help! What time works for you?',
      'I was wondering about scheduling.',
      gated(),
    );
    passed(result);
  });

  it('fails on persuasion attempt after "stop texting me"', () => {
    const result = checkOutputGuardrails(
      'I understand, but before you go, can I share one more option?',
      'stop texting me',
      gated(),
    );
    failed(result, 'opt_out_retention');
  });

  it('fails on "are you sure" after "leave me alone"', () => {
    const result = checkOutputGuardrails(
      'Are you sure? We have some great deals coming up.',
      'leave me alone',
      gated(),
    );
    failed(result, 'opt_out_retention');
  });

  it('fails on "just one more thing" after "unsubscribe"', () => {
    const result = checkOutputGuardrails(
      'Just one more thing before I let you go — Mike wanted to offer you a discount.',
      'unsubscribe',
      gated(),
    );
    failed(result, 'opt_out_retention');
  });

  it('passes on respectful acknowledgment after opt-out', () => {
    const result = checkOutputGuardrails(
      "Got it — you've been removed from our list. Take care!",
      'stop texting me',
      gated(),
    );
    passed(result);
  });

  it('passes on standard reply-stop instruction after opt-out', () => {
    const result = checkOutputGuardrails(
      'No problem. Reply STOP at any time to unsubscribe.',
      'leave me alone',
      gated(),
    );
    passed(result);
  });
});

// ---------------------------------------------------------------------------
// 3. AI identity denial
// ---------------------------------------------------------------------------
describe('AI identity denial', () => {
  it('passes when customer does not ask about AI identity', () => {
    const result = checkOutputGuardrails(
      'Sure, I can help you schedule that!',
      'Can you book me an appointment?',
      gated(),
    );
    passed(result);
  });

  it('fails on "I am a real person" after "are you a bot?"', () => {
    const result = checkOutputGuardrails(
      "I am a real person and I'm here to help.",
      'are you a bot?',
      gated(),
    );
    failed(result, 'identity_denial');
  });

  it('fails on "not a bot" claim after identity question', () => {
    const result = checkOutputGuardrails(
      "I'm not a bot — just a member of the team.",
      'are you a bot or a real person?',
      gated(),
    );
    failed(result, 'identity_denial');
  });

  it('fails on "I am human" after "are you a robot?"', () => {
    const result = checkOutputGuardrails(
      "I'm human, just helping out here!",
      'are you a robot?',
      gated(),
    );
    failed(result, 'identity_denial');
  });

  it('passes on "I am an AI assistant" after "are you a bot?"', () => {
    const result = checkOutputGuardrails(
      "I'm an AI assistant helping Mike's Plumbing respond quickly — Mike oversees everything.",
      'are you a bot?',
      gated(),
    );
    passed(result);
  });

  it('passes on "I am an automated assistant" after "who am I talking to?"', () => {
    const result = checkOutputGuardrails(
      "I'm an automated assistant for Mike's Plumbing. Mike reviews everything.",
      'who am I talking to?',
      gated(),
    );
    passed(result);
  });

  it('passes on identity denial phrases when customer never asked about it', () => {
    // "not a robot" in a figurative sense when no identity question was asked
    // should not trigger — guard only activates when inbound contains an identity question
    const result = checkOutputGuardrails(
      "We're not robots — we genuinely care about your home.",
      "I just feel like companies don't care these days.",
      gated(),
    );
    passed(result);
  });
});

// ---------------------------------------------------------------------------
// 4. Combined — first violation wins (pricing > opt-out > identity)
// ---------------------------------------------------------------------------
describe('combined violations', () => {
  it('returns pricing_leak when both pricing and opt-out violations exist', () => {
    const result = checkOutputGuardrails(
      'Before you go, our price is only $99!',
      'stop texting me',
      gated(),
    );
    failed(result, 'pricing_leak');
  });

  it('returns opt_out_retention when opt-out and identity violations exist but no pricing', () => {
    const result = checkOutputGuardrails(
      "Are you sure you want to stop? I'm a real person here to help.",
      'are you a bot? unsubscribe me',
      gated(),
    );
    // opt_out_retention checked before identity_denial
    failed(result, 'opt_out_retention');
  });

  it('returns identity_denial alone when only identity is violated', () => {
    const result = checkOutputGuardrails(
      "I'm a real person, not a bot!",
      'wait, is this automated? are you a real person?',
      gated(),
    );
    failed(result, 'identity_denial');
  });
});
