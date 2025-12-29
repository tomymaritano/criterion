import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import * as fc from "fast-check";
import {
  testDecision,
  fuzz,
  checkProperty,
  coverage,
  formatCoverageReport,
  meetsCoverageThreshold,
  detectDeadRules,
} from "./index.js";

// Sample decision for testing
const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
  }),
  outputSchema: z.object({
    risk: z.enum(["low", "medium", "high"]),
    score: z.number(),
  }),
  profileSchema: z.object({
    threshold: z.number(),
    blockedCountries: z.array(z.string()),
  }),
  rules: [
    {
      id: "blocked-country",
      when: (ctx, profile) => profile.blockedCountries.includes(ctx.country),
      emit: () => ({ risk: "high" as const, score: 100 }),
      explain: (ctx) => `Country ${ctx.country} is blocked`,
    },
    {
      id: "high-amount",
      when: (ctx, profile) => ctx.amount > profile.threshold,
      emit: (ctx, profile) => ({
        risk: "high" as const,
        score: Math.min(100, (ctx.amount / profile.threshold) * 50),
      }),
      explain: (ctx, profile) =>
        `Amount ${ctx.amount} exceeds threshold ${profile.threshold}`,
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ risk: "low" as const, score: 0 }),
      explain: () => "Default low risk",
    },
  ],
});

const defaultProfile = {
  threshold: 10000,
  blockedCountries: ["NK", "IR"],
};

describe("testDecision", () => {
  it("should pass with correct expectations", () => {
    const result = testDecision(riskDecision, {
      profile: defaultProfile,
      cases: [
        {
          name: "blocked country",
          input: { amount: 100, country: "NK" },
          profile: defaultProfile,
          expected: { status: "OK", ruleId: "blocked-country" },
        },
        {
          name: "high amount",
          input: { amount: 50000, country: "US" },
          profile: defaultProfile,
          expected: { status: "OK", ruleId: "high-amount" },
        },
        {
          name: "default case",
          input: { amount: 100, country: "US" },
          profile: defaultProfile,
          expected: { status: "OK", ruleId: "default" },
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.rulesCovered).toContain("blocked-country");
    expect(result.rulesCovered).toContain("high-amount");
    expect(result.rulesCovered).toContain("default");
  });

  it("should fail with incorrect expectations", () => {
    const result = testDecision(riskDecision, {
      profile: defaultProfile,
      cases: [
        {
          name: "wrong rule expected",
          input: { amount: 100, country: "US" },
          profile: defaultProfile,
          expected: { ruleId: "high-amount" },
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].type).toBe("case_failed");
  });

  it("should detect unreachable rules", () => {
    const result = testDecision(riskDecision, {
      profile: defaultProfile,
      cases: [
        {
          input: { amount: 100, country: "US" },
          profile: defaultProfile,
        },
      ],
      expect: { noUnreachableRules: true },
    });

    expect(result.passed).toBe(false);
    expect(result.rulesUncovered).toContain("blocked-country");
    expect(result.rulesUncovered).toContain("high-amount");
  });
});

describe("fuzz", () => {
  it("should run fuzz tests without errors", () => {
    const result = fuzz(riskDecision, {
      profile: defaultProfile,
      iterations: 50,
      inputArbitrary: fc.record({
        amount: fc.integer({ min: 0, max: 100000 }),
        country: fc.constantFrom("US", "UK", "NK", "IR", "DE"),
      }),
    });

    expect(result.totalRuns).toBe(50);
    expect(result.failed).toBe(0);
  });

  it("should track rule distribution", () => {
    const result = fuzz(riskDecision, {
      profile: defaultProfile,
      iterations: 100,
      inputArbitrary: fc.record({
        amount: fc.integer({ min: 0, max: 100000 }),
        country: fc.constantFrom("US", "UK", "NK"),
      }),
    });

    // Should have some distribution
    const totalHits = Object.values(result.ruleDistribution).reduce(
      (a, b) => a + b,
      0
    );
    expect(totalHits).toBe(100);
  });
});

describe("checkProperty", () => {
  it("should pass for valid properties", () => {
    const result = checkProperty(riskDecision, {
      profile: defaultProfile,
      inputArbitrary: fc.record({
        amount: fc.integer({ min: 0, max: 100000 }),
        country: fc.constantFrom("US", "UK", "DE"),
      }),
      property: (_input, result) => {
        // Property: result should always be OK for valid input
        return result.status === "OK";
      },
      numRuns: 50,
    });

    expect(result.passed).toBe(true);
  });

  it("should fail and provide counterexample for invalid properties", () => {
    const result = checkProperty(riskDecision, {
      profile: defaultProfile,
      inputArbitrary: fc.record({
        amount: fc.integer({ min: 0, max: 100000 }),
        country: fc.constantFrom("US", "UK"),
      }),
      property: (_input, result) => {
        // Property: risk should always be high (this will fail)
        const data = result.data as { risk?: string } | null;
        return data?.risk === "high";
      },
      numRuns: 50,
    });

    expect(result.passed).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("coverage", () => {
  it("should calculate coverage correctly", () => {
    const report = coverage(riskDecision, {
      profile: defaultProfile,
      testCases: [
        { input: { amount: 100, country: "NK" } },
        { input: { amount: 50000, country: "US" } },
        { input: { amount: 100, country: "US" } },
      ],
    });

    expect(report.totalRules).toBe(3);
    expect(report.coveredRules).toBe(3);
    expect(report.coveragePercentage).toBe(100);
    expect(report.rulesCovered).toHaveLength(3);
    expect(report.rulesUncovered).toHaveLength(0);
  });

  it("should report uncovered rules", () => {
    const report = coverage(riskDecision, {
      profile: defaultProfile,
      testCases: [{ input: { amount: 100, country: "US" } }],
    });

    expect(report.coveragePercentage).toBeLessThan(100);
    expect(report.rulesUncovered).toContain("blocked-country");
    expect(report.rulesUncovered).toContain("high-amount");
  });
});

describe("formatCoverageReport", () => {
  it("should format report correctly", () => {
    const report = coverage(riskDecision, {
      profile: defaultProfile,
      testCases: [
        { input: { amount: 100, country: "NK" } },
        { input: { amount: 100, country: "US" } },
      ],
    });

    const formatted = formatCoverageReport(report);

    expect(formatted).toContain("Rule Coverage Report");
    expect(formatted).toContain("Coverage:");
    expect(formatted).toContain("blocked-country");
  });
});

describe("meetsCoverageThreshold", () => {
  it("should return true when threshold is met", () => {
    const report = coverage(riskDecision, {
      profile: defaultProfile,
      testCases: [
        { input: { amount: 100, country: "NK" } },
        { input: { amount: 50000, country: "US" } },
        { input: { amount: 100, country: "US" } },
      ],
    });

    expect(meetsCoverageThreshold(report, 100)).toBe(true);
    expect(meetsCoverageThreshold(report, 80)).toBe(true);
  });

  it("should return false when threshold is not met", () => {
    const report = coverage(riskDecision, {
      profile: defaultProfile,
      testCases: [{ input: { amount: 100, country: "US" } }],
    });

    expect(meetsCoverageThreshold(report, 100)).toBe(false);
  });
});

describe("detectDeadRules", () => {
  it("should detect rules after catch-all", () => {
    const decisionWithDeadCode = defineDecision({
      id: "dead-code-test",
      version: "1.0.0",
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      profileSchema: z.object({}),
      rules: [
        {
          id: "catch-all",
          when: () => true,
          emit: () => ({ result: "caught" }),
          explain: () => "Catch all",
        },
        {
          id: "never-reached",
          when: (ctx) => ctx.value > 100,
          emit: () => ({ result: "big" }),
          explain: () => "Never reached",
        },
      ],
    });

    const deadRules = detectDeadRules(decisionWithDeadCode);
    expect(deadRules).toContain("never-reached");
  });

  it("should not flag rules before catch-all", () => {
    const deadRules = detectDeadRules(riskDecision);
    expect(deadRules).not.toContain("blocked-country");
    expect(deadRules).not.toContain("high-amount");
  });
});
