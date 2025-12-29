<p align="center">
  <img src="criterion.jpg" alt="Criterion" width="100%" />
</p>

<p align="center">
  <strong>A universal, deterministic, and explainable decision engine for business-critical systems.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@criterionx/core"><img src="https://img.shields.io/npm/v/@criterionx/core.svg" alt="npm version"></a>
  <a href="https://github.com/tomymaritano/criterion/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@criterionx/core.svg" alt="license"></a>
  <a href="https://tomymaritano.github.io/criterion/"><img src="https://img.shields.io/badge/docs-vitepress-brightgreen.svg" alt="docs"></a>
</p>

---

## Installation

```bash
npm install @criterionx/core zod
```

## Quick Start

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
      explain: (input, profile) => `Amount ${input.amount} > ${profile.threshold}`,
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
console.log(engine.explain(result));
// Decision: transaction-risk v1.0.0
// Status: OK
// Matched: high-risk
// Reason: Amount 15000 > 10000
```

## Features

- **Pure & Deterministic** — Same input always produces the same output
- **Fully Explainable** — Every decision includes a complete audit trail
- **Contract-First** — Zod schemas validate inputs, outputs, and profiles
- **Profile-Driven** — Parameterize decisions by region, tier, or environment
- **Zero Side Effects** — No I/O, no database, no external calls
- **Testable by Design** — Pure functions are trivial to test

## Documentation

Full documentation available at **[tomymaritano.github.io/criterion](https://tomymaritano.github.io/criterion/)**

- [Getting Started](https://tomymaritano.github.io/criterion/guide/getting-started)
- [Core Concepts](https://tomymaritano.github.io/criterion/guide/core-concepts)
- [API Reference](https://tomymaritano.github.io/criterion/api/engine)
- [Examples](https://tomymaritano.github.io/criterion/examples/currency-risk)

## Core Concepts

### Decisions

A decision is a unit of business logic with:
- **Input schema** — What data is required
- **Output schema** — What the decision returns
- **Profile schema** — What can be parameterized
- **Rules** — The evaluation logic

### Rules

Rules are evaluated in order. First match wins:

```typescript
rules: [
  { id: "rule-1", when: (i) => i.x > 100, emit: ..., explain: ... },
  { id: "rule-2", when: (i) => i.x > 50, emit: ..., explain: ... },
  { id: "default", when: () => true, emit: ..., explain: ... },
]
```

### Profiles

Profiles parameterize decisions without changing logic:

```typescript
// Same decision, different thresholds
engine.run(decision, input, { profile: usProfile });
engine.run(decision, input, { profile: euProfile });
```

## What Criterion Is NOT

- A workflow/BPMN engine
- A machine learning framework
- A data pipeline
- A plugin marketplace

Criterion is a **micro engine**: small core, strict boundaries.

## License

[MIT](LICENSE)

## Author

**Tomas Maritano** — [@tomymaritano](https://github.com/tomymaritano)
