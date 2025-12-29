# Hello Decision

The simplest possible Criterion decision.

## The Decision

```ts
import { z } from "zod";
import { defineDecision, createRule, engine } from "criterion";

const helloDecision = defineDecision({
  id: "hello",
  version: "1.0.0",
  inputSchema: z.object({
    name: z.string()
  }),
  outputSchema: z.object({
    greeting: z.string()
  }),
  profileSchema: z.object({}),
  rules: [
    createRule({
      id: "greet",
      when: () => true,
      emit: (ctx) => ({ greeting: `Hello, ${ctx.name}!` }),
      explain: (ctx) => `Greeted ${ctx.name}`,
    }),
  ],
});
```

## Running It

```ts
const result = engine.run(
  helloDecision,
  { name: "World" },
  { profile: {} }
);

console.log(result);
// {
//   status: "OK",
//   data: { greeting: "Hello, World!" },
//   meta: {
//     decisionId: "hello",
//     decisionVersion: "1.0.0",
//     matchedRule: "greet",
//     explanation: "Greeted World",
//     evaluatedRules: [{ ruleId: "greet", matched: true, explanation: "Greeted World" }],
//     evaluatedAt: "2024-..."
//   }
// }
```

## Key Points

1. **One rule** — The simplest decision has one rule
2. **Catch-all** — `when: () => true` always matches
3. **No profile** — Empty profile schema when not needed
4. **Explainable** — Every rule explains itself

## What This Demonstrates

- Decisions are pure functions
- Results are structured and predictable
- Every evaluation produces a trace
- The engine is deterministic
