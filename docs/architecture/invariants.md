# Invariants (Non-negotiables)

## 1) Pure Core
- No DB reads/writes
- No network calls
- No IO
- No shared mutable state

## 2) Contracts Mandatory
- Inputs must validate before evaluation
- Outputs must validate before returning

## 3) Determinism
- Same decision version + same context + same profile → same result
- No Date.now() directly inside rules (inject time if needed)

## 4) Explainability First-Class
- Every match must explain why
- Result includes trace of evaluated rules

## 5) Opinionated by Design
- Some patterns are forbidden
- Minimal surface area is a feature

## 6) Small Core
- Keep the engine small
- If the core grows fast, the design is wrong

## 7) Total Classification
- Classification decisions must cover all valid inputs
- NO_MATCH should only occur for truly exceptional cases
- Always include a catch-all rule as last option

## 8) No Dead Inputs
- Every input must participate in at least one rule
- Unused inputs indicate design error
- Remove or use — no exceptions

## 9) External Profile Resolution
- Profiles are resolved outside the engine
- Engine receives materialized profile values
- Engine never reads files or network

## 10) Single Source of Truth
- Result.meta is the only source of explanation
- Helper methods are formatters, not data sources
- No duplicate or conflicting information
