# Decision Profiles

## What is a Profile?
A Decision Profile defines how a decision interprets a given context.

- Context describes facts.
- Profile describes thresholds/sensitivity.
- Decisions remain pure and reusable.

Profiles are injected explicitly at runtime:

```ts
engine.run(decision, context, { profile: "high-inflation" })
```

## Why not merge profile into context?
Because a profile is not a fact.
It is an interpretation layer, and must remain explicit.

## What belongs in a profile?
- thresholds (numbers)
- sensitivity modes (conservative/aggressive)
- domain-specific calibrations

## What does not belong in a profile?
- raw data (facts)
- side effects
- anything time-dependent unless explicitly injected

## Profile Resolution

Criterion does not load profiles by itself.
The host system is responsible for profile registration and resolution.

### Canonical Flow (ProfileRegistry)

```ts
const registry = new ProfileRegistry()

registry.register("high-inflation", {
  high_risk_inflation_threshold: 0.05,
  high_risk_horizon_days: 60,
  medium_risk_inflation_threshold: 0.03,
  medium_risk_horizon_days: 30
})

engine.run(decision, context, { profile: "high-inflation" }, registry)
```

- The engine never loads JSON or reads from disk
- Registry lives outside the core
- Profile ID is resolved to concrete values before evaluation

### Escape Hatch: Inline Profile Object

For testing, simulations, or research:

```ts
engine.run(decision, context, {
  profile: {
    high_risk_inflation_threshold: 0.05,
    high_risk_horizon_days: 60,
    medium_risk_inflation_threshold: 0.03,
    medium_risk_horizon_days: 30
  }
})
```

This is allowed but not recommended as the default pattern.

## Profile Validation

The engine validates that the provided profile contains all parameters
declared in the decision's `<profile-parameters>` schema.

Missing or mistyped parameters result in `INVALID_INPUT (profile invalid)`.

## Success criteria
- The same decision can be reused globally by swapping profiles
- The engine remains domain-agnostic
- Explainability includes the profile used
