import { Engine, type Decision } from "@criterionx/core";
import type { CoverageOptions, CoverageReport } from "./types.js";

const engine = new Engine();

/**
 * Analyze rule coverage for a decision
 *
 * Reports which rules have been exercised by the provided test cases
 */
export function coverage<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  options: CoverageOptions<TInput, TProfile>
): CoverageReport {
  const ruleHits: Record<string, number> = {};
  const testCases = options.testCases ?? [];

  // Initialize rule hits
  for (const rule of decision.rules) {
    ruleHits[rule.id] = 0;
  }

  // Run each test case
  for (const testCase of testCases) {
    const result = engine.run(decision, testCase.input, {
      profile: options.profile,
    });

    if (result.status === "OK" && result.meta.matchedRule) {
      ruleHits[result.meta.matchedRule]++;
    }
  }

  // Calculate coverage
  const totalRules = decision.rules.length;
  const rulesCovered = Object.entries(ruleHits)
    .filter(([, hits]) => hits > 0)
    .map(([id]) => id);
  const rulesUncovered = Object.entries(ruleHits)
    .filter(([, hits]) => hits === 0)
    .map(([id]) => id);
  const coveredRules = rulesCovered.length;
  const coveragePercentage =
    totalRules > 0 ? (coveredRules / totalRules) * 100 : 100;

  return {
    totalRules,
    coveredRules,
    coveragePercentage,
    rulesCovered,
    rulesUncovered,
    ruleHits,
  };
}

/**
 * Generate a coverage report as a formatted string
 */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];

  lines.push("=== Rule Coverage Report ===");
  lines.push("");
  lines.push(
    `Coverage: ${report.coveredRules}/${report.totalRules} rules (${report.coveragePercentage.toFixed(1)}%)`
  );
  lines.push("");

  if (report.rulesCovered.length > 0) {
    lines.push("Covered rules:");
    for (const ruleId of report.rulesCovered) {
      const hits = report.ruleHits[ruleId];
      lines.push(`  ✓ ${ruleId} (${hits} hits)`);
    }
  }

  if (report.rulesUncovered.length > 0) {
    lines.push("");
    lines.push("Uncovered rules:");
    for (const ruleId of report.rulesUncovered) {
      lines.push(`  ✗ ${ruleId}`);
    }
  }

  return lines.join("\n");
}

/**
 * Check if coverage meets a threshold
 */
export function meetsCoverageThreshold(
  report: CoverageReport,
  threshold: number
): boolean {
  return report.coveragePercentage >= threshold;
}

/**
 * Analyze which rules are potentially dead code
 *
 * A rule is considered potentially dead if:
 * 1. It was never matched in fuzzing
 * 2. It comes after a rule that always matches (like a catch-all)
 */
export function detectDeadRules<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>
): string[] {
  const deadRules: string[] = [];
  let foundCatchAll = false;

  for (const rule of decision.rules) {
    if (foundCatchAll) {
      // Any rule after a catch-all is potentially dead
      deadRules.push(rule.id);
      continue;
    }

    // Check if this rule is a catch-all (when always returns true)
    // We do this by checking if the when function has a simple body
    const whenStr = rule.when.toString();
    if (
      whenStr.includes("=> true") ||
      whenStr.includes("return true") ||
      whenStr.includes("()=>true")
    ) {
      foundCatchAll = true;
    }
  }

  return deadRules;
}
