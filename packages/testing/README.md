# @criterionx/testing

Testing utilities for Criterion decisions. Provides property-based testing, fuzzing, and coverage analysis.

## Installation

```bash
npm install @criterionx/testing
# or
pnpm add @criterionx/testing
```

## Features

- **testDecision** - Test decisions with expected outcomes
- **fuzz** - Fuzz testing with random inputs
- **checkProperty** - Property-based testing with fast-check
- **coverage** - Rule coverage analysis
- **detectDeadRules** - Dead code detection

## Usage

### Testing Decisions

```typescript
import { testDecision } from "@criterionx/testing";
import { riskDecision } from "./decisions";

const result = testDecision(riskDecision, {
  profile: defaultProfile,
  cases: [
    {
      name: "high risk transaction",
      input: { amount: 50000, country: "US" },
      expected: { status: "OK", ruleId: "high-amount" },
    },
    {
      name: "blocked country",
      input: { amount: 100, country: "NK" },
      expected: { status: "OK", ruleId: "blocked-country" },
    },
  ],
  expect: {
    noUnreachableRules: true,
  },
});

console.log(result.passed); // true or false
console.log(result.failures); // Array of test failures
console.log(result.rulesCovered); // Rules that were exercised
```

### Fuzz Testing

```typescript
import { fuzz, fc } from "@criterionx/testing";

const result = fuzz(riskDecision, {
  profile: defaultProfile,
  iterations: 1000,
  inputArbitrary: fc.record({
    amount: fc.integer({ min: 0, max: 100000 }),
    country: fc.constantFrom("US", "UK", "NK", "DE"),
  }),
});

console.log(result.totalRuns); // 1000
console.log(result.failed); // Number of failures
console.log(result.ruleDistribution); // Hits per rule
```

### Property-Based Testing

```typescript
import { checkProperty, fc } from "@criterionx/testing";

const result = checkProperty(riskDecision, {
  profile: defaultProfile,
  inputArbitrary: fc.record({
    amount: fc.integer({ min: 0, max: 100000 }),
    country: fc.constantFrom("US", "UK"),
  }),
  property: (input, result) => {
    // Property: valid inputs should never return INVALID_OUTPUT
    return result.status !== "INVALID_OUTPUT";
  },
  numRuns: 100,
});

if (!result.passed) {
  console.log("Property violated with:", result.counterExample);
}
```

### Coverage Analysis

```typescript
import { coverage, formatCoverageReport, meetsCoverageThreshold } from "@criterionx/testing";

const report = coverage(riskDecision, {
  profile: defaultProfile,
  testCases: [
    { input: { amount: 100, country: "NK" } },
    { input: { amount: 50000, country: "US" } },
    { input: { amount: 100, country: "US" } },
  ],
});

console.log(formatCoverageReport(report));
// === Rule Coverage Report ===
// Coverage: 3/3 rules (100.0%)
// Covered rules:
//   ✓ blocked-country (1 hits)
//   ✓ high-amount (1 hits)
//   ✓ default (1 hits)

if (!meetsCoverageThreshold(report, 80)) {
  throw new Error("Coverage below 80%");
}
```

### Dead Code Detection

```typescript
import { detectDeadRules } from "@criterionx/testing";

const deadRules = detectDeadRules(myDecision);
if (deadRules.length > 0) {
  console.warn("Dead rules detected:", deadRules);
}
```

## API Reference

### `testDecision(decision, options)`

Test a decision with provided test cases.

**Options:**
- `profile` - Profile to use for evaluation
- `cases` - Array of test cases with input, profile, and expected outcomes
- `expect.noUnreachableRules` - Fail if any rules aren't covered

**Returns:** `TestDecisionResult` with `passed`, `failures`, `rulesCovered`, `rulesUncovered`

### `fuzz(decision, options)`

Run fuzz tests on a decision.

**Options:**
- `profile` - Profile to use
- `iterations` - Number of random inputs (default: 100)
- `inputArbitrary` - fast-check arbitrary for generating inputs
- `seed` - Seed for reproducibility

**Returns:** `FuzzResult` with `totalRuns`, `passed`, `failed`, `errors`, `ruleDistribution`

### `checkProperty(decision, options)`

Run property-based tests.

**Options:**
- `profile` - Profile to use
- `inputArbitrary` - fast-check arbitrary for inputs
- `property` - Function that returns true if property holds
- `numRuns` - Number of test runs (default: 100)
- `seed` - Seed for reproducibility

**Returns:** `{ passed, counterExample?, error? }`

### `coverage(decision, options)`

Analyze rule coverage.

**Options:**
- `profile` - Profile to use
- `testCases` - Array of inputs to test

**Returns:** `CoverageReport` with coverage percentage and rule hit counts

### `detectDeadRules(decision)`

Detect potentially unreachable rules.

**Returns:** Array of rule IDs that appear after catch-all rules

## License

MIT
