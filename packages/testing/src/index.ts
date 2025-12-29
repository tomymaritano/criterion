/**
 * @criterionx/testing
 *
 * Testing utilities for Criterion decisions
 */

// Test decision utility
export { testDecision } from "./test-decision.js";

// Fuzz testing
export { fuzz, checkProperty } from "./fuzz.js";

// Coverage analysis
export {
  coverage,
  formatCoverageReport,
  meetsCoverageThreshold,
  detectDeadRules,
} from "./coverage.js";

// Types
export type {
  TestCase,
  TestDecisionOptions,
  TestDecisionResult,
  TestFailure,
  FuzzOptions,
  FuzzResult,
  FuzzError,
  CoverageOptions,
  CoverageReport,
} from "./types.js";

// Re-export fast-check for convenience
export * as fc from "fast-check";
