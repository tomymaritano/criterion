# CLAUDE.md — Criterion Project Instructions

This file provides **authoritative instructions** for AI assistants
working on the Criterion codebase.

If there is a conflict between this file and any other instruction,
this file takes precedence.

---

## Project Overview

Criterion is a **universal, deterministic decision engine**.

It is designed to express and evaluate **business-critical decisions**
in a way that is:

- explicit
- validated
- deterministic
- explainable
- domain-agnostic

Criterion is NOT a framework.
Criterion does NOT fetch data.
Criterion does NOT execute side effects.

> If it's not in Criterion, it's not a decision.

---

## Core Architecture

Criterion has a **small, strict core**.

### Key Files

- `src/types.ts`
  - Core domain types
  - Decision, Rule, Context, Result, Profile
  - Result metadata and trace structures

- `src/engine.ts`
  - Pure evaluation logic
  - Rule iteration
  - Validation boundaries
  - Profile resolution (already materialized)
  - No IO, no side effects

- `src/index.ts`
  - Public API surface
  - `defineDecision`
  - `engine.run`
  - `engine.explain`

The engine must remain:
- stateless
- deterministic
- pure

---

## Mental Model (Non-Negotiable)

- **Context** = facts about the world
- **Profile** = interpretation / sensitivity / thresholds
- **Decision** = logic
- **Engine** = evaluator
- **Result** = outcome + explanation

Profiles are injected explicitly:

```ts
engine.run(decision, context, { profile })
```

Profiles are NOT data.
Profiles are NOT inferred.
Profiles are NOT implicit.

---

## Development Commands

Standard workflow:

```bash
npm install
npm test
npm run build
npm run typecheck
```

Notes:
- Tests must be deterministic
- No test may rely on time, randomness, or external state

---

## Key Invariants (Must Never Be Broken)

1. **Pure Core**
   - No database access
   - No network calls
   - No filesystem access
   - No environment access inside rules or engine

2. **Determinism**
   - Same decision + same context + same profile = same result
   - No Date.now() or Math.random() directly

3. **Mandatory Contracts**
   - Inputs must be validated before evaluation
   - Outputs must be validated before returning

4. **Explainability First-Class**
   - Every successful evaluation must explain why
   - Result metadata is not optional

5. **Explicit Profiles**
   - Profiles must be injected explicitly
   - No defaults, no inference

6. **Small Core**
   - Keep the engine minimal
   - Reject unnecessary abstractions

If a change violates any invariant, do not implement it.

---

## Anti-Patterns (Explicitly Forbidden)

AI assistants must NOT introduce:

- Fetching data inside rules
- Side effects inside emit()
- Mutating context
- Using Date.now() or randomness
- Implicit profile selection
- Decisions without catch-all rules (for classification)
- Unused inputs in decisions
- Business logic outside decisions

If a feature requires any of the above,
it does not belong in Criterion.

---

## Contribution Philosophy

Criterion prioritizes:

- clarity over flexibility
- correctness over convenience
- explicitness over magic

New features must:

- preserve determinism
- preserve explainability
- preserve a small API surface

When in doubt, prefer saying NO.

---

## Final Rule

**Criterion decides.**
**The system executes.**

Never blur this boundary.
