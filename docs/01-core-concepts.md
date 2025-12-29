# Core Concepts

## Decision
A Decision is a versioned unit of business logic:
- `id`, `version`
- input contract (schema)
- output contract (schema)
- ordered rules
- metadata (tags, tier, owner, etc.)

## Context
Context is a set of **facts** provided by the host system.
The engine does not fetch data.

Context should be immutable during evaluation.

## Rule
A Rule is:
- deterministic
- side-effect free
- explainable

A rule:
- evaluates a condition against context + profile
- emits an output if it matches
- provides an explanation (human readable)

Rules are evaluated in order; execution is controlled by the engine.

## Decision Profile
A Profile parameterizes a decision:
- thresholds
- sensitivity
- interpretation settings

Profiles are injected explicitly at runtime.
Profiles are not facts.

## Result
Every run returns a Result containing:
- `status` (OK / NO_MATCH / INVALID_INPUT / INVALID_OUTPUT)
- `data` (validated output or null)
- `meta` (trace: evaluated rules, matched rule, explanations, runtime info)
