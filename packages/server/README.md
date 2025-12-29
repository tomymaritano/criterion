# @criterionx/server

HTTP server for Criterion decisions with auto-generated documentation.

> **The server is a delivery mechanism, not a decision engine.**

## Installation

```bash
npm install @criterionx/server @criterionx/core zod
```

## Quick Start

```typescript
import { createServer } from "@criterionx/server";
import { defineDecision } from "@criterionx/core";
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

const server = createServer({
  decisions: [riskDecision],
  profiles: {
    "transaction-risk": { threshold: 10000 },
  },
});

server.listen(3000);
// Server running at http://localhost:3000
// Docs at http://localhost:3000/docs
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/docs` | Interactive documentation UI |
| GET | `/decisions` | List all registered decisions |
| GET | `/decisions/:id/schema` | JSON Schema for decision |
| POST | `/decisions/:id` | Evaluate a decision |

## API

### `createServer(options)`

Creates a new Criterion server.

```typescript
interface ServerOptions<TDecisions> {
  decisions: TDecisions[];
  profiles?: Record<string, unknown>;
  port?: number;
  cors?: boolean;
}
```

### POST `/decisions/:id`

Evaluate a decision with the given input.

**Request:**
```json
{
  "input": { "amount": 15000 },
  "profile": { "threshold": 10000 }
}
```

**Response:**
```json
{
  "status": "OK",
  "data": { "risk": "HIGH" },
  "meta": {
    "decisionId": "transaction-risk",
    "decisionVersion": "1.0.0",
    "matchedRule": "high-risk",
    "explanation": "Amount 15000 exceeds threshold 10000",
    "evaluatedAt": "2024-12-29T12:00:00.000Z"
  }
}
```

## Design Principles

1. **Server does NOT add decision logic** — only calls `engine.run()`
2. **Decisions are explicitly registered** — no auto-discovery
3. **UI cannot invent defaults** — shows exactly what's required
4. **JSON Schema is primary** — OpenAPI is derived

## Documentation

Full documentation: [https://tomymaritano.github.io/criterionx/](https://tomymaritano.github.io/criterionx/)

## License

MIT
