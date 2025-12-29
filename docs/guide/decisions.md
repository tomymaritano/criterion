# Decisions

A **Decision** is the core unit of business logic in Criterion.

## Structure

```typescript
interface Decision<TInput, TOutput, TProfile> {
  id: string;
  version: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  profileSchema: ZodSchema<TProfile>;
  rules: Rule<TInput, TProfile, TOutput>[];
  meta?: DecisionMeta;
}
```

## Properties

### id

A unique identifier for the decision. Use kebab-case:

```typescript
id: "loan-approval"
id: "transaction-risk-assessment"
id: "user-tier-eligibility"
```

### version

Semantic version string. Increment when logic changes:

```typescript
version: "1.0.0"  // Initial release
version: "1.1.0"  // New rule added
version: "2.0.0"  // Breaking change to output
```

### inputSchema

Zod schema defining the expected input:

```typescript
inputSchema: z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  customerId: z.string().uuid(),
})
```

### outputSchema

Zod schema defining the decision output:

```typescript
outputSchema: z.object({
  approved: z.boolean(),
  reason: z.string(),
  riskScore: z.number().min(0).max(100),
})
```

### profileSchema

Zod schema for parameterization:

```typescript
profileSchema: z.object({
  maxAmount: z.number(),
  minCreditScore: z.number(),
  allowedCountries: z.array(z.string()),
})
```

### rules

Array of rules evaluated in order. See [Rules](/guide/rules).

### meta

Optional metadata:

```typescript
meta: {
  owner: "risk-team",
  tags: ["compliance", "lending"],
  tier: "critical",
  description: "Determines loan approval based on risk factors",
}
```

## Creating Decisions

Use `defineDecision` for type inference:

```typescript
import { defineDecision } from "@criterionx/core";

const myDecision = defineDecision({
  id: "my-decision",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [/* ... */],
});
```

## Best Practices

1. **Version semantically** - Breaking output changes = major version bump
2. **Use descriptive IDs** - `user-premium-eligibility` not `rule1`
3. **Document with meta** - Who owns it, what it does
4. **Keep decisions focused** - One decision = one question
5. **Always have a catch-all rule** - Avoid `NO_MATCH` results
