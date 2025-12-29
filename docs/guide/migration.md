# Migration Guide

How to migrate from scattered if/else logic to clean, testable Criterion decisions.

## The Problem

Business logic tends to become scattered across your codebase:

```typescript
// ❌ Before: Logic spread across controllers, services, and utilities

// In orderController.ts
async function processOrder(order: Order) {
  let discount = 0;

  // Tier discount
  if (user.tier === 'PLATINUM') {
    discount += 15;
  } else if (user.tier === 'GOLD') {
    discount += 10;
  } else if (user.tier === 'SILVER') {
    discount += 5;
  }

  // First purchase bonus
  if (user.orderCount === 0) {
    discount += 10;
  }

  // Bulk discount
  if (order.items.length >= 10) {
    discount += 5;
  }

  // Holiday promotion (somewhere else in the code...)
  if (isHolidaySeason()) {
    discount += getHolidayDiscount(); // Where is this defined?
  }

  // Cap discount
  discount = Math.min(discount, 30);

  // Why 30? Who decided this? When did it change?
  return applyDiscount(order, discount);
}
```

**Problems with this approach:**

- Logic scattered across files
- No audit trail
- Hard to test edge cases
- Magic numbers everywhere
- Difficult to explain to stakeholders
- Changes require code deployments

## The Solution

Extract decision logic into a Criterion decision:

```typescript
// ✅ After: Centralized, testable, explainable

import { defineDecision, Engine } from "@criterionx/core";
import { z } from "zod";

const pricingDecision = defineDecision({
  id: "order-pricing",
  version: "1.0.0",
  inputSchema: z.object({
    tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
    isFirstPurchase: z.boolean(),
    itemCount: z.number().int().positive(),
    cartTotal: z.number().positive(),
  }),
  outputSchema: z.object({
    discountPercent: z.number(),
    finalPrice: z.number(),
    appliedRules: z.array(z.string()),
    reason: z.string(),
  }),
  profileSchema: z.object({
    tierDiscounts: z.record(z.number()),
    firstPurchaseBonus: z.number(),
    bulkThreshold: z.number(),
    bulkDiscount: z.number(),
    maxDiscount: z.number(),
  }),
  rules: [
    {
      id: "first-purchase-platinum",
      when: (i, p) => i.isFirstPurchase && i.tier === "PLATINUM",
      emit: (i, p) => {
        const discount = Math.min(
          p.tierDiscounts.PLATINUM + p.firstPurchaseBonus,
          p.maxDiscount
        );
        return {
          discountPercent: discount,
          finalPrice: i.cartTotal * (1 - discount / 100),
          appliedRules: ["tier-platinum", "first-purchase"],
          reason: "Platinum member + first purchase bonus",
        };
      },
      explain: (i, p) =>
        `First purchase Platinum: ${p.tierDiscounts.PLATINUM}% + ${p.firstPurchaseBonus}%`,
    },
    // ... more rules
  ],
});
```

## Migration Steps

### Step 1: Identify Decision Boundaries

Look for code that:

- Contains multiple `if/else` or `switch` statements
- Makes business decisions (not just data transformation)
- Returns different outcomes based on conditions
- Has magic numbers or hardcoded thresholds

```typescript
// 🔍 Signs you have a decision:
if (user.age >= 18 && user.income > 50000) { ... }  // Eligibility
if (score > 700) { ... }                            // Classification
if (amount > limit) { ... }                         // Threshold check
switch (status) { ... }                             // State routing
```

### Step 2: Define Input Schema

Extract all the data your decision needs:

```typescript
// Before: Implicit inputs scattered in code
if (user.age >= 18 && user.tier === 'GOLD' && order.total > 100)

// After: Explicit input contract
const inputSchema = z.object({
  userAge: z.number().int().positive(),
  userTier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  orderTotal: z.number().positive(),
});
```

### Step 3: Define Output Schema

What does this decision produce?

```typescript
const outputSchema = z.object({
  eligible: z.boolean(),
  reason: z.string(),
  // Include everything the calling code needs
});
```

### Step 4: Extract Thresholds to Profile

Move magic numbers to profile parameters:

```typescript
// Before: Magic numbers
if (score > 700) { return "APPROVED"; }
if (score > 500) { return "REVIEW"; }

// After: Profile parameters
profileSchema: z.object({
  approvalThreshold: z.number(),  // 700
  reviewThreshold: z.number(),    // 500
}),

// Rule uses profile
when: (input, profile) => input.score > profile.approvalThreshold,
```

### Step 5: Convert Conditions to Rules

Each `if` branch becomes a rule:

```typescript
// Before
if (score > 700) {
  return { status: "APPROVED", limit: 50000 };
} else if (score > 500) {
  return { status: "REVIEW", limit: 10000 };
} else {
  return { status: "DENIED", limit: 0 };
}

// After
rules: [
  {
    id: "high-score-approved",
    when: (i, p) => i.score > p.approvalThreshold,
    emit: (i, p) => ({
      status: "APPROVED",
      limit: p.approvedLimit
    }),
    explain: (i, p) => `Score ${i.score} > ${p.approvalThreshold}`,
  },
  {
    id: "medium-score-review",
    when: (i, p) => i.score > p.reviewThreshold,
    emit: (i, p) => ({
      status: "REVIEW",
      limit: p.reviewLimit
    }),
    explain: (i, p) => `Score ${i.score} > ${p.reviewThreshold}`,
  },
  {
    id: "low-score-denied",
    when: () => true,  // Catch-all
    emit: () => ({
      status: "DENIED",
      limit: 0
    }),
    explain: () => "Score below review threshold",
  },
],
```

### Step 6: Add Explanations

Every rule needs an `explain` function:

```typescript
{
  id: "high-risk-country",
  when: (i, p) => p.highRiskCountries.includes(i.country),
  emit: () => ({ risk: "HIGH", action: "BLOCK" }),
  // Good explanation: specific and useful for debugging
  explain: (i) => `Country ${i.country} is in high-risk list`,
}
```

### Step 7: Replace Calling Code

```typescript
// Before
const result = processOrder(order, user);

// After
const engine = new Engine();
const result = engine.run(
  pricingDecision,
  {
    tier: user.tier,
    isFirstPurchase: user.orderCount === 0,
    itemCount: order.items.length,
    cartTotal: order.total,
  },
  { profile: standardProfile }
);

if (result.status === "OK") {
  applyDiscount(order, result.data.discountPercent);
}
```

## Common Patterns

### Nested If/Else → Priority Rules

```typescript
// Before: Nested nightmare
if (isPremium) {
  if (hasLoyalty) {
    if (isBirthday) {
      discount = 30;
    } else {
      discount = 20;
    }
  } else {
    discount = 15;
  }
} else {
  discount = 0;
}

// After: Flat priority rules
rules: [
  { id: "premium-loyal-birthday", when: (i) => i.isPremium && i.hasLoyalty && i.isBirthday, ... },
  { id: "premium-loyal", when: (i) => i.isPremium && i.hasLoyalty, ... },
  { id: "premium", when: (i) => i.isPremium, ... },
  { id: "standard", when: () => true, ... },
]
```

### Switch Statements → Rules

```typescript
// Before
switch (riskLevel) {
  case "HIGH": return blockTransaction();
  case "MEDIUM": return flagForReview();
  default: return approveTransaction();
}

// After
rules: [
  { id: "block-high", when: (i) => i.riskLevel === "HIGH", emit: () => ({ action: "BLOCK" }), ... },
  { id: "review-medium", when: (i) => i.riskLevel === "MEDIUM", emit: () => ({ action: "REVIEW" }), ... },
  { id: "approve-default", when: () => true, emit: () => ({ action: "APPROVE" }), ... },
]
```

### Multiple Conditions → Profile Arrays

```typescript
// Before
if (country === "US" || country === "CA" || country === "GB") {
  // allowed
}

// After
profileSchema: z.object({
  allowedCountries: z.array(z.string()),
}),

when: (i, p) => p.allowedCountries.includes(i.country),
```

## Checklist

Before considering migration complete:

- [ ] All magic numbers moved to profiles
- [ ] Every branch has a corresponding rule
- [ ] Catch-all rule exists (no NO_MATCH possible)
- [ ] Every rule has an `explain` function
- [ ] Input schema validates all required data
- [ ] Output schema matches what calling code expects
- [ ] Tests cover all rules
- [ ] Old code removed (not just commented out)

## Benefits After Migration

| Before | After |
|--------|-------|
| Logic scattered across files | Centralized in one decision |
| No audit trail | Full explanation with every result |
| Hard to test | Easy to test with known inputs |
| Magic numbers | Explicit profile parameters |
| "Why did this happen?" | `engine.explain(result)` |
| Change = deploy | Change profile = instant |

## Next Steps

- [Testing Decisions](/guide/testing) - How to test your migrated decisions
- [Profiles](/guide/profiles) - Managing different configurations
- [Explainability](/guide/explainability) - Understanding decision outputs
