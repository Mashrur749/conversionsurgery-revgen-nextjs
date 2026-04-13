import { describe, it, expect } from 'vitest';
import {
  mentions,
  doesNotMention,
  maxLength,
  maxQuestions,
  noRepetition,
  endsWithCompleteSentence,
  noBrokenFormatting,
  lengthBetween,
  referencesContext,
} from '@/lib/evals/assertions';

// ---------------------------------------------------------------------------
// mentions
// ---------------------------------------------------------------------------

describe('mentions', () => {
  it('passes when string pattern found', () => {
    expect(() => mentions('hello')('hello world')).not.toThrow();
  });

  it('throws when string pattern not found', () => {
    expect(() => mentions('xyz')('hello world')).toThrow();
  });

  it('is case-insensitive for string patterns', () => {
    expect(() => mentions('HELLO')('hello world')).not.toThrow();
    expect(() => mentions('hello')('HELLO WORLD')).not.toThrow();
  });

  it('supports regex pattern', () => {
    expect(() => mentions(/hel+o/)('hello world')).not.toThrow();
  });

  it('throws when regex pattern not found', () => {
    expect(() => mentions(/xyz\d+/)('hello world')).toThrow();
  });

  it('passes when at least one of multiple patterns matches', () => {
    expect(() => mentions('xyz', 'hello')('hello world')).not.toThrow();
  });

  it('throws when none of multiple patterns match', () => {
    expect(() => mentions('foo', 'bar', 'baz')('hello world')).toThrow();
  });

  it('error message includes the missing patterns', () => {
    expect(() => mentions('xyz')('hello world')).toThrow(/xyz/);
  });
});

// ---------------------------------------------------------------------------
// doesNotMention
// ---------------------------------------------------------------------------

describe('doesNotMention', () => {
  it('passes when string pattern absent', () => {
    expect(() => doesNotMention('xyz')('hello world')).not.toThrow();
  });

  it('throws when string pattern found', () => {
    expect(() => doesNotMention('hello')('hello world')).toThrow();
  });

  it('is case-insensitive for string patterns', () => {
    expect(() => doesNotMention('HELLO')('hello world')).toThrow();
    expect(() => doesNotMention('hello')('HELLO WORLD')).toThrow();
  });

  it('supports regex pattern', () => {
    expect(() => doesNotMention(/hel+o/)('hello world')).toThrow();
  });

  it('passes when regex pattern absent', () => {
    expect(() => doesNotMention(/xyz\d+/)('hello world')).not.toThrow();
  });

  it('passes when all of multiple patterns are absent', () => {
    expect(() => doesNotMention('foo', 'bar', 'baz')('hello world')).not.toThrow();
  });

  it('throws on the first matching pattern among multiple', () => {
    expect(() => doesNotMention('foo', 'hello', 'bar')('hello world')).toThrow(/hello/);
  });
});

// ---------------------------------------------------------------------------
// maxLength
// ---------------------------------------------------------------------------

describe('maxLength', () => {
  it('passes when response is under the limit', () => {
    expect(() => maxLength(100)('short')).not.toThrow();
  });

  it('passes when response equals the limit exactly', () => {
    expect(() => maxLength(5)('hello')).not.toThrow();
  });

  it('throws when response exceeds the limit', () => {
    expect(() => maxLength(4)('hello')).toThrow();
  });

  it('error message includes the limit and actual length', () => {
    expect(() => maxLength(4)('hello')).toThrow(/4/);
    expect(() => maxLength(4)('hello')).toThrow(/5/);
  });

  it('passes for empty string with any positive limit', () => {
    expect(() => maxLength(0)('')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// maxQuestions
// ---------------------------------------------------------------------------

describe('maxQuestions', () => {
  it('passes when question count is under the limit', () => {
    expect(() => maxQuestions(2)('How are you? Good.')).not.toThrow();
  });

  it('passes when question count equals the limit', () => {
    expect(() => maxQuestions(1)('How are you?')).not.toThrow();
  });

  it('throws when question count exceeds the limit', () => {
    expect(() => maxQuestions(1)('How are you? What time? Where?')).toThrow();
  });

  it('passes for zero questions allowed when none present', () => {
    expect(() => maxQuestions(0)('Hello there.')).not.toThrow();
  });

  it('throws when zero questions allowed but one is present', () => {
    expect(() => maxQuestions(0)('Hello there?')).toThrow();
  });

  it('error includes expected and actual counts', () => {
    expect(() => maxQuestions(1)('A? B? C?')).toThrow(/1/);
    expect(() => maxQuestions(1)('A? B? C?')).toThrow(/3/);
  });
});

// ---------------------------------------------------------------------------
// noRepetition
// ---------------------------------------------------------------------------

describe('noRepetition', () => {
  it('passes when previousResponses is not in context', () => {
    expect(() => noRepetition()('The quick brown fox jumps over the lazy dog')).not.toThrow();
  });

  it('passes when previousResponses is empty', () => {
    expect(() => noRepetition()('The quick brown fox', { previousResponses: [] })).not.toThrow();
  });

  it('passes when no 4-word phrase matches previous responses', () => {
    expect(() =>
      noRepetition()('Brand new unique content here', { previousResponses: ['something completely different'] })
    ).not.toThrow();
  });

  it('throws when a 4-word phrase appears in a previous response', () => {
    expect(() =>
      noRepetition()('the quick brown fox', { previousResponses: ['the quick brown fox jumps'] })
    ).toThrow();
  });

  it('is case-insensitive when detecting repetition', () => {
    expect(() =>
      noRepetition()('THE QUICK BROWN FOX', { previousResponses: ['the quick brown fox was here'] })
    ).toThrow();
  });

  it('respects custom minLength', () => {
    // With minLength=3, a 3-word overlap should trigger
    expect(() =>
      noRepetition(3)('quick brown fox', { previousResponses: ['the quick brown fox jumps'] })
    ).toThrow();
  });

  it('does not throw for phrase shorter than minLength', () => {
    // Only 2 words — should not trigger default minLength=4 check
    expect(() =>
      noRepetition(4)('hello world', { previousResponses: ['hello world is nice'] })
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// endsWithCompleteSentence
// ---------------------------------------------------------------------------

describe('endsWithCompleteSentence', () => {
  it('passes when response ends with period', () => {
    expect(() => endsWithCompleteSentence()('Hello world.')).not.toThrow();
  });

  it('passes when response ends with exclamation mark', () => {
    expect(() => endsWithCompleteSentence()('Great news!')).not.toThrow();
  });

  it('passes when response ends with question mark', () => {
    expect(() => endsWithCompleteSentence()('Are you sure?')).not.toThrow();
  });

  it('passes when response ends with closing parenthesis', () => {
    expect(() => endsWithCompleteSentence()('(see you tomorrow)')).not.toThrow();
  });

  it('passes when response ends with closing single quote', () => {
    expect(() => endsWithCompleteSentence()("He said 'yes'.")).not.toThrow();
  });

  it('passes when response ends with closing double quote', () => {
    expect(() => endsWithCompleteSentence()('She said "hello."')).not.toThrow();
  });

  it('throws when response ends with ellipsis', () => {
    expect(() => endsWithCompleteSentence()('Not quite finished...')).toThrow(/\.\.\./);
  });

  it('throws when response ends with a plain word', () => {
    expect(() => endsWithCompleteSentence()('The answer is incomplete')).toThrow();
  });

  it('handles trailing whitespace correctly', () => {
    expect(() => endsWithCompleteSentence()('Hello world.   ')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// noBrokenFormatting
// ---------------------------------------------------------------------------

describe('noBrokenFormatting', () => {
  it('passes for clean prose', () => {
    expect(() => noBrokenFormatting()('Hello, how can I help you today?')).not.toThrow();
  });

  it('throws when response starts with "Agent:"', () => {
    expect(() => noBrokenFormatting()('Agent: Hello there.')).toThrow(/Agent:/i);
  });

  it('throws when response contains markdown heading', () => {
    expect(() => noBrokenFormatting()('# Heading\nSome text.')).toThrow(/heading/i);
  });

  it('throws when response contains sub-heading', () => {
    expect(() => noBrokenFormatting()('## Sub-heading\nText here.')).toThrow(/heading/i);
  });

  it('throws when response contains bold markdown', () => {
    expect(() => noBrokenFormatting()('This is **important** text.')).toThrow(/bold/i);
  });

  it('throws when response contains a code block', () => {
    expect(() => noBrokenFormatting()('Here is code:\n```js\nconsole.log(1);\n```')).toThrow(/code block/i);
  });

  it('does not throw for single asterisks (italic is allowed)', () => {
    expect(() => noBrokenFormatting()('Hello *world*.')).not.toThrow();
  });

  it('does not throw for inline code backticks', () => {
    expect(() => noBrokenFormatting()('Use `npm install` to install.')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// lengthBetween
// ---------------------------------------------------------------------------

describe('lengthBetween', () => {
  it('passes when response length is within range', () => {
    expect(() => lengthBetween(5, 20)('hello world')).not.toThrow();
  });

  it('passes when response length equals minimum', () => {
    expect(() => lengthBetween(5, 20)('hello')).not.toThrow();
  });

  it('passes when response length equals maximum', () => {
    expect(() => lengthBetween(1, 5)('hello')).not.toThrow();
  });

  it('throws when response is shorter than minimum', () => {
    expect(() => lengthBetween(10, 20)('hello')).toThrow();
  });

  it('throws when response is longer than maximum', () => {
    expect(() => lengthBetween(1, 4)('hello')).toThrow();
  });

  it('error includes min, max, and actual length', () => {
    expect(() => lengthBetween(10, 20)('hi')).toThrow(/10/);
    expect(() => lengthBetween(10, 20)('hi')).toThrow(/20/);
    expect(() => lengthBetween(10, 20)('hi')).toThrow(/2/);
  });
});

// ---------------------------------------------------------------------------
// referencesContext
// ---------------------------------------------------------------------------

describe('referencesContext', () => {
  it('passes when response contains enough context keywords', () => {
    expect(() =>
      referencesContext('estimate plumbing repair cost')('We can provide an estimate for the plumbing work.')
    ).not.toThrow();
  });

  it('throws when response has fewer keywords than required', () => {
    expect(() =>
      referencesContext('estimate plumbing repair Calgary', 3)('Hello, thanks for reaching out.')
    ).toThrow();
  });

  it('uses a default minKeywords of 2', () => {
    // Response contains "kitchen" and "repair" — both >= 4 chars and in context
    expect(() =>
      referencesContext('kitchen repair needed')('We handle kitchen and repair work.')
    ).not.toThrow();
  });

  it('throws when response contains only one matching keyword but two required', () => {
    // context words >= 4 chars: "kitchen", "sink", "repair"
    // response contains: "kitchen" → 1 match; "sink" and "repair" absent → only 1 match < minKeywords=2
    expect(() =>
      referencesContext('kitchen sink repair')('Sure, the kitchen looks good.')
    ).toThrow();
  });

  it('fails when only 1 context keyword appears and 2 required', () => {
    expect(() =>
      referencesContext('plumbing estimate needed', 2)('Thanks for contacting us.')
    ).toThrow();
  });

  it('ignores context words shorter than 4 characters', () => {
    // "on", "in", "at" are all < 4 chars, should not count
    expect(() =>
      referencesContext('on in at the')('This is a test sentence.')
    ).toThrow(); // No 4+ char context word will match "This" "test" "sentence"... actually wait:
    // context: "the" < 4, others < 4 — no 4-char words → 0 unique context words → matches=0 → throw
  });

  it('is case-insensitive', () => {
    expect(() =>
      referencesContext('ESTIMATE PLUMBING')('We provide estimate and plumbing services.')
    ).not.toThrow();
  });

  it('supports custom minKeywords', () => {
    expect(() =>
      referencesContext('estimate plumbing repair sink drain', 4)(
        'We handle estimate, plumbing, repair, and drain work.'
      )
    ).not.toThrow();
  });
});
