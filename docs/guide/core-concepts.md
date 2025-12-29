# Core Concepts

Criterion is built around four core concepts: **Decisions**, **Rules**, **Profiles**, and the **Engine**.

## Decisions

A **Decision** is the top-level unit. It represents a single business question with a defined structure:

```typescript
interface Decision<TInput, TOutput, TProfile> {
  id: string;                          // Unique identifier
  version: string;                     // Semantic version
  inputSchema: ZodSchema<TInput>;      // What data we need
  outputSchema: ZodSchema<TOutput>;    // What we return
  profileSchema: ZodSchema<TProfile>;  // What can be parameterized
  rules: Rule<TInput, TProfile, TOutput>[];  // The logic
  meta?: DecisionMeta;                 // Optional metadata
}
```

Example:

```typescript
const approvalDecision = defineDecision({
  id: "loan-approval",
  version: "2.1.0",
  inputSchema: z.object({
    applicantAge: z.number(),
    creditScore: z.number(),
    requestedAmount: z.number(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    reason: z.string(),
  }),
  profileSchema: z.object({
    minAge: z.number(),
    minCreditScore: z.number(),
    maxAmount: z.number(),
  }),
  rules: [/* ... */],
  meta: {
    owner: "risk-team",
    tags: ["lending", "compliance"],
  },
});
```

## Rules

A **Rule** defines a condition and its outcome:

```typescript
interface Rule<TContext, TProfile, TOutput> {
  id: string;                                           // Unique within decision
  when: (context: TContext, profile: TProfile) => boolean;  // Condition
  emit: (context: TContext, profile: TProfile) => TOutput;  // Output if matched
  explain: (context: TContext, profile: TProfile) => string; // Why it matched
}
```

Rules are evaluated in order. The first rule where `when()` returns `true` wins:

```typescript
rules: [
  {
    id: "reject-low-score",
    when: (input, profile) => input.creditScore < profile.minCreditScore,
    emit: () => ({ approved: false, reason: "Credit score too low" }),
    explain: (input, profile) =>
      `Credit score ${input.creditScore} < minimum ${profile.minCreditScore}`,
  },
  {
    id: "reject-high-amount",
    when: (input, profile) => input.requestedAmount > profile.maxAmount,
    emit: () => ({ approved: false, reason: "Amount exceeds limit" }),
    explain: (input, profile) =>
      `Requested ${input.requestedAmount} > maximum ${profile.maxAmount}`,
  },
  {
    id: "approve",
    when: () => true,  // Catch-all
    emit: () => ({ approved: true, reason: "All criteria met" }),
    explain: () => "All validation checks passed",
  },
]
```

::: warning Important
Always include a catch-all rule with `when: () => true` as the last rule. Otherwise, you may get a `NO_MATCH` result.
:::

## Profiles

A **Profile** contains the parameters that can vary without changing the decision logic:

```typescript
// Same decision, different profiles
const usProfile = {
  minAge: 18,
  minCreditScore: 650,
  maxAmount: 50000,
};

const euProfile = {
  minAge: 21,
  minCreditScore: 600,
  maxAmount: 40000,
};

// Run with US profile
engine.run(decision, input, { profile: usProfile });

// Run with EU profile
engine.run(decision, input, { profile: euProfile });
```

Profiles enable:
- **Regional variations** - Different thresholds per country
- **Tier-based logic** - Premium vs standard customers
- **Environment-specific settings** - Stricter rules in production
- **A/B testing** - Compare different parameter sets

## Engine

The **Engine** evaluates decisions:

```typescript
const engine = new Engine();

// Run a decision
const result = engine.run(decision, input, { profile });

// Get human-readable explanation
const explanation = engine.explain(result);
```

The engine:
1. Validates input against `inputSchema`
2. Validates profile against `profileSchema`
3. Evaluates rules in order until one matches
4. Validates output against `outputSchema`
5. Returns a structured result with full trace

## Result

Every decision returns a **Result**:

```typescript
interface Result<TOutput> {
  status: "OK" | "NO_MATCH" | "INVALID_INPUT" | "INVALID_OUTPUT";
  data: TOutput | null;
  meta: {
    decisionId: string;
    decisionVersion: string;
    matchedRule?: string;
    evaluatedRules: Array<{
      ruleId: string;
      matched: boolean;
      explanation?: string;
    }>;
    explanation: string;
    evaluatedAt: string;
  };
}
```

Status codes:
- **OK** - A rule matched and output is valid
- **NO_MATCH** - No rule's `when()` returned true
- **INVALID_INPUT** - Input failed schema validation
- **INVALID_OUTPUT** - Output failed schema validation (bug in rule)

## Data Flow

```
Input + Profile
      │
      ▼
┌─────────────┐
│  Validate   │  ─── INVALID_INPUT if fails
│   Input     │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Validate   │  ─── INVALID_INPUT if fails
│   Profile   │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Evaluate   │  ─── NO_MATCH if no rule matches
│   Rules     │
└─────────────┘
      │
      ▼
┌─────────────┐
│  Validate   │  ─── INVALID_OUTPUT if fails
│   Output    │
└─────────────┘
      │
      ▼
   Result
```

## Next Steps

- [Decisions](/guide/decisions) - Deep dive into decision structure
- [Rules](/guide/rules) - Advanced rule patterns
- [Profiles](/guide/profiles) - Profile strategies and registry
