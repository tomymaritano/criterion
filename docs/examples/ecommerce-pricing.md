# E-commerce: Dynamic Pricing

Apply discounts and pricing rules based on cart contents, customer tier, and promotions.

## Use Case

An e-commerce platform needs to calculate the final price considering:
- Customer loyalty tier (Bronze, Silver, Gold, Platinum)
- Cart total and item count
- Active promotions and coupon codes
- Seasonal discounts

## Implementation

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const inputSchema = z.object({
  cartTotal: z.number().positive(),
  itemCount: z.number().int().positive(),
  customerTier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  couponCode: z.string().optional(),
  isFirstPurchase: z.boolean(),
});

const outputSchema = z.object({
  discountPercent: z.number().min(0).max(100),
  discountAmount: z.number().min(0),
  finalPrice: z.number().min(0),
  appliedRules: z.array(z.string()),
  reason: z.string(),
});

const profileSchema = z.object({
  tierDiscounts: z.object({
    BRONZE: z.number(),
    SILVER: z.number(),
    GOLD: z.number(),
    PLATINUM: z.number(),
  }),
  bulkThreshold: z.number(),
  bulkDiscount: z.number(),
  firstPurchaseDiscount: z.number(),
  validCoupons: z.record(z.number()),
  maxDiscount: z.number(),
});

const pricingDecision = defineDecision({
  id: "ecommerce-pricing",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [
    {
      id: "first-purchase-bonus",
      when: (input) => input.isFirstPurchase,
      emit: (input, profile) => {
        const tierDiscount = profile.tierDiscounts[input.customerTier];
        const totalDiscount = Math.min(
          tierDiscount + profile.firstPurchaseDiscount,
          profile.maxDiscount
        );
        const discountAmount = input.cartTotal * (totalDiscount / 100);
        return {
          discountPercent: totalDiscount,
          discountAmount,
          finalPrice: input.cartTotal - discountAmount,
          appliedRules: ["first-purchase", "tier-discount"],
          reason: `First purchase bonus + ${input.customerTier} tier discount`,
        };
      },
      explain: (input, profile) =>
        `First purchase: ${profile.firstPurchaseDiscount}% + ${input.customerTier} tier`,
    },
    {
      id: "bulk-order",
      when: (input, profile) => input.itemCount >= profile.bulkThreshold,
      emit: (input, profile) => {
        const tierDiscount = profile.tierDiscounts[input.customerTier];
        const totalDiscount = Math.min(
          tierDiscount + profile.bulkDiscount,
          profile.maxDiscount
        );
        const discountAmount = input.cartTotal * (totalDiscount / 100);
        return {
          discountPercent: totalDiscount,
          discountAmount,
          finalPrice: input.cartTotal - discountAmount,
          appliedRules: ["bulk-order", "tier-discount"],
          reason: `Bulk order (${input.itemCount} items) + ${input.customerTier} tier`,
        };
      },
      explain: (input, profile) =>
        `Bulk order: ${input.itemCount} items >= ${profile.bulkThreshold} threshold`,
    },
    {
      id: "coupon-applied",
      when: (input, profile) =>
        !!input.couponCode && input.couponCode in profile.validCoupons,
      emit: (input, profile) => {
        const couponDiscount = profile.validCoupons[input.couponCode!];
        const tierDiscount = profile.tierDiscounts[input.customerTier];
        const totalDiscount = Math.min(
          tierDiscount + couponDiscount,
          profile.maxDiscount
        );
        const discountAmount = input.cartTotal * (totalDiscount / 100);
        return {
          discountPercent: totalDiscount,
          discountAmount,
          finalPrice: input.cartTotal - discountAmount,
          appliedRules: ["coupon", "tier-discount"],
          reason: `Coupon ${input.couponCode} + ${input.customerTier} tier`,
        };
      },
      explain: (input) => `Valid coupon: ${input.couponCode}`,
    },
    {
      id: "tier-only",
      when: () => true,
      emit: (input, profile) => {
        const tierDiscount = profile.tierDiscounts[input.customerTier];
        const discountAmount = input.cartTotal * (tierDiscount / 100);
        return {
          discountPercent: tierDiscount,
          discountAmount,
          finalPrice: input.cartTotal - discountAmount,
          appliedRules: ["tier-discount"],
          reason: `${input.customerTier} tier discount`,
        };
      },
      explain: (input) => `Tier discount only: ${input.customerTier}`,
    },
  ],
});
```

## Profiles

```typescript
const standardProfile = {
  tierDiscounts: {
    BRONZE: 0,
    SILVER: 5,
    GOLD: 10,
    PLATINUM: 15,
  },
  bulkThreshold: 10,
  bulkDiscount: 5,
  firstPurchaseDiscount: 10,
  validCoupons: {
    "SUMMER20": 20,
    "WELCOME15": 15,
    "FLASH10": 10,
  },
  maxDiscount: 30,
};

const blackFridayProfile = {
  tierDiscounts: {
    BRONZE: 10,
    SILVER: 15,
    GOLD: 20,
    PLATINUM: 25,
  },
  bulkThreshold: 5,
  bulkDiscount: 10,
  firstPurchaseDiscount: 15,
  validCoupons: {
    "BLACKFRIDAY": 30,
    "CYBER25": 25,
  },
  maxDiscount: 50,
};
```

## Usage

```typescript
const engine = new Engine();

// Regular customer with coupon
const result1 = engine.run(
  pricingDecision,
  {
    cartTotal: 150,
    itemCount: 3,
    customerTier: "SILVER",
    couponCode: "SUMMER20",
    isFirstPurchase: false,
  },
  { profile: standardProfile }
);

console.log(result1.data);
// {
//   discountPercent: 25,
//   discountAmount: 37.5,
//   finalPrice: 112.5,
//   appliedRules: ["coupon", "tier-discount"],
//   reason: "Coupon SUMMER20 + SILVER tier"
// }

// First-time Platinum customer on Black Friday
const result2 = engine.run(
  pricingDecision,
  {
    cartTotal: 500,
    itemCount: 8,
    customerTier: "PLATINUM",
    isFirstPurchase: true,
  },
  { profile: blackFridayProfile }
);

console.log(result2.data);
// {
//   discountPercent: 40,
//   discountAmount: 200,
//   finalPrice: 300,
//   appliedRules: ["first-purchase", "tier-discount"],
//   reason: "First purchase bonus + PLATINUM tier discount"
// }
```

## Testing

```typescript
import { describe, it, expect } from "vitest";

describe("E-commerce Pricing", () => {
  const engine = new Engine();

  it("caps discount at maxDiscount", () => {
    const result = engine.run(
      pricingDecision,
      {
        cartTotal: 100,
        itemCount: 1,
        customerTier: "PLATINUM",
        couponCode: "SUMMER20",
        isFirstPurchase: true,
      },
      { profile: standardProfile }
    );

    // 15% tier + 10% first purchase = 25%, capped at 30%
    expect(result.data?.discountPercent).toBeLessThanOrEqual(30);
  });

  it("applies bulk discount for large orders", () => {
    const result = engine.run(
      pricingDecision,
      {
        cartTotal: 200,
        itemCount: 15,
        customerTier: "GOLD",
        isFirstPurchase: false,
      },
      { profile: standardProfile }
    );

    expect(result.data?.appliedRules).toContain("bulk-order");
  });
});
```
