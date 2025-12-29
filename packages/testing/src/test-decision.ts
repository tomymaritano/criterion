import { Engine, type Decision, type Result } from "@criterionx/core";
import type {
  TestDecisionOptions,
  TestDecisionResult,
  TestFailure,
  TestCase,
} from "./types.js";

const engine = new Engine();

/**
 * Test a decision with provided test cases and assertions
 */
export function testDecision<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  options: TestDecisionOptions<TInput, TOutput, TProfile>
): TestDecisionResult {
  const failures: TestFailure[] = [];
  const ruleHits = new Map<string, number>();

  // Initialize rule hits counter
  for (const rule of decision.rules) {
    ruleHits.set(rule.id, 0);
  }

  // Run test cases
  if (options.cases) {
    for (const testCase of options.cases) {
      const profile = testCase.profile ?? options.profile;
      const result = engine.run(decision, testCase.input, { profile });

      // Track rule coverage
      if (result.status === "OK" && result.meta.matchedRule) {
        const current = ruleHits.get(result.meta.matchedRule) ?? 0;
        ruleHits.set(result.meta.matchedRule, current + 1);
      }

      // Validate expectations
      if (testCase.expected) {
        const caseFailures = validateExpectations(
          testCase,
          result,
          testCase.name
        );
        failures.push(...caseFailures);
      }
    }
  }

  // Check for unreachable rules
  if (options.expect?.noUnreachableRules) {
    for (const [ruleId, hits] of ruleHits) {
      if (hits === 0) {
        failures.push({
          type: "unreachable_rule",
          message: `Rule "${ruleId}" was never matched by any test case`,
          details: { ruleId },
        });
      }
    }
  }

  // Calculate coverage
  const rulesCovered = [...ruleHits.entries()]
    .filter(([, hits]) => hits > 0)
    .map(([id]) => id);

  const rulesUncovered = [...ruleHits.entries()]
    .filter(([, hits]) => hits === 0)
    .map(([id]) => id);

  return {
    passed: failures.length === 0,
    failures,
    rulesCovered,
    rulesUncovered,
  };
}

function validateExpectations<TInput, TOutput, TProfile>(
  testCase: TestCase<TInput, TOutput, TProfile>,
  result: Result<TOutput>,
  caseName?: string
): TestFailure[] {
  const failures: TestFailure[] = [];
  const { expected } = testCase;
  const caseLabel = caseName ?? JSON.stringify(testCase.input);

  if (!expected) return failures;

  // Check status
  if (expected.status && result.status !== expected.status) {
    failures.push({
      type: "case_failed",
      message: `Test case "${caseLabel}" expected status "${expected.status}" but got "${result.status}"`,
      details: {
        testCase: caseLabel,
        expected: expected.status,
        actual: result.status,
      },
    });
  }

  // Check matched rule
  if (expected.ruleId && result.meta.matchedRule !== expected.ruleId) {
    failures.push({
      type: "case_failed",
      message: `Test case "${caseLabel}" expected rule "${expected.ruleId}" but got "${result.meta.matchedRule ?? "none"}"`,
      details: {
        testCase: caseLabel,
        expected: expected.ruleId,
        actual: result.meta.matchedRule,
      },
    });
  }

  // Check output (partial match)
  if (expected.output && result.data) {
    for (const [key, value] of Object.entries(expected.output)) {
      const actualValue = (result.data as Record<string, unknown>)[key];
      if (!deepEqual(actualValue, value)) {
        failures.push({
          type: "case_failed",
          message: `Test case "${caseLabel}" expected output.${key} to be ${JSON.stringify(value)} but got ${JSON.stringify(actualValue)}`,
          details: {
            testCase: caseLabel,
            expected: { [key]: value },
            actual: { [key]: actualValue },
          },
        });
      }
    }
  }

  return failures;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    )
      return false;
  }

  return true;
}
