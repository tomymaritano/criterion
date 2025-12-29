# User Eligibility

Determine user tier eligibility based on account metrics.

## Use Case

An application needs to classify users into tiers:
- **Premium** — High-value users with full access
- **Standard** — Regular users with basic access
- **Trial** — New users with limited access

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const inputSchema = z.object({
  accountAgeDays: z.number().min(0),
  totalSpend: z.number().min(0),
  referralCount: z.number().min(0),
  isVerified: z.boolean(),
});

const outputSchema = z.object({
  tier: z.enum(["PREMIUM", "STANDARD", "TRIAL"]),
  features: z.array(z.string()),
  reason: z.string(),
});

const profileSchema = z.object({
  premiumSpendThreshold: z.number(),
  premiumAgeDays: z.number(),
  standardAgeDays: z.number(),
});

const eligibilityDecision = defineDecision({
  id: "user-tier-eligibility",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "premium-by-spend",
      when: (input, profile) =>
        input.isVerified && input.totalSpend >= profile.premiumSpendThreshold,
      emit: () => ({
        tier: "PREMIUM",
        features: ["priority-support", "early-access", "unlimited-exports", "api-access"],
        reason: "High-value customer",
      }),
      explain: (input, profile) =>
        `Spend $${input.totalSpend} >= $${profile.premiumSpendThreshold} threshold`,
    },
    {
      id: "premium-by-tenure",
      when: (input, profile) =>
        input.isVerified &&
        input.accountAgeDays >= profile.premiumAgeDays &&
        input.referralCount >= 3,
      emit: () => ({
        tier: "PREMIUM",
        features: ["priority-support", "early-access", "unlimited-exports", "api-access"],
        reason: "Loyal customer with referrals",
      }),
      explain: (input, profile) =>
        `Account age ${input.accountAgeDays} days >= ${profile.premiumAgeDays} with ${input.referralCount} referrals`,
    },
    {
      id: "standard",
      when: (input, profile) =>
        input.isVerified && input.accountAgeDays >= profile.standardAgeDays,
      emit: () => ({
        tier: "STANDARD",
        features: ["basic-support", "standard-exports"],
        reason: "Verified account with sufficient tenure",
      }),
      explain: (input, profile) =>
        `Verified account with ${input.accountAgeDays} days >= ${profile.standardAgeDays}`,
    },
    {
      id: "trial",
      when: () => true,
      emit: () => ({
        tier: "TRIAL",
        features: ["limited-exports"],
        reason: "New or unverified account",
      }),
      explain: () => "Default tier for new/unverified users",
    },
  ],
});
```

## Profiles

```typescript
const defaultProfile = {
  premiumSpendThreshold: 1000,
  premiumAgeDays: 365,
  standardAgeDays: 30,
};

const aggressiveProfile = {
  premiumSpendThreshold: 500,
  premiumAgeDays: 180,
  standardAgeDays: 14,
};
```

## Usage

```typescript
const engine = new Engine();

// New user
const newUser = engine.run(
  eligibilityDecision,
  { accountAgeDays: 5, totalSpend: 0, referralCount: 0, isVerified: false },
  { profile: defaultProfile }
);
console.log(newUser.data?.tier);  // "TRIAL"

// High spender
const highSpender = engine.run(
  eligibilityDecision,
  { accountAgeDays: 60, totalSpend: 2500, referralCount: 1, isVerified: true },
  { profile: defaultProfile }
);
console.log(highSpender.data?.tier);  // "PREMIUM"
```
