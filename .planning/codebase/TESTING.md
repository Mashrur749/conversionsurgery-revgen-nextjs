# Testing Patterns

**Analysis Date:** 2026-05-04

## Test Framework

**Runner:**
- Vitest ^4.0.18
- Config: `vitest.config.ts` (standard tests), `vitest.ai.config.ts` (AI eval tests)

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
pnpm test                  # Run all deterministic tests (312 tests)
pnpm run test:watch        # Watch mode
pnpm run test:ai           # AI criteria tests (real LLM, requires ANTHROPIC_API_KEY)
pnpm run test:ai:visual    # AI scenario tests with HTML report
pnpm run test:ai:full      # Full eval suite
```

## Test File Organization

**Location:** Co-located with source files — test file sits next to the module it tests.

**Naming:**
- Standard tests: `<module-name>.test.ts` (included in `pnpm test`)
- AI eval tests: `<module-name>.ai-test.ts` (excluded from `pnpm test`, run via `pnpm run test:ai`)

**Structure:**
```
src/lib/services/cancellation-policy.ts
src/lib/services/cancellation-policy.test.ts

src/lib/agent/guardrails.ts
src/lib/agent/guardrails.test.ts
src/lib/agent/ai-criteria.ai-test.ts    ← AI eval variant
src/lib/agent/ai-scenarios.ai-test.ts   ← AI scenario variant

src/lib/evals/coherence.ai-test.ts      ← standalone eval files
src/lib/evals/grounding.ai-test.ts
src/lib/evals/retrieval.ai-test.ts
```

## Test Suite Structure

**Suite organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ModuleName', () => {
  describe('functionName', () => {
    it('describes expected behavior in plain English', () => {
      // arrange
      const input = makeInput({ overrides });
      // act
      const result = functionUnderTest(input);
      // assert
      expect(result.property).toBe(expectedValue);
    });
  });
});
```

**Setup/teardown:**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Factory helpers:** Every test file that deals with complex objects defines a local `makeX()` factory:
```typescript
function makeState(overrides: Partial<ConversationStateType> = {}): ConversationStateType {
  return {
    leadId: 'lead-1',
    clientId: 'client-1',
    // ... full default object
    ...overrides,
  };
}

function makeConfig(overrides: Partial<GuardrailConfig> = {}): GuardrailConfig {
  return {
    ownerName: 'Mike',
    businessName: "Mike's Plumbing",
    agentTone: 'professional',
    ...overrides,
  };
}
```

## Mocking

**Framework:** Vitest's `vi.mock()` / `vi.fn()`

**Pattern — module-level mock with spy reference:**
```typescript
const mockRequireAgencyPermission = vi.fn();

vi.mock('@/lib/permissions/require-agency-permission', () => ({
  requireAgencyPermission: (...args: unknown[]) => mockRequireAgencyPermission(...args),
  requireAgencyClientPermission: (...args: unknown[]) => mockRequireAgencyClientPermission(...args),
}));

vi.mock('@/lib/services/internal-error-log', () => ({
  logInternalError: vi.fn(),
  logSanitizedConsoleError: vi.fn(),
}));
```

**Spy configuration in tests:**
```typescript
mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);
mockRequireAgencyPermission.mockRejectedValue(new Error('Unauthorized: not authenticated'));
```

**What to mock:**
- External service calls (DB, Twilio, Stripe, Anthropic)
- Auth/permission modules when testing route handlers
- Logger utilities when testing error paths

**What NOT to mock:**
- Pure business logic functions — test them directly
- Date math / calculation utilities — use concrete date inputs
- Schema/type exports — import the real thing

## Fixtures and Factories

**Test data pattern:** Inline `const fake*` objects at describe-scope or module-scope:
```typescript
const fakeAgencySession = {
  personId: 'person-1',
  userId: 'user-1',
  membershipId: 'mem-1',
  permissions: new Set(['agency.clients.view']),
  clientScope: 'all' as const,
  assignedClientIds: null,
};
```

**Factory functions:** Define `makeX(overrides)` locally per test file — not shared across files. Pattern is consistent but not abstracted into shared fixtures.

**Location:** Inline in test files — no separate `__fixtures__` or `test/fixtures/` directory.

## Coverage

**Requirements:** No enforced coverage threshold detected in config.

**View Coverage:**
```bash
pnpm test -- --coverage
```

## Test Types

**Unit Tests (`*.test.ts`):**
- Pure function behavior: routing logic, policy calculations, utility functions
- Route handler auth/error paths using mocked permission modules
- Agent state machine transitions using mock AI outputs
- All 312 tests are fully deterministic — no real I/O

**AI Eval Tests (`*.ai-test.ts`):**
- Send real prompts to Anthropic API (Haiku tier)
- Validate AI output quality/safety criteria (binary pass/fail)
- ~$0.01-0.05 per full run, 30-90 seconds
- Skipped automatically if `ANTHROPIC_API_KEY` not set
- Pre-launch quality gate — run before client-facing deployments
- Config: `vitest.ai.config.ts` with `testTimeout: 30_000`

**E2E Tests:** Not present.

**Integration Tests:** Not a formal category — route handler tests use real `NextRequest` objects with mocked DB/auth layers.

## Common Patterns

**Async testing:**
```typescript
it('returns 401 when not authenticated', async () => {
  mockRequireAgencyPermission.mockRejectedValue(
    new Error('Unauthorized: not authenticated')
  );
  const res = await route(makeRequest(), makeContext());
  expect(res.status).toBe(401);
  const body = await res.json() as { error: string };
  expect(body.error).toBe('Unauthorized');
});
```

**Error path testing:**
```typescript
it('returns 500 on generic error from handler', async () => {
  mockRequireAgencyPermission.mockResolvedValue(fakeAgencySession);
  const handler = vi.fn().mockRejectedValue(new Error('DB connection failed'));
  const route = adminRoute({ permission: 'agency.clients.view' as never }, handler);
  const res = await route(makeRequest(), makeContext());
  expect(res.status).toBe(500);
  const body = await res.json() as { error: string };
  expect(body.error).toBe('Internal server error');
});
```

**Parametric tests (for-loop):**
```typescript
const responseActions: AgentAction[] = ['respond', 'book_appointment', 'send_quote'];
for (const action of responseActions) {
  it(`routes "${action}" to respond`, () => {
    expect(routeAfterDecision(makeState({ lastAction: action }))).toBe('respond');
  });
}
```

**String content assertions (for prompt/message tests):**
```typescript
it('includes knowledge boundary rule with owner name', () => {
  const prompt = buildGuardrailPrompt(makeConfig());
  expect(prompt).toContain('Let me have Mike get back to you');
});
```

**Date assertions:**
```typescript
expect(effective.toISOString().slice(0, 10)).toBe('2026-03-26');
```

## AI Test Structure

**Skip guard pattern:**
```typescript
const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;
// Tests use `it.skipIf(!HAS_KEY)` or describe-level skip
```

**File-level comment block required** — all `.ai-test.ts` files must have a JSDoc block explaining cost, runtime, and what criteria are validated.

---

*Testing analysis: 2026-05-04*
