# When NOT to Use Criterion

Criterion is intentionally limited in scope. Understanding what it's **not** designed for will save you time and frustration.

## What Criterion Is NOT

### Not a Workflow Engine

If you need to orchestrate multi-step processes with retries, timeouts, and state persistence:

```typescript
// ❌ NOT Criterion's job
await workflow()
  .step("validate", validateOrder)
  .step("charge", chargePayment)
  .step("fulfill", shipOrder)
  .onFailure("refund", issueRefund)
  .run();
```

**Use instead:**
- [Temporal](https://temporal.io/) — Durable workflows
- [Inngest](https://inngest.com/) — Event-driven functions
- [Step Functions](https://aws.amazon.com/step-functions/) — AWS orchestration

**Criterion's role:** Make a single decision within a workflow step.

### Not a Machine Learning Framework

If you need probabilistic predictions, model training, or neural networks:

```typescript
// ❌ NOT Criterion's job
const score = model.predict(userFeatures);
const recommendation = rankItems(userHistory);
```

**Use instead:**
- scikit-learn, TensorFlow, PyTorch — ML training
- Feature stores — Feature engineering
- MLflow, Kubeflow — ML ops

**Criterion's role:** Apply thresholds to ML scores (`if score > threshold → action`).

### Not a Data Pipeline

If you need ETL, streaming, or data transformation:

```typescript
// ❌ NOT Criterion's job
pipeline()
  .extract(database)
  .transform(cleanData)
  .load(dataWarehouse)
```

**Use instead:**
- [Airflow](https://airflow.apache.org/) — Batch pipelines
- [Dagster](https://dagster.io/) — Data orchestration
- [Kafka Streams](https://kafka.apache.org/) — Real-time streaming

**Criterion's role:** A transformation step that applies business rules to each record.

### Not a Rules Marketplace

Criterion doesn't provide:
- Pre-built rule templates
- Industry-specific rule packs
- Drag-and-drop rule builders
- Visual rule editors for business users

**Why:** These add complexity and opinionated abstractions. Criterion stays small so you build exactly what you need.

### Not a No-Code Platform

Criterion is for developers. It requires:
- TypeScript/JavaScript knowledge
- Understanding of your business domain
- Code deployment process

Business users can:
- Read decision explanations
- Review audit logs
- Adjust profile parameters (if you build that UI)

But they cannot create or modify rules without code changes.

## When Simple If/Else Is Enough

Don't over-engineer. Use plain conditionals when:

### 1. Logic Is Trivial

```typescript
// Just use if/else
if (user.age >= 18) {
  return "allowed";
}
```

Criterion adds value when you have 5+ rules interacting, not for single checks.

### 2. No Audit Requirements

If no one will ever ask "why did this happen?", explanations are overhead.

### 3. Logic Never Varies

If the same rules apply everywhere (no profiles needed), the abstraction may not pay off.

### 4. You Control All the Code

If it's a personal project or small team with no compliance needs, direct code is simpler.

## Decision Tree

```
Do you need audit/explanation?
├── No → Consider plain if/else
└── Yes
    └── Does logic vary by context (region/tier/client)?
        ├── No → Consider plain if/else with logging
        └── Yes
            └── Do you have 5+ interacting rules?
                ├── No → Consider plain if/else
                └── Yes → Criterion is a good fit
```

## Common Misconceptions

### "Criterion replaces all business logic"

No. It handles **decisions**, not all logic. Data fetching, side effects, and I/O happen outside.

### "Criterion is faster than if/else"

No. It's actually slightly slower due to schema validation and trace generation. But:
- ~1M evaluations/sec is fast enough for most use cases
- The overhead enables debugging and auditing
- The real win is maintainability, not raw speed

### "Criterion works with any data store"

Criterion is **pure** — it doesn't know about databases. You:
1. Fetch data from your store
2. Pass it to Criterion
3. Store the result if needed

### "Profiles are a database"

Profiles are **configuration**, not data storage. They're typically:
- Loaded at startup
- Cached in memory
- Changed via deployments or config systems

If you need dynamic per-request profiles, you load them yourself and pass them in.

## Hybrid Approaches

Criterion works well alongside other tools:

```typescript
// ML score + business rules
const mlScore = await model.predict(features);
const decision = engine.run(riskDecision, {
  ...input,
  mlScore,  // Pass ML output as input
}, { profile });
```

```typescript
// Workflow step using Criterion
workflow.step("approve", async (ctx) => {
  const decision = engine.run(approvalDecision, ctx.data, { profile });
  if (decision.data.approved) {
    return ctx.next("process");
  }
  return ctx.next("review");
});
```

## Summary

| Need | Tool |
|------|------|
| Multi-step workflows | Temporal, Inngest |
| ML predictions | scikit-learn, TensorFlow |
| Data pipelines | Airflow, Dagster |
| Visual rule builder | Commercial BRM tools |
| Auditable business decisions | **Criterion** |
| Simple single conditions | Plain if/else |

## Next Steps

- [When to Use Criterion](/guide/when-to-use) — The ideal use cases
- [Rules: Code vs DB](/guide/rules-code-vs-db) — Where to store rules
