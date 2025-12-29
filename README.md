# Criterion

Criterion is a **universal decision engine** for defining and executing business-critical decisions with:

- **Mandatory contracts** (validated inputs & outputs)
- **Deterministic evaluation** (same inputs → same result)
- **Explainability first-class** (every result has a reason + trace)
- **Zero side effects** (no DB, no fetch, no IO inside decisions)

> If it's not in Criterion, it's not a decision.

## What Criterion is

Criterion is **not** a web framework and it does **not** fetch data.
It runs decisions against a provided **Context**.

A decision is a small, explicit unit of business logic:
- inputs (schema)
- outputs (schema)
- rules (ordered)
- explanations (trace)

## What Criterion is not

Criterion is **not**:
- a workflow/BPMN engine
- an enterprise rules platform
- a plugin marketplace
- a data pipeline
- a forecasting system

Criterion is a **micro engine**: small core, strict boundaries.

## Decision Profiles (key idea)

Criterion supports **Decision Profiles**: the same decision, different thresholds/sensitivity.

Profiles are injected explicitly at runtime:

```ts
engine.run(decision, context, { profile: "high-inflation" })
```

Profiles are not data. They are interpretation settings.

## Repository structure

- `docs/` — foundational documentation
- `examples/` — decision specs in declarative formats (no code required)
- `diagrams/` — Mermaid diagrams for architecture (optional early)
- `src/` — future minimal TS implementation (later)

## Examples (domain-agnostic)

Finance:
- `examples/finance/currency-exposure-risk/` — generic currency risk using profiles

Non-financial:
- `examples/eligibility/user-tier-eligibility/` — user tier eligibility decision

## Start here

- `docs/00-manifesto.md`
- `docs/04-decision-profiles.md`
- `examples/finance/currency-exposure-risk/decision.xml`
- `examples/eligibility/user-tier-eligibility/decision.xml`

## License

MIT
