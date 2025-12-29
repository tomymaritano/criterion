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

## Middleware Hooks

The server supports hooks for intercepting decision evaluations. Use hooks for logging, metrics, input transformation, or error handling.

```typescript
const server = createServer({
  decisions: [riskDecision],
  profiles: { "transaction-risk": { threshold: 10000 } },
  hooks: {
    // Called before each evaluation
    beforeEvaluate: async (ctx) => {
      console.log(`[${ctx.requestId}] Evaluating ${ctx.decisionId}`);
      console.log(`  Input:`, ctx.input);
      console.log(`  Profile:`, ctx.profile);

      // Optionally modify input or profile
      // return { input: transformedInput };
    },

    // Called after successful evaluation
    afterEvaluate: async (ctx, result) => {
      console.log(`[${ctx.requestId}] Result: ${result.status}`);
      if (result.status === "OK") {
        console.log(`  Matched rule: ${result.meta.matchedRule}`);
      }
    },

    // Called when an error occurs
    onError: async (ctx, error) => {
      console.error(`[${ctx.requestId}] Error in ${ctx.decisionId}:`, error.message);
    },
  },
});
```

### Hook Context

Each hook receives a `HookContext` with:

| Property | Type | Description |
|----------|------|-------------|
| `decisionId` | `string` | ID of the decision being evaluated |
| `input` | `unknown` | Input data for the decision |
| `profile` | `unknown` | Profile being used |
| `requestId` | `string` | Unique request ID (e.g., `req_abc123`) |
| `timestamp` | `Date` | When the evaluation started |

### Use Cases

- **Logging**: Track all evaluations for debugging
- **Metrics**: Collect timing data for monitoring
- **Input transformation**: Normalize or enrich input before evaluation
- **Caching**: Check cache before evaluation (in `beforeEvaluate`)
- **Rate limiting**: Reject requests before evaluation
- **Error tracking**: Send errors to monitoring services

## Metrics & Observability

The server includes built-in Prometheus metrics for production monitoring.

### Enabling Metrics

```typescript
const server = createServer({
  decisions: [riskDecision],
  profiles: { "transaction-risk": { threshold: 10000 } },
  metrics: {
    enabled: true,
    endpoint: "/metrics", // Default
  },
});
```

### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `criterion_evaluations_total` | Counter | `decision_id`, `status` | Total number of evaluations |
| `criterion_evaluation_duration_seconds` | Histogram | `decision_id` | Evaluation latency |
| `criterion_rule_matches_total` | Counter | `decision_id`, `rule_id` | Rule match distribution |

### Prometheus Integration

```bash
# Scrape metrics
curl http://localhost:3000/metrics
```

Example output:
```text
# HELP criterion_evaluations_total Counter metric
# TYPE criterion_evaluations_total counter
criterion_evaluations_total{decision_id="transaction-risk",status="OK"} 42

# HELP criterion_evaluation_duration_seconds Histogram metric
# TYPE criterion_evaluation_duration_seconds histogram
criterion_evaluation_duration_seconds_bucket{decision_id="transaction-risk",le="0.01"} 38
criterion_evaluation_duration_seconds_bucket{decision_id="transaction-risk",le="0.1"} 42
criterion_evaluation_duration_seconds_sum{decision_id="transaction-risk"} 0.156
criterion_evaluation_duration_seconds_count{decision_id="transaction-risk"} 42
```

### Grafana Dashboard

With these metrics you can create dashboards for:
- Request rate per decision
- Latency percentiles (p50, p95, p99)
- Error rates by decision
- Rule match distribution

### Programmatic Access

```typescript
const server = createServer({
  decisions: [riskDecision],
  profiles: { ... },
  metrics: { enabled: true },
});

// Access metrics collector directly
const collector = server.metrics;
if (collector) {
  console.log(collector.toPrometheus());
}
```

## OpenAPI Specification

The server can generate an OpenAPI 3.0 specification with Swagger UI.

### Enabling OpenAPI

```typescript
const server = createServer({
  decisions: [riskDecision],
  profiles: { "transaction-risk": { threshold: 10000 } },
  openapi: {
    enabled: true,
    endpoint: "/openapi.json",     // Default
    swaggerEndpoint: "/swagger",   // Default
    info: {
      title: "My Decision API",
      version: "1.0.0",
      description: "Risk assessment API",
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
    },
  },
});
```

Visit:
- `http://localhost:3000/openapi.json` - OpenAPI 3.0 spec
- `http://localhost:3000/swagger` - Swagger UI

### Generated Endpoints

The OpenAPI spec includes:
- POST `/decisions/:id` - Evaluate a decision
- GET `/decisions/:id/schema` - Get decision schema
- GET `/decisions` - List all decisions
- GET `/` - Health check

### Generated Schemas

For each decision, schemas are generated:
- `{DecisionId}Input` - Input schema
- `{DecisionId}Output` - Output schema
- `{DecisionId}Profile` - Profile schema
- `{DecisionId}Request` - Request body schema

Plus common schemas:
- `EvaluationResult` - Response structure
- `ResultMeta` - Metadata structure
- `ErrorResponse` - Error structure

### Swagger UI

Swagger UI is enabled by default when OpenAPI is enabled. To disable:

```typescript
openapi: {
  enabled: true,
  swaggerUI: false, // Disable Swagger UI
}
```

### Use Cases

- **Client generation**: Use OpenAPI spec with tools like `openapi-generator`
- **API documentation**: Interactive docs for frontend teams
- **Contract testing**: Validate API responses against schema
- **API gateways**: Import spec into Kong, AWS API Gateway, etc.

## Design Principles

The server follows strict architectural invariants:

1. **Server does NOT add decision logic** — It only calls `engine.run()`
2. **Decisions are explicitly registered** — No auto-discovery or folder scanning
3. **UI cannot invent defaults** — Shows exactly what's required by the schema
4. **JSON Schema is primary** — OpenAPI is derived from it

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
