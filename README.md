<p align="center">
  <img src="criterion.jpg" alt="Criterion" width="100%" />
</p>

<p align="center">
  <strong>A universal, deterministic, and explainable decision engine for business-critical systems.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@criterionx/core"><img src="https://img.shields.io/npm/v/@criterionx/core.svg?label=@criterionx/core" alt="core version"></a>
  <a href="https://www.npmjs.com/package/@criterionx/server"><img src="https://img.shields.io/npm/v/@criterionx/server.svg?label=@criterionx/server" alt="server version"></a>
  <a href="https://www.npmjs.com/package/@criterionx/react"><img src="https://img.shields.io/npm/v/@criterionx/react.svg?label=@criterionx/react" alt="react version"></a>
  <a href="https://github.com/tomymaritano/criterionx/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@criterionx/core.svg" alt="license"></a>
  <a href="https://tomymaritano.github.io/criterionx/"><img src="https://img.shields.io/badge/docs-vitepress-brightgreen.svg" alt="docs"></a>
</p>

---

## What is Criterion?

Criterion helps you encode business decisions as **pure, testable functions** with built-in validation and explainability.

Instead of scattering `if/else` statements across your codebase, you define decisions declaratively:

- **"Should this transaction be flagged as high-risk?"**
- **"Is this user eligible for a premium tier?"**
- **"What discount applies to this order?"**

Every decision returns not just a result, but a complete explanation of *why* that result was reached — perfect for audits, debugging, and compliance.

## Packages

### Core

| Package | Description |
|---------|-------------|
| [@criterionx/core](./packages/core) | Pure decision engine — no I/O, no side effects |
| [@criterionx/server](./packages/server) | HTTP server with auto-generated docs, rate limiting |

### Integrations

| Package | Description |
|---------|-------------|
| [@criterionx/react](./packages/react) | React hooks (`useDecision`, `CriterionProvider`) |
| [@criterionx/express](./packages/express) | Express & Fastify middleware |
| [@criterionx/trpc](./packages/trpc) | tRPC procedures with full type safety |

### Tools

| Package | Description |
|---------|-------------|
| [@criterionx/opentelemetry](./packages/opentelemetry) | Tracing & metrics instrumentation |
| [@criterionx/generators](./packages/generators) | Generate decisions from declarative specs |
| [@criterionx/testing](./packages/testing) | Test utilities and mocks |
| [@criterionx/devtools](./packages/devtools) | Debug and inspect decisions |
| [@criterionx/cli](./packages/cli) | Command-line interface |
| [@criterionx/mcp](./packages/mcp) | Model Context Protocol server for LLMs |

## Installation

```bash
# Core engine only
npm install @criterionx/core zod

# With HTTP server
npm install @criterionx/server zod

# React integration
npm install @criterionx/react @criterionx/core

# Express/Fastify middleware
npm install @criterionx/express @criterionx/core

# tRPC integration
npm install @criterionx/trpc @criterionx/core @trpc/server
```

## Quick Start

### Using the Core Engine

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

### Using React Hooks

```tsx
import { CriterionProvider, useDecision } from "@criterionx/react";

function App() {
  return (
    <CriterionProvider
      decisions={[riskDecision]}
      profiles={{ "transaction-risk": { threshold: 10000 } }}
    >
      <RiskChecker />
    </CriterionProvider>
  );
}

function RiskChecker() {
  const { result, evaluate } = useDecision("transaction-risk");

  return (
    <button onClick={() => evaluate({ amount: 15000 })}>
      Check Risk: {result?.data?.risk ?? "—"}
    </button>
  );
}
```

### Using Express Middleware

```typescript
import express from "express";
import { createDecisionRouter } from "@criterionx/express";

const app = express();
app.use(express.json());
app.use("/api/decisions", createDecisionRouter({
  decisions: [riskDecision],
  profiles: { "transaction-risk": { threshold: 10000 } },
}));

app.listen(3000);
// POST /api/decisions/transaction-risk
```

### Using the HTTP Server

```typescript
import { createServer } from "@criterionx/server";

const server = createServer({
  decisions: [riskDecision],
  profiles: { "transaction-risk": { threshold: 10000 } },
});

server.listen(3000);
// Server running at http://localhost:3000
// Docs at http://localhost:3000/docs
```

## Features

- **Pure & Deterministic** — Same input always produces the same output
- **Fully Explainable** — Every decision includes a complete audit trail
- **Contract-First** — Zod schemas validate inputs, outputs, and profiles
- **Profile-Driven** — Parameterize decisions by region, tier, or environment
- **Zero Side Effects** — No I/O, no database, no external calls
- **Testable by Design** — Pure functions are trivial to test
- **Framework Agnostic** — Works with React, Express, Fastify, tRPC, and more
- **Observable** — OpenTelemetry integration for tracing and metrics

## Documentation

Full documentation available at **[tomymaritano.github.io/criterionx](https://tomymaritano.github.io/criterionx/)**

- [Getting Started](https://tomymaritano.github.io/criterionx/guide/getting-started)
- [Core Concepts](https://tomymaritano.github.io/criterionx/guide/core-concepts)
- [HTTP Server](https://tomymaritano.github.io/criterionx/guide/server)
- [API Reference](https://tomymaritano.github.io/criterionx/api/engine)
- [React Integration](https://tomymaritano.github.io/criterionx/api/react)
- [Express/Fastify](https://tomymaritano.github.io/criterionx/api/express)
- [Examples](https://tomymaritano.github.io/criterionx/examples/currency-risk)

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
