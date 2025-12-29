---
layout: home

hero:
  name: Criterion
  text: Decision Engine
  tagline: Universal, deterministic, and explainable decisions for business-critical systems
  image:
    src: /isologo.svg
    alt: Criterion
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: Try it Now
      link: /guide/playground
    - theme: alt
      text: GitHub
      link: https://github.com/tomymaritano/criterionx

features:
  - icon: 🎯
    title: Pure & Deterministic
    details: Same input always produces the same output. No hidden state, no side effects, no surprises.
  - icon: 📋
    title: Fully Explainable
    details: Every decision comes with a complete audit trail. Know exactly which rule matched and why.
  - icon: 🔒
    title: Contract-First
    details: Zod schemas validate inputs, outputs, and profiles. Catch errors before they happen.
  - icon: ⚡
    title: Profile-Driven
    details: Parameterize decisions by region, tier, or environment without changing logic.
  - icon: 🧪
    title: Testable by Design
    details: Pure functions are easy to test. No mocks, no stubs, just inputs and outputs.
  - icon: 📦
    title: Zero Dependencies
    details: Only requires Zod as a peer dependency. Lightweight and focused.
---

## Quick Example

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.object({ risk: z.enum(["HIGH", "MEDIUM", "LOW"]) }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    {
      id: "high-risk",
      when: (input, profile) => input.amount > profile.threshold,
      emit: () => ({ risk: "HIGH" }),
      explain: (input, profile) =>
        `Amount ${input.amount} exceeds threshold ${profile.threshold}`,
    },
    {
      id: "low-risk",
      when: () => true,
      emit: () => ({ risk: "LOW" }),
      explain: () => "Amount within acceptable range",
    },
  ],
});

const engine = new Engine();
const result = engine.run(
  riskDecision,
  { amount: 15000 },
  { profile: { threshold: 10000 } }
);

console.log(result.data);  // { risk: "HIGH" }
console.log(result.meta.explanation);  // "Amount 15000 exceeds threshold 10000"
```
