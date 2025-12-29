# Engine

The `Engine` class is the core runtime for evaluating decisions.

## Constructor

```typescript
const engine = new Engine();
```

The engine is stateless. You can create a single instance and reuse it.

## Methods

### run()

Evaluates a decision against input and profile.

```typescript
run<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  input: TInput,
  options: { profile: TProfile } | { profile: string }
): Result<TOutput>
```

**Parameters:**
- `decision` - The decision definition
- `input` - The input data to evaluate
- `options` - Either an inline profile or a profile ID (requires registry)

**Returns:** A `Result<TOutput>` with status, data, and metadata.

**Example:**

```typescript
const result = engine.run(
  myDecision,
  { amount: 1000 },
  { profile: { threshold: 500 } }
);

if (result.status === "OK") {
  console.log(result.data);
}
```

### explain()

Returns a human-readable explanation of a result.

```typescript
explain<TOutput>(result: Result<TOutput>): string
```

**Parameters:**
- `result` - A result from `run()`

**Returns:** Formatted string with decision info and trace.

**Example:**

```typescript
const result = engine.run(decision, input, options);
console.log(engine.explain(result));

// Output:
// Decision: my-decision v1.0.0
// Status: OK
// Matched: rule-1
// Reason: Amount 1000 exceeds threshold 500
//
// Evaluation trace:
//   ✓ rule-1
```

## Using Profile Registry

To use named profiles instead of inline profiles, create a `ProfileRegistry` and pass it to `run()`:

```typescript
import { Engine, createProfileRegistry } from "@criterionx/core";

// Create a typed registry
const registry = createProfileRegistry<{ threshold: number }>();

// Register profiles
registry.register("conservative", { threshold: 1000 });
registry.register("aggressive", { threshold: 10000 });

// Use profile by ID (pass registry as 4th argument)
const engine = new Engine();
const result = engine.run(
  myDecision,
  { amount: 5000 },
  { profile: "conservative" },  // Profile ID
  registry                      // Registry with profiles
);
```

See [Profile Registry](/guide/profile-registry) for more details.

## Result Status Codes

| Status | Meaning |
|--------|---------|
| `OK` | A rule matched and produced valid output |
| `NO_MATCH` | No rule's condition returned true |
| `INVALID_INPUT` | Input failed schema validation |
| `INVALID_OUTPUT` | Output failed schema validation |

## Error Handling

The engine never throws. All errors are captured in the result:

```typescript
const result = engine.run(decision, invalidInput, options);

if (result.status === "INVALID_INPUT") {
  console.error("Validation failed:", result.meta.explanation);
}
```
