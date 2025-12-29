# Testing

Criterion decisions are pure functions — they're trivial to test.

## Why Testing is Easy

- **No mocks needed** — No I/O, no external dependencies
- **Deterministic** — Same input always produces same output
- **Isolated** — Each decision is self-contained

## Basic Test Structure

```typescript
import { describe, it, expect } from "vitest";
import { Engine } from "@criterionx/core";
import { riskDecision, usProfile } from "./decisions";

describe("Risk Decision", () => {
  const engine = new Engine();

  it("returns HIGH risk for large amounts", () => {
    const result = engine.run(
      riskDecision,
      { amount: 15000, currency: "USD" },
      { profile: usProfile }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.risk).toBe("HIGH");
  });
});
```

## Testing Different Scenarios

```typescript
describe("Risk Decision", () => {
  const engine = new Engine();

  it.each([
    { amount: 15000, expected: "HIGH" },
    { amount: 7500, expected: "MEDIUM" },
    { amount: 1000, expected: "LOW" },
  ])("amount $amount → $expected risk", ({ amount, expected }) => {
    const result = engine.run(
      riskDecision,
      { amount, currency: "USD" },
      { profile: usProfile }
    );

    expect(result.data?.risk).toBe(expected);
  });
});
```

## Testing Profile Variations

```typescript
describe("Profile variations", () => {
  const engine = new Engine();
  const input = { amount: 7500, currency: "USD" };

  it("US profile: MEDIUM risk", () => {
    const result = engine.run(riskDecision, input, { profile: usProfile });
    expect(result.data?.risk).toBe("MEDIUM");
  });

  it("EU profile: HIGH risk (stricter thresholds)", () => {
    const result = engine.run(riskDecision, input, { profile: euProfile });
    expect(result.data?.risk).toBe("HIGH");
  });
});
```

## Testing Validation

```typescript
describe("Input validation", () => {
  const engine = new Engine();

  it("rejects negative amounts", () => {
    const result = engine.run(
      riskDecision,
      { amount: -100, currency: "USD" },
      { profile: usProfile }
    );

    expect(result.status).toBe("INVALID_INPUT");
  });

  it("rejects invalid currency codes", () => {
    const result = engine.run(
      riskDecision,
      { amount: 1000, currency: "INVALID" },
      { profile: usProfile }
    );

    expect(result.status).toBe("INVALID_INPUT");
  });
});
```

## Testing Explanations

```typescript
it("provides correct explanation", () => {
  const result = engine.run(
    riskDecision,
    { amount: 15000, currency: "USD" },
    { profile: { threshold: 10000 } }
  );

  expect(result.meta.matchedRule).toBe("high-risk");
  expect(result.meta.explanation).toContain("15000");
  expect(result.meta.explanation).toContain("10000");
});
```

## Testing Rule Order

```typescript
it("matches first applicable rule", () => {
  // Both high-risk and medium-risk conditions are true
  // but high-risk comes first
  const result = engine.run(
    riskDecision,
    { amount: 50000, currency: "USD" },
    { profile: { highThreshold: 10000, mediumThreshold: 5000 } }
  );

  expect(result.meta.matchedRule).toBe("high-risk");
});
```

## Best Practices

1. **Test edge cases** — Boundary values, empty inputs
2. **Test all rules** — Ensure each rule can be reached
3. **Test profiles** — Same input, different profiles
4. **Test explanations** — Verify audit trail content
5. **Use table-driven tests** — `it.each()` for multiple scenarios
