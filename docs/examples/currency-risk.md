# Currency Risk Assessment

A complete example of using Criterion for transaction risk classification.

## Use Case

A financial system needs to classify transactions based on:
- Transaction amount
- Regional thresholds (vary by country)

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

// Define schemas
const inputSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  merchant: z.string(),
});

const outputSchema = z.object({
  risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  action: z.enum(["BLOCK", "REVIEW", "ALLOW"]),
  reason: z.string(),
});

const profileSchema = z.object({
  highRiskThreshold: z.number(),
  mediumRiskThreshold: z.number(),
  blockedMerchants: z.array(z.string()),
});

// Define the decision
const currencyRiskDecision = defineDecision({
  id: "currency-risk-assessment",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "blocked-merchant",
      when: (input, profile) =>
        profile.blockedMerchants.includes(input.merchant),
      emit: () => ({
        risk: "HIGH",
        action: "BLOCK",
        reason: "Merchant is on blocklist",
      }),
      explain: (input) => `Merchant "${input.merchant}" is blocked`,
    },
    {
      id: "high-risk-amount",
      when: (input, profile) => input.amount > profile.highRiskThreshold,
      emit: () => ({
        risk: "HIGH",
        action: "REVIEW",
        reason: "Amount exceeds high-risk threshold",
      }),
      explain: (input, profile) =>
        `Amount ${input.amount} ${input.currency} > ${profile.highRiskThreshold}`,
    },
    {
      id: "medium-risk-amount",
      when: (input, profile) => input.amount > profile.mediumRiskThreshold,
      emit: () => ({
        risk: "MEDIUM",
        action: "REVIEW",
        reason: "Amount exceeds medium-risk threshold",
      }),
      explain: (input, profile) =>
        `Amount ${input.amount} ${input.currency} > ${profile.mediumRiskThreshold}`,
    },
    {
      id: "low-risk",
      when: () => true,
      emit: () => ({
        risk: "LOW",
        action: "ALLOW",
        reason: "Transaction within normal parameters",
      }),
      explain: () => "All checks passed",
    },
  ],
  meta: {
    owner: "risk-team",
    tags: ["finance", "compliance"],
  },
});
```

## Regional Profiles

```typescript
// US profile - higher thresholds
const usProfile = {
  highRiskThreshold: 10000,
  mediumRiskThreshold: 5000,
  blockedMerchants: ["suspicious-corp", "fraud-inc"],
};

// EU profile - stricter thresholds
const euProfile = {
  highRiskThreshold: 8000,
  mediumRiskThreshold: 3000,
  blockedMerchants: ["suspicious-corp", "fraud-inc", "risky-eu-merchant"],
};

// LATAM profile
const latamProfile = {
  highRiskThreshold: 5000,
  mediumRiskThreshold: 2000,
  blockedMerchants: ["suspicious-corp"],
};
```

## Running Decisions

```typescript
const engine = new Engine();

// Transaction in US
const usResult = engine.run(
  currencyRiskDecision,
  { amount: 7500, currency: "USD", merchant: "amazon" },
  { profile: usProfile }
);

console.log(usResult.data);
// { risk: "MEDIUM", action: "REVIEW", reason: "Amount exceeds medium-risk threshold" }

// Same transaction in EU - higher risk
const euResult = engine.run(
  currencyRiskDecision,
  { amount: 7500, currency: "EUR", merchant: "amazon" },
  { profile: euProfile }
);

console.log(euResult.data);
// { risk: "HIGH", action: "REVIEW", reason: "Amount exceeds high-risk threshold" }
```

## Using Profile Registry

```typescript
import { Engine, createProfileRegistry } from "@criterionx/core";

// Create and populate registry
const registry = createProfileRegistry<typeof usProfile>();
registry.register("us", usProfile);
registry.register("eu", euProfile);
registry.register("latam", latamProfile);

// Use by ID - pass registry as 4th argument
const engine = new Engine();
const result = engine.run(
  currencyRiskDecision,
  { amount: 7500, currency: "USD", merchant: "amazon" },
  { profile: "us" },  // Profile ID instead of object
  registry            // Registry containing profiles
);
```

## Audit Trail

Every decision includes a complete audit trail:

```typescript
console.log(engine.explain(result));

// Decision: currency-risk-assessment v1.0.0
// Status: OK
// Matched: medium-risk-amount
// Reason: Amount 7500 USD > 5000
//
// Evaluation trace:
//   ✗ blocked-merchant
//   ✗ high-risk-amount
//   ✓ medium-risk-amount
```

## Testing

```typescript
import { describe, it, expect } from "vitest";

describe("Currency Risk Decision", () => {
  const engine = new Engine();

  it("blocks transactions from blocked merchants", () => {
    const result = engine.run(
      currencyRiskDecision,
      { amount: 100, currency: "USD", merchant: "fraud-inc" },
      { profile: usProfile }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.action).toBe("BLOCK");
    expect(result.meta.matchedRule).toBe("blocked-merchant");
  });

  it("flags high-risk amounts for review", () => {
    const result = engine.run(
      currencyRiskDecision,
      { amount: 15000, currency: "USD", merchant: "amazon" },
      { profile: usProfile }
    );

    expect(result.data?.risk).toBe("HIGH");
    expect(result.data?.action).toBe("REVIEW");
  });

  it("allows low-risk transactions", () => {
    const result = engine.run(
      currencyRiskDecision,
      { amount: 500, currency: "USD", merchant: "amazon" },
      { profile: usProfile }
    );

    expect(result.data?.risk).toBe("LOW");
    expect(result.data?.action).toBe("ALLOW");
  });
});
```
