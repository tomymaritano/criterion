import type { Arbitrary } from "fast-check";

/**
 * Test case for a decision
 */
export interface TestCase<TInput, TOutput, TProfile> {
  name?: string;
  input: TInput;
  profile: TProfile;
  expected?: {
    status?: "OK" | "NO_MATCH" | "INVALID_INPUT" | "INVALID_OUTPUT";
    ruleId?: string;
    output?: Partial<TOutput>;
  };
}

/**
 * Options for testDecision
 */
export interface TestDecisionOptions<TInput, TOutput, TProfile> {
  profile: TProfile;
  cases?: TestCase<TInput, TOutput, TProfile>[];
  expect?: {
    /** All rules should be reachable (have at least one matching case) */
    noUnreachableRules?: boolean;
    /** No rules should always fail */
    noDeadCode?: boolean;
  };
}

/**
 * Result of testDecision
 */
export interface TestDecisionResult {
  passed: boolean;
  failures: TestFailure[];
  rulesCovered: string[];
  rulesUncovered: string[];
}

/**
 * A test failure
 */
export interface TestFailure {
  type: "case_failed" | "unreachable_rule" | "dead_code";
  message: string;
  details?: {
    testCase?: string;
    ruleId?: string;
    expected?: unknown;
    actual?: unknown;
  };
}

/**
 * Options for fuzz testing
 */
export interface FuzzOptions<TInput, TProfile> {
  /** Number of iterations */
  iterations?: number;
  /** Profile to use */
  profile: TProfile;
  /** Custom input arbitrary (for property-based testing) */
  inputArbitrary?: Arbitrary<TInput>;
  /** Seed for reproducibility */
  seed?: number;
}

/**
 * Result of fuzz testing
 */
export interface FuzzResult<TInput> {
  totalRuns: number;
  passed: number;
  failed: number;
  errors: FuzzError<TInput>[];
  ruleDistribution: Record<string, number>;
}

/**
 * A fuzz error
 */
export interface FuzzError<TInput> {
  input: TInput;
  error: string;
  iteration: number;
}

/**
 * Options for coverage analysis
 */
export interface CoverageOptions<TInput, TProfile> {
  profile: TProfile;
  testCases?: Array<{ input: TInput }>;
}

/**
 * Coverage report
 */
export interface CoverageReport {
  totalRules: number;
  coveredRules: number;
  coveragePercentage: number;
  rulesCovered: string[];
  rulesUncovered: string[];
  ruleHits: Record<string, number>;
}
