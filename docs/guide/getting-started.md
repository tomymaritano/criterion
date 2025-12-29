# Getting Started

## Installation

::: code-group

```bash [npm]
npm install @criterionx/core zod
```

```bash [yarn]
yarn add @criterionx/core zod
```

```bash [pnpm]
pnpm add @criterionx/core zod
```

:::

Criterion requires [Zod](https://zod.dev) as a peer dependency for schema validation.

## Your First Decision

Let's create a simple risk assessment decision that classifies transactions based on their amount.

### 1. Define the Schemas

First, define what data your decision needs:

```typescript
import { z } from "zod";

// Input: the data we receive
const inputSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

// Output: what we return
const outputSchema = z.object({
  risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string(),
});

// Profile: parameters that can vary by context
const profileSchema = z.object({
  highThreshold: z.number(),
  mediumThreshold: z.number(),
});
```

### 2. Define the Decision

Now create the decision with its rules:

```typescript
import { defineDecision } from "@criterionx/core";

const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "high-risk",
      when: (input, profile) => input.amount > profile.highThreshold,
      emit: () => ({ risk: "HIGH", reason: "Amount exceeds high threshold" }),
      explain: (input, profile) =>
        `Amount ${input.amount} > ${profile.highThreshold}`,
    },
    {
      id: "medium-risk",
      when: (input, profile) => input.amount > profile.mediumThreshold,
      emit: () => ({ risk: "MEDIUM", reason: "Amount exceeds medium threshold" }),
      explain: (input, profile) =>
        `Amount ${input.amount} > ${profile.mediumThreshold}`,
    },
    {
      id: "low-risk",
      when: () => true,  // Catch-all rule
      emit: () => ({ risk: "LOW", reason: "Amount within acceptable range" }),
      explain: () => "Default: amount within limits",
    },
  ],
});
```

### 3. Run the Decision

Create an engine and run the decision:

```typescript
import { Engine } from "@criterionx/core";

const engine = new Engine();

const result = engine.run(
  riskDecision,
  { amount: 7500, currency: "USD" },
  { profile: { highThreshold: 10000, mediumThreshold: 5000 } }
);
```

### 4. Inspect the Result

The result contains the decision outcome and full audit trail:

```typescript
console.log(result);
// {
//   status: "OK",
//   data: { risk: "MEDIUM", reason: "Amount exceeds medium threshold" },
//   meta: {
//     decisionId: "transaction-risk",
//     decisionVersion: "1.0.0",
//     matchedRule: "medium-risk",
//     evaluatedRules: [
//       { ruleId: "high-risk", matched: false },
//       { ruleId: "medium-risk", matched: true, explanation: "Amount 7500 > 5000" }
//     ],
//     explanation: "Amount 7500 > 5000",
//     evaluatedAt: "2024-01-15T10:30:00.000Z"
//   }
// }
```

### 5. Get Human-Readable Explanation

Use the `explain` method for a formatted summary:

```typescript
console.log(engine.explain(result));
// Decision: transaction-risk v1.0.0
// Status: OK
// Matched: medium-risk
// Reason: Amount 7500 > 5000
//
// Evaluation trace:
//   ✗ high-risk
//   ✓ medium-risk
```

## Complete Example

Here's the full code:

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

// Schemas
const inputSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const outputSchema = z.object({
  risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string(),
});

const profileSchema = z.object({
  highThreshold: z.number(),
  mediumThreshold: z.number(),
});

// Decision
const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "high-risk",
      when: (input, profile) => input.amount > profile.highThreshold,
      emit: () => ({ risk: "HIGH", reason: "Amount exceeds high threshold" }),
      explain: (input, profile) =>
        `Amount ${input.amount} > ${profile.highThreshold}`,
    },
    {
      id: "medium-risk",
      when: (input, profile) => input.amount > profile.mediumThreshold,
      emit: () => ({ risk: "MEDIUM", reason: "Amount exceeds medium threshold" }),
      explain: (input, profile) =>
        `Amount ${input.amount} > ${profile.mediumThreshold}`,
    },
    {
      id: "low-risk",
      when: () => true,
      emit: () => ({ risk: "LOW", reason: "Amount within acceptable range" }),
      explain: () => "Default: amount within limits",
    },
  ],
});

// Run
const engine = new Engine();
const result = engine.run(
  riskDecision,
  { amount: 7500, currency: "USD" },
  { profile: { highThreshold: 10000, mediumThreshold: 5000 } }
);

console.log(result.data);           // { risk: "MEDIUM", ... }
console.log(engine.explain(result)); // Formatted explanation
```

## Next Steps

- [Core Concepts](/guide/core-concepts) - Understand decisions, rules, and profiles
- [Profiles](/guide/profiles) - Learn about profile-driven parameterization
- [Examples](/examples/currency-risk) - See real-world use cases
