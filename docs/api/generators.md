# @criterionx/generators

Code generation tools for Criterion decision engine. Define decisions declaratively and generate runtime code.

## Installation

```bash
npm install @criterionx/generators @criterionx/core
```

## Overview

The generators package provides two main capabilities:

1. **Runtime Parsing** - Parse declarative specs into runtime decisions
2. **Code Generation** - Generate TypeScript code from specs

## Decision Specification Format

Decisions are defined in a declarative JSON/YAML format:

```typescript
const spec: DecisionSpec = {
  id: "eligibility",
  version: "1.0.0",
  description: "Check user eligibility",
  input: {
    age: { type: "number", min: 0 },
    creditScore: { type: "number", min: 300, max: 850 }
  },
  output: {
    eligible: { type: "boolean" },
    reason: { type: "string" }
  },
  profile: {
    minAge: { type: "number" },
    minScore: { type: "number" }
  },
  rules: [
    {
      id: "too-young",
      when: [{ field: "input.age", operator: "lt", value: "$profile.minAge" }],
      emit: { eligible: false, reason: "Minimum age not met" }
    },
    {
      id: "low-score",
      when: [{ field: "input.creditScore", operator: "lt", value: "$profile.minScore" }],
      emit: { eligible: false, reason: "Credit score too low" }
    },
    {
      id: "approved",
      when: "always",
      emit: { eligible: true, reason: "All requirements met" }
    }
  ]
};
```

## Runtime Parsing

### parseDecisionSpec

Parse a specification into a runtime Decision.

```typescript
import { parseDecisionSpec } from '@criterionx/generators';
import { Engine } from '@criterionx/core';

const decision = parseDecisionSpec(spec);
const engine = new Engine();

const result = engine.run(decision,
  { age: 25, creditScore: 720 },
  { profile: { minAge: 18, minScore: 650 } }
);
```

### parseDecisionSpecs

Parse multiple specifications.

```typescript
import { parseDecisionSpecs } from '@criterionx/generators';

const decisions = parseDecisionSpecs([spec1, spec2, spec3]);
// Returns Map<string, Decision>

const pricing = decisions.get('pricing');
```

## Code Generation

### generateDecisionCode

Generate TypeScript code from a specification.

```typescript
import { generateDecisionCode } from '@criterionx/generators';

const { code, decisionId, exportName } = generateDecisionCode(spec);

console.log(code);
// import { defineDecision } from "@criterionx/core";
// import { z } from "zod";
//
// export const eligibilityDecision = defineDecision({
//   id: "eligibility",
//   version: "1.0.0",
//   inputSchema: z.object({
//     age: z.number().min(0),
//     creditScore: z.number().min(300).max(850),
//   }),
//   ...
// });
```

#### Options

```typescript
generateDecisionCode(spec, {
  includeComments?: boolean;  // Include JSDoc comments (default: true)
  includeImports?: boolean;   // Include import statements (default: true)
  exportName?: string;        // Custom export name
});
```

### generateDecisionsFile

Generate a file with multiple decisions.

```typescript
import { generateDecisionsFile } from '@criterionx/generators';

const code = generateDecisionsFile([spec1, spec2, spec3]);
// Single file with all decisions and shared imports
```

## Schema Specification

### Field Types

| Type | Zod Equivalent | Options |
|------|----------------|---------|
| `string` | `z.string()` | `enum`, `optional`, `default` |
| `number` | `z.number()` | `min`, `max`, `optional`, `default` |
| `boolean` | `z.boolean()` | `optional`, `default` |
| `date` | `z.coerce.date()` | `optional`, `default` |
| `array` | `z.array()` | `items`, `optional` |
| `object` | `z.object()` | `properties`, `optional` |

### Examples

```typescript
// String with enum
{ type: "string", enum: ["active", "pending", "inactive"] }
// -> z.enum(["active", "pending", "inactive"])

// Number with range
{ type: "number", min: 0, max: 100 }
// -> z.number().min(0).max(100)

// Optional with default
{ type: "number", optional: true, default: 0 }
// -> z.number().optional().default(0)

// Array of strings
{ type: "array", items: "string" }
// -> z.array(z.string())

// Nested object
{
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "number" }
  }
}
// -> z.object({ name: z.string(), age: z.number() })
```

## Rule Conditions

### Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal | `{ operator: "eq", value: "active" }` |
| `neq` | Not equal | `{ operator: "neq", value: null }` |
| `gt` | Greater than | `{ operator: "gt", value: 100 }` |
| `gte` | Greater or equal | `{ operator: "gte", value: "$profile.min" }` |
| `lt` | Less than | `{ operator: "lt", value: 0 }` |
| `lte` | Less or equal | `{ operator: "lte", value: "$profile.max" }` |
| `in` | Value in array | `{ operator: "in", value: "$profile.allowed" }` |
| `contains` | Array contains | `{ operator: "contains", value: "admin" }` |
| `matches` | Regex match | `{ operator: "matches", value: "^[A-Z]+" }` |

### Field References

Reference input or profile values with paths:

```typescript
// Reference input
{ field: "input.age", operator: "gte", value: 18 }

// Reference profile in condition value
{ field: "input.score", operator: "gte", value: "$profile.minScore" }
```

### Always Match

Use `"always"` for catch-all rules:

```typescript
{
  id: "default",
  when: "always",
  emit: { result: "default" }
}
```

## Emit Expressions

### Static Values

```typescript
emit: { eligible: true, message: "Approved" }
```

### Field References

```typescript
emit: {
  result: "$input.value",
  threshold: "$profile.minValue"
}
```

### Expressions

```typescript
emit: {
  total: "$input.quantity * $profile.unitPrice",
  discounted: "$input.quantity * $profile.unitPrice * (1 - $profile.discount)"
}
```

## Rule Priority

Rules are evaluated in priority order (lower first):

```typescript
rules: [
  { id: "high-priority", priority: 1, when: [...], emit: {...} },
  { id: "normal", priority: 5, when: [...], emit: {...} },
  { id: "fallback", priority: 10, when: "always", emit: {...} }
]
```

## Use Cases

### Configuration-Driven Decisions

```typescript
// Load specs from database or config files
const specs = await loadDecisionSpecs();
const decisions = parseDecisionSpecs(specs);

// Use at runtime
const engine = new Engine();
const result = engine.run(
  decisions.get(decisionId)!,
  input,
  { profile }
);
```

### Build-Time Code Generation

```typescript
// generate-decisions.ts
import { generateDecisionsFile } from '@criterionx/generators';
import { writeFileSync } from 'fs';
import specs from './decision-specs.json';

const code = generateDecisionsFile(specs);
writeFileSync('src/generated/decisions.ts', code);
```

### YAML Configuration

```yaml
# decisions.yaml
- id: pricing
  version: "1.0.0"
  input:
    quantity:
      type: number
      min: 1
  output:
    total:
      type: number
  profile:
    unitPrice:
      type: number
  rules:
    - id: calculate
      when: always
      emit:
        total: "$input.quantity * $profile.unitPrice"
```

```typescript
import { parseDecisionSpec } from '@criterionx/generators';
import { load } from 'js-yaml';

const specs = load(readFileSync('decisions.yaml', 'utf8'));
const decisions = specs.map(parseDecisionSpec);
```
