# What is Criterion?

Criterion is a **universal decision engine** for business-critical decisions. It provides a declarative, deterministic, and fully explainable way to encode business logic.

## The Problem

Business rules are everywhere:

- Should this transaction be flagged as high-risk?
- Is this user eligible for a premium tier?
- What discount applies to this order?
- Should this loan application be approved?

These rules often end up scattered across codebases as nested `if/else` statements, making them:

- **Hard to audit** - Where exactly is the logic?
- **Hard to test** - Too many code paths
- **Hard to explain** - Why was this decision made?
- **Hard to change** - Fear of breaking something

## The Solution

Criterion provides a structured way to define decisions:

```typescript
const decision = {
  id: "loan-approval",
  version: "1.0.0",
  inputSchema,     // What data do we need?
  outputSchema,    // What do we return?
  profileSchema,   // What parameters can vary?
  rules: [...]     // The actual logic
};
```

Each decision is:

- **Pure** - No side effects, no I/O
- **Deterministic** - Same input → same output
- **Explainable** - Every rule has an `explain` function
- **Validated** - Zod schemas catch invalid data
- **Auditable** - Full trace of which rules were evaluated

## Core Principles

### 1. Pure Core

The engine never performs I/O. It receives data, evaluates rules, and returns a result. Fetching data, logging, and persistence happen outside.

### 2. Mandatory Contracts

Every decision declares its input, output, and profile schemas using Zod. Invalid data is rejected before rule evaluation begins.

### 3. Determinism

Given the same input and profile, the engine always returns the same result. No randomness, no time-dependent logic, no external state.

### 4. Explainability

Every decision result includes:
- Which rule matched
- Why it matched (via `explain`)
- Which rules were evaluated
- The full evaluation trace

### 5. Small Core

Criterion does one thing: evaluate decisions. It doesn't fetch data, send notifications, or manage workflows. Integrations happen in userland.

## When to Use Criterion

Criterion is ideal for:

- **Risk assessment** - Transaction monitoring, fraud detection
- **Eligibility checks** - User tiers, feature access, discounts
- **Compliance rules** - Regulatory requirements, policy enforcement
- **Approval workflows** - Loan decisions, claim processing
- **Dynamic configuration** - A/B testing, feature flags with logic

## When NOT to Use Criterion

Criterion is not designed for:

- **Stateful workflows** - Use a workflow engine
- **Machine learning** - Use ML frameworks
- **Complex event processing** - Use a CEP system
- **Real-time streaming** - Use stream processors

## Next Steps

- [Getting Started](/guide/getting-started) - Install and run your first decision
- [Core Concepts](/guide/core-concepts) - Understand the building blocks
