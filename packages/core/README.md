# @criterionx/core

Universal decision engine for business-critical decisions.

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
  outputSchema: z.object({ risk: z.enum(["HIGH", "LOW"]) }),
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

console.log(result.data); // { risk: "HIGH" }
```

---

## Architectural Invariants

> **This package is HTTP-agnostic. It must never depend on server concerns.**

### Non-Negotiable Principles

1. **Pure and Deterministic**
   - Same input + same profile = same output, always
   - No hidden state, no side effects

2. **No I/O in Rules**
   - Rules cannot fetch data
   - Rules cannot make network calls
   - Rules cannot read from filesystem
   - All data must be passed in as context

3. **Explicit Dependencies**
   - No auto-discovery
   - No magic imports
   - Decisions are explicitly passed to consumers

4. **Validation at Boundaries**
   - Input validated via Zod schema
   - Output validated via Zod schema
   - Profile validated via Zod schema

5. **Explainability**
   - Every rule has an `explain` function
   - Every result includes full audit trace

### What This Package Does NOT Do

- HTTP/REST handling (use `@criterionx/server`)
- Database operations
- File system access
- Network requests
- Caching
- Authentication/Authorization

This is intentional. The core is a knife, not a Swiss Army knife.

---

## Documentation

Full documentation: [https://tomymaritano.github.io/criterionx/](https://tomymaritano.github.io/criterionx/)

## License

MIT
