# API Surface (Conceptual)

Criterion aims for a minimal public API.

## defineDecision(definition)
Defines a decision:
- id, version
- input schema
- output schema
- rules
- metadata

## engine.run(decision, context, options)
Evaluates a decision against a context.
Profiles are injected via options:

```ts
engine.run(decision, context, { profile: "high-inflation" })
```

## engine.explain(result)

A helper utility that formats the explanation for display.

The canonical explanation always lives in `result.meta.explanation`.
This method is a formatter, not a data source.

Returns a structured explanation:
- matched rule
- evaluated rules
- reasons
- profile used

```ts
// Canonical source (always available)
result.meta.explanation

// Formatter helper (optional)
engine.explain(result)
```
