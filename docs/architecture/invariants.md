# Invariants (Non-negotiables)

These invariants define what Criterion **is**.
Violating any of them breaks the contract with users.

---

## 1) Determinism

### Definition

Given the same inputs, Criterion produces the same output. Always.

```
f(decision, context, profile) = result
```

If `decision`, `context`, and `profile` are identical, `result` is identical.
No exceptions. No "it depends". No probabilistic outcomes.

### Why It Matters

- **Auditable**: You can replay any decision and get the same answer
- **Testable**: Unit tests are reliable
- **Debuggable**: Reproduce issues exactly
- **Trustworthy**: Business logic you can stake money on

### Correct Example

```typescript
const rule = {
  id: "high-value-order",
  when: (ctx, profile) => ctx.amount > profile.threshold,
  emit: () => ({ tier: "premium" }),
  explain: (ctx, profile) =>
    `Order ${ctx.amount} exceeds threshold ${profile.threshold}`
};
```

The same `ctx.amount` and `profile.threshold` always produce the same result.

### Violation Example

```typescript
// FORBIDDEN: Non-deterministic rule
const rule = {
  id: "time-based",
  when: (ctx) => {
    const hour = new Date().getHours(); // Non-deterministic!
    return hour >= 9 && hour < 17;
  },
  emit: () => ({ available: true }),
  explain: () => "Within business hours"
};
```

This rule produces different results depending on when it runs.

### How to Fix

Inject time as context, not as runtime computation:

```typescript
// CORRECT: Time injected as context
const rule = {
  id: "business-hours",
  when: (ctx) => ctx.currentHour >= 9 && ctx.currentHour < 17,
  emit: () => ({ available: true }),
  explain: (ctx) => `Hour ${ctx.currentHour} is within business hours (9-17)`
};

// Caller provides the time
engine.run(decision, { currentHour: 14, ...otherContext }, { profile });
```

### Runtime Metadata Exception

Non-deterministic metadata (e.g., `evaluatedAt`) is allowed ONLY in runtime fields
and MUST NOT affect `status`, `data`, or `explanation`.

| Field | Deterministic? |
|-------|----------------|
| `result.status` | Yes |
| `result.data` | Yes |
| `result.meta.matchedRule` | Yes |
| `result.meta.explanation` | Yes |
| `result.meta.evaluatedRules` | Yes |
| `result.meta.evaluatedAt` | No (runtime timestamp) |

The timestamp exists for logging/auditing, not for decision logic.

### Test

```typescript
it("produces identical results for identical inputs", () => {
  const result1 = engine.run(decision, context, { profile });
  const result2 = engine.run(decision, context, { profile });

  // Core decision output is deterministic
  expect(result1.status).toBe(result2.status);
  expect(result1.data).toEqual(result2.data);
  expect(result1.meta.matchedRule).toBe(result2.meta.matchedRule);
  expect(result1.meta.explanation).toBe(result2.meta.explanation);

  // evaluatedAt is runtime metadata, allowed to differ
});
```

### Forbidden Constructs

| Construct | Why Forbidden | Alternative |
|-----------|---------------|-------------|
| `Date.now()` | Time varies | Inject `timestamp` in context |
| `Math.random()` | Random varies | Inject `seed` or pre-computed value |
| `process.env` | Environment varies | Inject config in profile |
| `fetch()` | Network varies | Resolve before calling engine |
| Global mutable state | State varies | Pass all data as context |

---

## 2) Pure Core

### Definition

The engine performs **zero side effects**. It is a pure function:

- No database reads or writes
- No network calls
- No filesystem access
- No environment variable access
- No logging with side effects
- No mutation of inputs

The engine receives data and returns data. That's it.

### Why It Matters

- **Portable**: Runs anywhere (browser, Node, edge, serverless)
- **Testable**: No mocks needed for external systems
- **Fast**: No I/O latency
- **Predictable**: Output depends only on input

### Correct Example

```typescript
// All data is passed in, nothing is fetched
const decision = defineDecision({
  id: "loan-eligibility",
  version: "1.0.0",
  inputSchema: z.object({
    creditScore: z.number(),
    income: z.number(),
    existingDebt: z.number(),
  }),
  profileSchema: z.object({
    minCreditScore: z.number(),
    maxDebtToIncomeRatio: z.number(),
  }),
  outputSchema: z.object({ eligible: z.boolean(), reason: z.string() }),
  rules: [/* pure rules */],
});

// Caller resolves all data BEFORE calling engine
const creditScore = await fetchCreditScore(userId);
const income = await fetchIncome(userId);
const profile = await loadProfile("standard");

// Engine receives materialized data
const result = engine.run(decision, { creditScore, income, existingDebt }, { profile });
```

### Violation Example

```typescript
// FORBIDDEN: Fetching inside a rule
const rule = {
  id: "check-balance",
  when: async (ctx) => {
    const balance = await db.getBalance(ctx.userId); // Side effect!
    return balance > ctx.amount;
  },
  emit: () => ({ approved: true }),
  explain: () => "Sufficient balance"
};
```

### Boundary

The purity boundary is the engine. Everything inside is pure.
Everything outside (data fetching, profile resolution) can be impure.

```
[Impure World] → [Pure Engine] → [Impure World]
     ↓                ↓                ↓
  fetch data    evaluate rules    store result
```

### Test

```typescript
it("engine has no dependencies on external systems", () => {
  // This test runs without any database, network, or filesystem
  // If it requires mocks, the engine is impure
  const result = engine.run(decision, context, { profile });
  expect(result.status).toBe("OK");
});
```

---

## 3) Contracts Mandatory

### Definition

All inputs and outputs are validated against schemas. Always.

- Input context is validated before rule evaluation
- Profile is validated before rule evaluation
- Output is validated after rule produces it

No unvalidated data enters or exits the engine.

### Why It Matters

- **Fail fast**: Invalid data caught immediately
- **Self-documenting**: Schemas are the contract
- **Defensive**: Rules can trust their inputs
- **Debuggable**: Validation errors are explicit

### Structured Errors, Never Exceptions

Schema violations MUST result in a structured decision result (`INVALID_INPUT` or `INVALID_OUTPUT`),
never an uncaught exception.

```typescript
// Engine ALWAYS returns a Result, even for invalid input
const result = engine.run(decision, invalidContext, { profile });

// This is a structured error, NOT a thrown exception
expect(result.status).toBe("INVALID_INPUT");
expect(result.data).toBeNull();
expect(result.meta.explanation).toContain("validation failed");
```

This guarantees:
- Callers can handle all outcomes uniformly
- No try/catch needed around engine calls
- Errors are part of the decision contract, not exceptional crashes

### Correct Example

```typescript
const decision = defineDecision({
  id: "pricing",
  version: "1.0.0",
  inputSchema: z.object({
    quantity: z.number().int().positive(),
    customerType: z.enum(["retail", "wholesale"]),
  }),
  profileSchema: z.object({
    retailMarkup: z.number().min(0).max(1),
    wholesaleDiscount: z.number().min(0).max(1),
  }),
  outputSchema: z.object({
    priceMultiplier: z.number().positive(),
  }),
  rules: [/* rules */],
});
```

Schema violations produce explicit errors:

```typescript
const result = engine.run(
  decision,
  { quantity: -5, customerType: "retail" }, // Invalid: negative quantity
  { profile }
);

// result.status === "INVALID_INPUT"
// result.meta.explanation === "Input validation failed: quantity: Number must be greater than 0"
```

### Violation Example

```typescript
// FORBIDDEN: Trusting unvalidated input
const rule = {
  id: "calculate-total",
  when: () => true,
  emit: (ctx) => ({
    total: ctx.items.reduce((sum, i) => sum + i.price, 0) // What if items is undefined?
  }),
  explain: () => "Calculated total"
};
```

### Test

```typescript
it("rejects invalid input", () => {
  const result = engine.run(
    decision,
    { quantity: "not a number" }, // Wrong type
    { profile }
  );
  expect(result.status).toBe("INVALID_INPUT");
});

it("rejects invalid profile", () => {
  const result = engine.run(
    decision,
    context,
    { profile: { retailMarkup: 2 } } // Exceeds max of 1
  );
  expect(result.status).toBe("INVALID_INPUT");
});

it("rejects invalid output", () => {
  // If a rule emits invalid output, the engine catches it
  const result = engine.run(brokenDecision, context, { profile });
  expect(result.status).toBe("INVALID_OUTPUT");
});
```

---

## 4) Explainability First-Class

### Definition

Every decision result includes a complete explanation of:

1. Which rule matched (or why none matched)
2. Why that rule matched (human-readable)
3. The trace of all evaluated rules

Explainability is not optional. It's part of the result structure.

### Why It Matters

- **Auditability**: Regulators can inspect decision logic
- **Debugging**: Developers understand failures
- **Trust**: Users know why they got a result
- **Compliance**: Required for many industries (finance, insurance, healthcare)

### Correct Example

```typescript
const rule = {
  id: "premium-tier",
  when: (ctx, profile) => ctx.totalSpend > profile.premiumThreshold,
  emit: () => ({ tier: "premium", discount: 0.2 }),
  explain: (ctx, profile) =>
    `Customer total spend ($${ctx.totalSpend}) exceeds premium threshold ($${profile.premiumThreshold})`
};
```

Result includes full trace:

```typescript
{
  status: "OK",
  data: { tier: "premium", discount: 0.2 },
  meta: {
    decisionId: "customer-tier",
    decisionVersion: "1.0.0",
    matchedRule: "premium-tier",
    explanation: "Customer total spend ($15000) exceeds premium threshold ($10000)",
    evaluatedRules: [
      { ruleId: "vip-tier", matched: false },
      { ruleId: "premium-tier", matched: true, explanation: "Customer total spend ($15000)..." },
    ],
    evaluatedAt: "2024-01-15T10:30:00.000Z"
  }
}
```

### Violation Example

```typescript
// FORBIDDEN: Non-descriptive explanation
const rule = {
  id: "some-rule",
  when: (ctx) => ctx.value > 100,
  emit: () => ({ approved: true }),
  explain: () => "Rule matched" // Useless explanation
};

// FORBIDDEN: Explanation doesn't reflect actual logic
const rule = {
  id: "another-rule",
  when: (ctx) => ctx.score > 700 && ctx.income > 50000,
  emit: () => ({ approved: true }),
  explain: () => "Credit check passed" // Doesn't mention score or income thresholds
};
```

### Correct Explanation Pattern

```typescript
const rule = {
  id: "credit-approved",
  when: (ctx, profile) =>
    ctx.creditScore >= profile.minScore &&
    ctx.income >= profile.minIncome,
  emit: () => ({ approved: true }),
  explain: (ctx, profile) =>
    `Credit score ${ctx.creditScore} >= ${profile.minScore} AND ` +
    `income $${ctx.income} >= $${profile.minIncome}`
};
```

### NO_MATCH Must Explain Why

For `NO_MATCH` results, the explanation MUST state **why** no rule matched,
not just that none did.

```typescript
// BAD: Useless NO_MATCH explanation
explanation: "No rule matched the given context"

// GOOD: Explains what conditions failed
explanation: "No eligibility rule matched: credit score 580 < minimum 600, income $35000 < minimum $50000"
```

This is critical for compliance and debugging. Callers must be able to understand
what would need to change for a rule to match.

### Test

```typescript
it("provides meaningful explanation", () => {
  const result = engine.run(decision, context, { profile });

  expect(result.meta.explanation).toBeTruthy();
  expect(result.meta.explanation).not.toBe("Rule matched");
  expect(result.meta.evaluatedRules.length).toBeGreaterThan(0);
});

it("explanation reflects actual values", () => {
  const result = engine.run(
    decision,
    { amount: 500, ...context },
    { profile }
  );

  // Explanation should mention the actual values used
  expect(result.meta.explanation).toContain("500");
});
```

---

## 5) Total Classification

### Definition

For classification decisions, every valid input must match exactly one rule.
`NO_MATCH` should only occur for inputs that fail validation.

This is achieved by always including a catch-all rule as the final rule.

### Why It Matters

- **No undefined behavior**: Every input produces a defined output
- **Explicit defaults**: The fallback is a conscious design choice
- **Auditability**: You can explain why any input got its classification

### Correct Example

```typescript
const decision = defineDecision({
  id: "risk-classification",
  version: "1.0.0",
  inputSchema: z.object({ score: z.number() }),
  profileSchema: z.object({
    highThreshold: z.number(),
    mediumThreshold: z.number(),
  }),
  outputSchema: z.object({
    level: z.enum(["high", "medium", "low"]),
  }),
  rules: [
    {
      id: "high-risk",
      when: (ctx, profile) => ctx.score >= profile.highThreshold,
      emit: () => ({ level: "high" }),
      explain: (ctx, profile) => `Score ${ctx.score} >= high threshold ${profile.highThreshold}`,
    },
    {
      id: "medium-risk",
      when: (ctx, profile) => ctx.score >= profile.mediumThreshold,
      emit: () => ({ level: "medium" }),
      explain: (ctx, profile) => `Score ${ctx.score} >= medium threshold ${profile.mediumThreshold}`,
    },
    {
      id: "low-risk",
      when: () => true, // Catch-all
      emit: () => ({ level: "low" }),
      explain: (ctx, profile) => `Score ${ctx.score} below medium threshold ${profile.mediumThreshold}`,
    },
  ],
});
```

### Violation Example

```typescript
// FORBIDDEN: No catch-all, can produce NO_MATCH
const decision = defineDecision({
  rules: [
    {
      id: "high-risk",
      when: (ctx) => ctx.score >= 80,
      emit: () => ({ level: "high" }),
      explain: () => "High risk",
    },
    {
      id: "medium-risk",
      when: (ctx) => ctx.score >= 50,
      emit: () => ({ level: "medium" }),
      explain: () => "Medium risk",
    },
    // Missing catch-all! What happens when score < 50?
  ],
});

// This returns NO_MATCH, which is a design error
const result = engine.run(decision, { score: 30 }, { profile });
// result.status === "NO_MATCH" -- BAD!
```

### Exception: Non-Classification Decisions

Some decisions legitimately have no catch-all:

- **Eligibility checks**: "Is this user eligible for X?" - No match means not eligible
- **Matching systems**: "Which promotion applies?" - No match means no promotion

For these, `NO_MATCH` is a valid business outcome, but it should be handled explicitly in the caller:

```typescript
const result = engine.run(eligibilityDecision, context, { profile });
if (result.status === "NO_MATCH") {
  return { eligible: false, reason: "Does not meet any eligibility criteria" };
}
```

### Test

```typescript
describe("total classification", () => {
  it("always produces a classification for valid input", () => {
    const testCases = [
      { score: 100 },  // High
      { score: 75 },   // High
      { score: 50 },   // Medium
      { score: 25 },   // Low
      { score: 0 },    // Low
      { score: -10 },  // Low (if schema allows)
    ];

    for (const ctx of testCases) {
      const result = engine.run(decision, ctx, { profile });
      expect(result.status).toBe("OK");
      expect(result.data?.level).toBeDefined();
    }
  });
});
```

---

## Secondary Invariants

The following invariants are also non-negotiable but less frequently violated:

### 6) Opinionated by Design

Some patterns are explicitly forbidden. Minimal API surface is a feature, not a limitation.

### 7) Small Core

The engine must remain small. If it grows rapidly, the design is wrong.

### 8) No Dead Inputs

Every input field must participate in at least one rule. Unused inputs indicate design error.

### 9) External Profile Resolution

Profiles are resolved outside the engine. The engine receives materialized profile values, never profile IDs that need lookup.

### 10) Single Source of Truth

`Result.meta` is the only source of explanation data. Helper methods like `engine.explain()` are formatters, not data sources.

---

## Enforcement

These invariants are enforced through:

1. **Type system**: TypeScript catches many violations at compile time
2. **Runtime validation**: Zod schemas validate all inputs/outputs
3. **Code review**: Human review for semantic violations
4. **Tests**: Unit tests verify behavior

When in doubt, ask: "Does this change preserve all invariants?"

If the answer is no, the change does not belong in Criterion.
