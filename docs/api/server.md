# Server API

API reference for `@criterionx/server`.

## createServer

Creates a new Criterion HTTP server.

```typescript
import { createServer } from "@criterionx/server";

const server = createServer(options);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `ServerOptions` | Server configuration |

### ServerOptions

```typescript
interface ServerOptions {
  /** Decisions to expose via HTTP */
  decisions: Decision<any, any, any>[];

  /** Default profiles for decisions (keyed by decision ID) */
  profiles?: Record<string, unknown>;

  /** Enable CORS (default: true) */
  cors?: boolean;

  /** Middleware hooks for evaluation lifecycle */
  hooks?: Hooks;
}
```

### Returns

Returns a `CriterionServer` instance.

### Example

```typescript
import { createServer } from "@criterionx/server";
import { myDecision } from "./decisions";

const server = createServer({
  decisions: [myDecision],
  profiles: {
    "my-decision": { threshold: 100 },
  },
});

server.listen(3000);
```

---

## CriterionServer

The server instance returned by `createServer`.

### server.listen(port?)

Starts the HTTP server.

```typescript
server.listen(3000);
// Criterion Server starting on port 3000...
//   Decisions: 1
//   Docs: http://localhost:3000/docs
//   API: http://localhost:3000/decisions
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | `number` | `3000` | Port to listen on |

### server.handler

Access the underlying [Hono](https://hono.dev/) app instance for custom middleware.

```typescript
const server = createServer({ decisions: [...] });

// Add custom middleware
server.handler.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  console.log(`${c.req.method} ${c.req.url} - ${Date.now() - start}ms`);
});

// Add custom routes
server.handler.get("/health", (c) => c.json({ status: "healthy" }));
```

---

## HTTP Endpoints

### GET /

Health check endpoint.

**Response:**
```json
{
  "name": "Criterion Server",
  "version": "0.1.0",
  "decisions": 2
}
```

---

### GET /docs

Interactive documentation UI (HTML).

Returns a Swagger-like interface for browsing and testing decisions.

---

### GET /decisions

List all registered decisions.

**Response:**
```json
{
  "decisions": [
    {
      "id": "transaction-risk",
      "version": "1.0.0",
      "description": "Evaluate transaction risk",
      "meta": { ... }
    }
  ]
}
```

---

### GET /decisions/:id/schema

Get JSON Schema for a decision.

**Response:**
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
  "outputSchema": {
    "type": "object",
    "properties": {
      "risk": { "type": "string", "enum": ["HIGH", "LOW"] }
    },
    "required": ["risk"]
  },
  "profileSchema": {
    "type": "object",
    "properties": {
      "threshold": { "type": "number" }
    },
    "required": ["threshold"]
  }
}
```

---

### GET /decisions/:id/endpoint-schema

Get the full endpoint schema including request/response format.

**Response:**
```json
{
  "id": "transaction-risk",
  "method": "POST",
  "path": "/decisions/transaction-risk",
  "requestSchema": {
    "type": "object",
    "properties": {
      "input": { ... },
      "profile": { ... }
    },
    "required": ["input"]
  },
  "responseSchema": {
    "type": "object",
    "properties": {
      "status": { ... },
      "data": { ... },
      "meta": { ... }
    }
  }
}
```

---

### POST /decisions/:id

Evaluate a decision.

**Request Body:**
```json
{
  "input": { ... },
  "profile": { ... }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `input` | `object` | Yes | Input data matching the decision's inputSchema |
| `profile` | `object` | No | Profile to use (overrides default) |

**Success Response (200):**
```json
{
  "status": "OK",
  "data": { ... },
  "meta": {
    "decisionId": "transaction-risk",
    "decisionVersion": "1.0.0",
    "matchedRule": "rule-id",
    "explanation": "Why this rule matched",
    "evaluatedAt": "2024-12-29T12:00:00.000Z",
    "evaluatedRules": [
      { "ruleId": "rule-1", "matched": true, "explanation": "..." },
      { "ruleId": "rule-2", "matched": false }
    ]
  }
}
```

**Error Response (400):**
```json
{
  "error": "Missing 'input' in request body"
}
```

---

## Utility Functions

### toJsonSchema

Convert a Zod schema to JSON Schema.

```typescript
import { toJsonSchema } from "@criterionx/server";
import { z } from "zod";

const schema = z.object({
  name: z.string(),
  age: z.number(),
});

const jsonSchema = toJsonSchema(schema);
// {
//   type: "object",
//   properties: {
//     name: { type: "string" },
//     age: { type: "number" }
//   },
//   required: ["name", "age"]
// }
```

---

### extractDecisionSchema

Extract all schemas from a decision as JSON Schema.

```typescript
import { extractDecisionSchema } from "@criterionx/server";

const schema = extractDecisionSchema(myDecision);
// {
//   id: "my-decision",
//   version: "1.0.0",
//   inputSchema: { ... },
//   outputSchema: { ... },
//   profileSchema: { ... }
// }
```

---

## TypeScript Types

### ServerOptions

```typescript
interface ServerOptions {
  decisions: Decision<any, any, any>[];
  profiles?: Record<string, unknown>;
  cors?: boolean;
}
```

### EvaluateRequest

```typescript
interface EvaluateRequest {
  input: unknown;
  profile?: unknown;
}
```

### DecisionInfo

```typescript
interface DecisionInfo {
  id: string;
  version: string;
  description?: string;
  meta?: Record<string, unknown>;
}
```

### DecisionSchema

```typescript
interface DecisionSchema {
  id: string;
  version: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  profileSchema: JsonSchema;
}
```

### Hooks

```typescript
interface Hooks {
  /** Called before decision evaluation */
  beforeEvaluate?: BeforeEvaluateHook;
  /** Called after successful evaluation */
  afterEvaluate?: AfterEvaluateHook;
  /** Called when an error occurs */
  onError?: OnErrorHook;
}
```

### HookContext

```typescript
interface HookContext {
  /** ID of the decision being evaluated */
  decisionId: string;
  /** Input data for the decision */
  input: unknown;
  /** Profile being used */
  profile: unknown;
  /** Unique request ID for tracing */
  requestId: string;
  /** Timestamp when evaluation started */
  timestamp: Date;
}
```

### BeforeEvaluateHook

```typescript
type BeforeEvaluateHook = (
  ctx: HookContext
) => Promise<Partial<HookContext> | void> | Partial<HookContext> | void;
```

Can modify context by returning a partial context object. Return `undefined` to keep original context. Throw to abort evaluation.

### AfterEvaluateHook

```typescript
type AfterEvaluateHook = (
  ctx: HookContext,
  result: Result<unknown>
) => Promise<void> | void;
```

Receives the evaluation result. Cannot modify the result. Use for logging, metrics, side effects.

### OnErrorHook

```typescript
type OnErrorHook = (
  ctx: HookContext,
  error: Error
) => Promise<void> | void;
```

Called when an error occurs during hook execution or evaluation.
