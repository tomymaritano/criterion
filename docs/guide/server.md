# Server

The `@criterionx/server` package exposes your decisions as HTTP endpoints with auto-generated documentation.

> **The server is a delivery mechanism, not a decision engine.**

## Installation

```bash
npm install @criterionx/server @criterionx/core zod
# or
pnpm add @criterionx/server @criterionx/core zod
```

## Quick Start

```typescript
import { createServer } from "@criterionx/server";
import { defineDecision } from "@criterionx/core";
import { z } from "zod";

// Define your decision
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

// Create and start server
const server = createServer({
  decisions: [riskDecision],
  profiles: {
    "transaction-risk": { threshold: 10000 },
  },
});

server.listen(3000);
```

Visit:
- `http://localhost:3000` - Health check
- `http://localhost:3000/docs` - Interactive documentation
- `http://localhost:3000/decisions` - List all decisions

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check with server info |
| GET | `/docs` | Interactive documentation UI |
| GET | `/decisions` | List all registered decisions |
| GET | `/decisions/:id/schema` | JSON Schema for a decision |
| GET | `/decisions/:id/endpoint-schema` | Request/response schema |
| POST | `/decisions/:id` | Evaluate a decision |

## Evaluating Decisions

### Request

```bash
curl -X POST http://localhost:3000/decisions/transaction-risk \
  -H "Content-Type: application/json" \
  -d '{"input": {"amount": 15000}}'
```

The request body accepts:

```typescript
{
  "input": { ... },     // Required: input data for the decision
  "profile": { ... }    // Optional: override the default profile
}
```

### Response

```json
{
  "status": "OK",
  "data": { "risk": "HIGH" },
  "meta": {
    "decisionId": "transaction-risk",
    "decisionVersion": "1.0.0",
    "matchedRule": "high-risk",
    "explanation": "Amount 15000 exceeds threshold 10000",
    "evaluatedAt": "2024-12-29T12:00:00.000Z",
    "evaluatedRules": [
      { "ruleId": "high-risk", "matched": true, "explanation": "..." }
    ]
  }
}
```

### Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Decision evaluated successfully |
| 400 | Invalid input, missing profile, or validation error |
| 404 | Decision not found |

## Configuration

```typescript
const server = createServer({
  // Required: array of decisions to expose
  decisions: [decision1, decision2],

  // Optional: default profiles by decision ID
  profiles: {
    "decision-1": { ... },
    "decision-2": { ... },
  },

  // Optional: enable/disable CORS (default: true)
  cors: true,
});
```

## Interactive Documentation

The `/docs` endpoint provides a Swagger-like UI where you can:

- Browse all registered decisions
- View input/output schemas
- Test decisions with sample data
- See real-time results


## JSON Schema Export

Every decision's schemas are available as JSON Schema:

```bash
# Get decision schema
curl http://localhost:3000/decisions/transaction-risk/schema
```

Response:
```json
{
  "id": "transaction-risk",
  "version": "1.0.0",
  "inputSchema": {
    "type": "object",
    "properties": {
      "amount": { "type": "number" }
    },
    "required": ["amount"]
  },
  "outputSchema": { ... },
  "profileSchema": { ... }
}
```

## Design Principles

The server follows strict architectural invariants:

1. **Server does NOT add decision logic** — It only calls `engine.run()`
2. **Decisions are explicitly registered** — No auto-discovery or folder scanning
3. **UI cannot invent defaults** — Shows exactly what's required by the schema
4. **JSON Schema is primary** — OpenAPI will be derived from it (future)

## Using with Hono

The server is built on [Hono](https://hono.dev/). You can access the underlying Hono app for custom middleware:

```typescript
const server = createServer({ decisions: [...] });

// Access Hono app
server.handler.use("*", async (c, next) => {
  console.log("Request:", c.req.method, c.req.url);
  await next();
});

server.listen(3000);
```

## Next Steps

- [API Reference](/api/server) - Full API documentation
- [Examples](/examples/currency-risk) - Real-world examples
- [Testing](/guide/testing) - How to test decisions
