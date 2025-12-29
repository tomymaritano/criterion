# Interactive Playground

Try Criterion directly in your browser without installing anything.

## Quick Start

<a href="https://stackblitz.com/github/tomymaritano/criterionx/tree/main/examples/hello?file=index.ts" target="_blank" rel="noopener noreferrer">
  <img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" />
</a>

Click the button above to open a pre-configured TypeScript project with Criterion installed.

## Examples

### Risk Assessment

Try this example to see how Criterion evaluates transaction risk:

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
    isNewCustomer: z.boolean(),
  }),
  outputSchema: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
    action: z.enum(["APPROVE", "REVIEW", "BLOCK"]),
    reason: z.string(),
  }),
  profileSchema: z.object({
    highRiskCountries: z.array(z.string()),
    largeTransactionThreshold: z.number(),
  }),
  rules: [
    {
      id: "high-risk-country",
      when: (i, p) => p.highRiskCountries.includes(i.country),
      emit: () => ({
        risk: "HIGH",
        action: "BLOCK",
        reason: "Transaction from high-risk country",
      }),
      explain: (i) => `Country ${i.country} is high-risk`,
    },
    {
      id: "large-new-customer",
      when: (i, p) => i.isNewCustomer && i.amount > p.largeTransactionThreshold,
      emit: (i) => ({
        risk: "HIGH",
        action: "REVIEW",
        reason: `Large transaction ($${i.amount}) from new customer`,
      }),
      explain: (i, p) =>
        `New customer with amount $${i.amount} > $${p.largeTransactionThreshold}`,
    },
    {
      id: "large-transaction",
      when: (i, p) => i.amount > p.largeTransactionThreshold,
      emit: () => ({
        risk: "MEDIUM",
        action: "REVIEW",
        reason: "Large transaction requires review",
      }),
      explain: (i, p) => `Amount $${i.amount} > $${p.largeTransactionThreshold}`,
    },
    {
      id: "standard",
      when: () => true,
      emit: () => ({
        risk: "LOW",
        action: "APPROVE",
        reason: "Standard transaction approved",
      }),
      explain: () => "No risk factors detected",
    },
  ],
});

// Run the engine
const engine = new Engine();

const profile = {
  highRiskCountries: ["KP", "IR", "SY"],
  largeTransactionThreshold: 10000,
};

// Test different scenarios
const scenarios = [
  { amount: 500, country: "US", isNewCustomer: false },
  { amount: 15000, country: "US", isNewCustomer: true },
  { amount: 1000, country: "IR", isNewCustomer: false },
];

scenarios.forEach((input) => {
  const result = engine.run(riskDecision, input, { profile });
  console.log(`\n--- Transaction: $${input.amount} from ${input.country} ---`);
  console.log("Result:", result.data);
  console.log("Explanation:", engine.explain(result));
});
```

<a href="https://stackblitz.com/github/tomymaritano/criterionx/tree/main/examples/hello?file=index.ts" target="_blank" rel="noopener noreferrer">
  <img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" />
</a>

---

### Pricing Calculator

See how to implement dynamic pricing with customer tiers:

```typescript
import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

const pricingDecision = defineDecision({
  id: "dynamic-pricing",
  version: "1.0.0",
  inputSchema: z.object({
    basePrice: z.number().positive(),
    customerTier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
    quantity: z.number().int().positive(),
    couponCode: z.string().optional(),
  }),
  outputSchema: z.object({
    originalPrice: z.number(),
    discount: z.number(),
    finalPrice: z.number(),
    savings: z.number(),
    appliedDiscounts: z.array(z.string()),
  }),
  profileSchema: z.object({
    tierDiscounts: z.record(z.number()),
    bulkThreshold: z.number(),
    bulkDiscount: z.number(),
    validCoupons: z.record(z.number()),
    maxDiscount: z.number(),
  }),
  rules: [
    {
      id: "platinum-bulk",
      when: (i, p) => i.customerTier === "PLATINUM" && i.quantity >= p.bulkThreshold,
      emit: (i, p) => {
        const discount = Math.min(
          p.tierDiscounts.PLATINUM + p.bulkDiscount,
          p.maxDiscount
        );
        const originalPrice = i.basePrice * i.quantity;
        const savings = originalPrice * (discount / 100);
        return {
          originalPrice,
          discount,
          finalPrice: originalPrice - savings,
          savings,
          appliedDiscounts: ["PLATINUM tier", "Bulk order"],
        };
      },
      explain: (i, p) => `Platinum + bulk (${i.quantity} items)`,
    },
    {
      id: "with-coupon",
      when: (i, p) => i.couponCode && i.couponCode in p.validCoupons,
      emit: (i, p) => {
        const tierDiscount = p.tierDiscounts[i.customerTier] || 0;
        const couponDiscount = p.validCoupons[i.couponCode!];
        const discount = Math.min(tierDiscount + couponDiscount, p.maxDiscount);
        const originalPrice = i.basePrice * i.quantity;
        const savings = originalPrice * (discount / 100);
        return {
          originalPrice,
          discount,
          finalPrice: originalPrice - savings,
          savings,
          appliedDiscounts: [`${i.customerTier} tier`, `Coupon: ${i.couponCode}`],
        };
      },
      explain: (i) => `Coupon ${i.couponCode} applied`,
    },
    {
      id: "tier-only",
      when: () => true,
      emit: (i, p) => {
        const discount = p.tierDiscounts[i.customerTier] || 0;
        const originalPrice = i.basePrice * i.quantity;
        const savings = originalPrice * (discount / 100);
        return {
          originalPrice,
          discount,
          finalPrice: originalPrice - savings,
          savings,
          appliedDiscounts: [`${i.customerTier} tier`],
        };
      },
      explain: (i) => `${i.customerTier} tier discount`,
    },
  ],
});

const engine = new Engine();

const profile = {
  tierDiscounts: { BRONZE: 0, SILVER: 5, GOLD: 10, PLATINUM: 15 },
  bulkThreshold: 10,
  bulkDiscount: 10,
  validCoupons: { SAVE20: 20, WELCOME10: 10 },
  maxDiscount: 30,
};

// Try different scenarios
const result = engine.run(
  pricingDecision,
  {
    basePrice: 99.99,
    customerTier: "GOLD",
    quantity: 3,
    couponCode: "SAVE20",
  },
  { profile }
);

console.log("Pricing Result:", result.data);
console.log("\nExplanation:", engine.explain(result));
```

<a href="https://stackblitz.com/github/tomymaritano/criterionx/tree/main/examples/hello?file=index.ts" target="_blank" rel="noopener noreferrer">
  <img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" />
</a>

---

## Create Your Own

Start from scratch with a blank Criterion project:

<a href="https://stackblitz.com/github/tomymaritano/criterionx/tree/main/examples/hello?file=index.ts" target="_blank" rel="noopener noreferrer">
  <img src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" />
</a>

## Local Development

If you prefer to run locally:

```bash
# Create new project
mkdir my-criterion-project && cd my-criterion-project
npm init -y

# Install dependencies
npm install @criterionx/core zod typescript tsx

# Create your decision
echo 'import { Engine, defineDecision } from "@criterionx/core";
import { z } from "zod";

// Your decision here...
' > index.ts

# Run
npx tsx index.ts
```

## Next Steps

- [Getting Started](/guide/getting-started) - Full installation guide
- [Examples](/examples/currency-risk) - More real-world examples
- [API Reference](/api/engine) - Complete API documentation
