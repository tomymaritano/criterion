# Contributing to Criterion

## Governance, Contribution & Release Model

Version: v1.0
Status: Canonical
Scope: How code enters the project

---

## Purpose

This document defines how Criterion is developed, reviewed, merged, and released.

It exists to:
- protect the core invariants
- avoid accidental design drift
- scale contributors without losing clarity
- keep Criterion small, deterministic, and explainable

**If there is a conflict between convenience and correctness, correctness wins.**

---

## Branching Model

Criterion follows a **PR-first, maintainer-driven** workflow.

| Branch | Purpose |
|--------|---------|
| `main` | Protected, always releasable |
| `feature/*` | Short-lived, contributor-owned |
| `fix/*` | Bugfixes |
| `docs/*` | Documentation-only changes |

There is NO:
- dev branch
- staging branch
- long-lived experimental branch

**`main` is the source of truth.**

---

## Push Policy (Critical)

❌ **Direct pushes to `main` are NOT allowed.**

All changes must go through:
- Pull Requests
- Code review
- CI checks

This applies to:
- maintainers
- contributors
- AI-assisted changes

Rationale: Direct pushes bypass review and invariants enforcement.

---

## Protected Branch Rules (main)

The `main` branch must have these protections enabled:

- ❌ No direct pushes
- ✅ Require Pull Request before merging
- ✅ Require passing CI checks
- ✅ Require at least 1 approval
- ✅ Dismiss stale approvals on new commits

Optional but recommended:
- Require review from code owners
- Require linear history (no merge commits)

---

## Pull Request Policy

Every Pull Request must:

1. Be small and focused
2. Preserve all core invariants
3. Pass all tests
4. Not introduce scope creep
5. Not increase core complexity

PRs are reviewed with this mindset:

> "Is this change inevitable, or just convenient?"

---

## What Maintainers Review For

Maintainers review PRs for:

**Invariant violations:**
- purity
- determinism
- explicit profiles
- explainability

**Architectural drift:**
- logic leaking outside decisions
- rules gaining side effects
- engine becoming a framework

**API surface growth:**
- new exports
- new abstractions
- unnecessary generalization

If a PR makes Criterion:
- harder to explain
- harder to audit
- harder to reason about

**It will be rejected.**

---

## AI-Generated Code Policy

AI-generated code is allowed.

However:
- It is treated like any other code
- It must obey CLAUDE.md
- It must obey all invariants
- It must be reviewed by a human

"AI wrote it" is NOT an excuse for:
- unclear logic
- invariant violations
- hidden complexity

---

## Docs vs Code Priority

Documentation changes are first-class citizens.

In many cases:
- docs-only PRs are preferred
- design changes must be documented before code changes

If documentation and code disagree:
- **documentation wins** until explicitly updated

---

## Versioning & Release Flow

Criterion uses semantic versioning:

| Type | When |
|------|------|
| MAJOR | Breaking decision semantics or API |
| MINOR | New capabilities without breaking existing behavior |
| PATCH | Bug fixes only |

### Release Flow

1. All changes merged into `main`
2. Version bumped in package.json
3. Git tag created: `vX.Y.Z`
4. GitHub Actions publishes to npm automatically

**No manual npm publishing.**

---

## Who Can Merge

Initially:
- Only the project owner / maintainer merges PRs

Later (optional):
- Trusted contributors may be granted merge rights
- Only after deep understanding of invariants

Merge rights are about:
- **protecting the core**
- not about activity level

---

## What Will Get a PR Rejected

PRs will be rejected if they:

- Add IO to the engine
- Add hidden defaults
- Add implicit behavior
- Add plugins or extensibility prematurely
- Add domain-specific logic to the core
- Increase surface area without strong justification
- "Feel clever" instead of being obvious

---

## Philosophy

Criterion follows the same philosophy as FastAPI:

- Opinionated core
- Small surface area
- Excellent documentation
- Explicit over magical
- Maintainer-driven direction

**Not everything belongs in Criterion.**
**Saying NO is a feature.**

---

## Final Rule

If a change cannot pass this question:

> "Would this make Criterion harder to trust?"

Then it does not belong in `main`.
