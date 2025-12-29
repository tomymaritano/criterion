# Rules

Rules define the logic within a decision. They are evaluated in order until one matches.

## Structure

```typescript
interface Rule<TContext, TProfile, TOutput> {
  id: string;
  when: (context: TContext, profile: TProfile) => boolean;
  emit: (context: TContext, profile: TProfile) => TOutput;
  explain: (context: TContext, profile: TProfile) => string;
}
```

## Properties

### id

Unique identifier within the decision:

```typescript
id: "high-risk-amount"
id: "blocked-merchant"
id: "default-approval"
```

### when

Condition function. Returns `true` if this rule matches:

```typescript
when: (input, profile) => input.amount > profile.threshold
when: (input) => input.status === "PENDING"
when: () => true  // Catch-all
```

### emit

Output function. Called when `when()` returns `true`:

```typescript
emit: () => ({ risk: "HIGH", action: "BLOCK" })
emit: (input) => ({ approved: true, amount: input.amount })
emit: (input, profile) => ({
  discount: input.amount * profile.discountRate
})
```

### explain

Human-readable explanation. Called for matched rules:

```typescript
explain: (input, profile) =>
  `Amount ${input.amount} exceeds threshold ${profile.threshold}`
explain: () => "Default rule: no other conditions matched"
```

## Evaluation Order

Rules are evaluated in array order. First match wins:

```typescript
rules: [
  { id: "rule-1", when: (i) => i.x > 100, ... },  // Checked first
  { id: "rule-2", when: (i) => i.x > 50, ... },   // Checked second
  { id: "rule-3", when: () => true, ... },         // Catch-all (last)
]
```

::: tip
If `x = 75`, rule-2 matches even though rule-3 would also be true.
:::

## Catch-All Rules

Always include a catch-all as the last rule:

```typescript
{
  id: "default",
  when: () => true,
  emit: () => ({ status: "DEFAULT", reason: "No specific rule matched" }),
  explain: () => "No other conditions applied",
}
```

Without a catch-all, you may get `NO_MATCH` results.

## Patterns

### Simple Threshold

```typescript
{
  id: "above-limit",
  when: (input, profile) => input.value > profile.limit,
  emit: () => ({ exceeded: true }),
  explain: (input, profile) => `${input.value} > ${profile.limit}`,
}
```

### Multiple Conditions

```typescript
{
  id: "premium-eligible",
  when: (input, profile) =>
    input.accountAge > profile.minAge &&
    input.balance > profile.minBalance,
  emit: () => ({ eligible: true, tier: "PREMIUM" }),
  explain: (input, profile) =>
    `Account age ${input.accountAge} months > ${profile.minAge} AND ` +
    `balance ${input.balance} > ${profile.minBalance}`,
}
```

### List Membership

```typescript
{
  id: "blocked-country",
  when: (input, profile) => profile.blockedCountries.includes(input.country),
  emit: () => ({ allowed: false, reason: "Country restricted" }),
  explain: (input) => `Country ${input.country} is on blocklist`,
}
```

### Dynamic Output

```typescript
{
  id: "calculate-discount",
  when: (input, profile) => input.orderTotal > profile.discountThreshold,
  emit: (input, profile) => ({
    discount: input.orderTotal * profile.discountRate,
    finalPrice: input.orderTotal * (1 - profile.discountRate),
  }),
  explain: (input, profile) =>
    `${profile.discountRate * 100}% discount applied to ${input.orderTotal}`,
}
```

## Best Practices

1. **Order by specificity** - Most specific rules first
2. **Keep conditions simple** - Complex logic = harder to debug
3. **Write clear explanations** - They appear in audit logs
4. **Always include a catch-all** - Avoid undefined behavior
5. **Use descriptive IDs** - `high-risk-amount` not `rule1`
