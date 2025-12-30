# When to Use Criterion

Criterion is designed for a specific type of problem: **business decisions that need to be auditable, testable, and parameterizable**.

## Signs You Need a Decision Engine

### 1. Business Rules That Change by Context

Your logic behaves differently based on:
- **Region** — US vs EU compliance rules
- **Customer tier** — Free vs Pro vs Enterprise limits
- **Environment** — Dev vs Staging vs Production settings
- **Time** — Holiday promotions, seasonal pricing

```typescript
// Without Criterion: scattered conditionals
if (user.region === "EU" && amount > 10000) {
  // EU rules
} else if (user.region === "US" && amount > 50000) {
  // US rules
}

// With Criterion: profiles handle the variation
const result = engine.run(amlDecision, input, {
  profile: profiles[user.region]
});
```

### 2. Audit and Compliance Requirements

When someone asks "why did the system do this?", you need a clear answer:
- **Financial services** — Loan denials, fraud blocks, AML flags
- **Healthcare** — Triage decisions, coverage eligibility
- **HR/Legal** — Hiring decisions, policy enforcement

```typescript
// Every decision includes explanation
const result = engine.run(decision, input, { profile });
console.log(engine.explain(result));
// Decision: loan-approval v1.2.0
// Status: OK
// Matched: high-dti-ratio
// Reason: Debt-to-income ratio 0.52 exceeds limit 0.43
```

### 3. Multi-Tenant Logic

SaaS platforms where each customer has different rules:
- **Per-customer pricing** — Different discount structures
- **Per-customer limits** — Different feature caps
- **White-label products** — Same logic, different parameters

```typescript
// Each tenant gets their own profile
const profiles = {
  "acme-corp": { maxUsers: 100, features: ["reports", "api"] },
  "startup-xyz": { maxUsers: 10, features: ["reports"] },
};

const result = engine.run(
  accessDecision,
  { userId, feature: "api" },
  { profile: profiles[tenantId] }
);
```

### 4. Decisions That Non-Developers Need to Understand

When support, compliance, or business teams need to:
- **Debug customer issues** — "Why was I denied?"
- **Review decision history** — "What happened at 3pm yesterday?"
- **Explain to regulators** — "Here's our decision logic"

The `explain()` function produces human-readable output:
```
Decision: transaction-risk v2.1.0
Status: OK
Matched: blocked-country
Reason: Transaction from country XX is blocked per sanctions list
Evaluated: blocked-country (match)
```

### 5. Logic That Needs Heavy Testing

Complex business rules with many edge cases:
- **Pricing engines** — Discounts stack in specific ways
- **Eligibility checks** — Multiple criteria interact
- **Risk scoring** — Thresholds compound

Criterion decisions are pure functions — trivial to test:
```typescript
describe("loan approval", () => {
  it("denies when DTI exceeds limit", () => {
    const result = engine.run(loanDecision,
      { income: 100000, debt: 60000 },
      { profile: standardProfile }
    );
    expect(result.data.approved).toBe(false);
    expect(result.matchedRule).toBe("high-dti");
  });
});
```

## Ideal Use Cases

### Financial Services
- Transaction risk scoring
- Loan approval/denial
- Credit limit decisions
- AML/KYC classification
- Fraud detection rules

### E-commerce
- Dynamic pricing rules
- Discount eligibility
- Shipping tier selection
- Inventory allocation

### SaaS Platforms
- Feature gating by plan
- Usage limit enforcement
- Quota decisions
- Access control

### Healthcare
- Triage classification
- Coverage eligibility
- Prior authorization
- Risk stratification

### Insurance
- Quote eligibility
- Underwriting rules
- Claim classification
- Premium calculation

## The Common Pattern

All these share a pattern:

1. **Input data** — What you know (user, transaction, context)
2. **Business rules** — What to check (in priority order)
3. **Output decision** — What to do (approve, deny, flag, etc.)
4. **Explanation** — Why (for audit/debugging)
5. **Parameters** — That vary (by region, tier, environment)

If your problem fits this pattern, Criterion is a good fit.

## Quick Checklist

Use Criterion if you answer "yes" to 2+ of these:

- [ ] Rules vary by customer/region/tier
- [ ] You need audit trails for compliance
- [ ] Non-developers need to understand decisions
- [ ] You have 10+ business rules interacting
- [ ] You need to test edge cases exhaustively
- [ ] Rules change frequently but logic structure stays the same

## Next Steps

- [When NOT to Use Criterion](/guide/when-not-to-use) — Know the boundaries
- [Getting Started](/guide/getting-started) — Try it yourself
- [Feature Flags Example](/examples/feature-flags) — Simple real-world case
