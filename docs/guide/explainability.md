# Explainability

Every Criterion decision is fully explainable. You always know *why* a result was reached.

## The Explain Function

Every rule has an `explain` function:

```typescript
{
  id: "high-risk",
  when: (input, profile) => input.amount > profile.threshold,
  emit: () => ({ risk: "HIGH" }),
  explain: (input, profile) =>
    `Amount ${input.amount} exceeds threshold ${profile.threshold}`,
}
```

## Result Metadata

Every result includes:

```typescript
{
  status: "OK",
  data: { risk: "HIGH" },
  meta: {
    decisionId: "risk-assessment",
    decisionVersion: "1.0.0",
    matchedRule: "high-risk",
    evaluatedRules: [
      { ruleId: "blocked-merchant", matched: false },
      { ruleId: "high-risk", matched: true, explanation: "Amount 15000 exceeds threshold 10000" }
    ],
    explanation: "Amount 15000 exceeds threshold 10000",
    evaluatedAt: "2024-01-15T10:30:00.000Z"
  }
}
```

## Human-Readable Output

Use `engine.explain()` for formatted output:

```typescript
console.log(engine.explain(result));

// Decision: risk-assessment v1.0.0
// Status: OK
// Matched: high-risk
// Reason: Amount 15000 exceeds threshold 10000
//
// Evaluation trace:
//   ✗ blocked-merchant
//   ✓ high-risk
```

## Use Cases

### Audit Logs

```typescript
const result = engine.run(decision, input, options);

await auditLog.save({
  decision: result.meta.decisionId,
  result: result.status,
  explanation: result.meta.explanation,
  trace: result.meta.evaluatedRules,
  timestamp: result.meta.evaluatedAt,
});
```

### User-Facing Explanations

```typescript
if (result.data?.approved === false) {
  showMessage(`Application denied: ${result.meta.explanation}`);
}
```

### Debugging

```typescript
// Why didn't my rule match?
result.meta.evaluatedRules.forEach(rule => {
  console.log(`${rule.ruleId}: ${rule.matched ? '✓' : '✗'}`);
});
```

## Best Practices

1. **Be specific** — Include actual values in explanations
2. **Be human-readable** — Write for end users, not developers
3. **Include thresholds** — "Amount 500 < minimum 1000" not "Amount too low"
4. **Use consistent format** — Same style across all rules
