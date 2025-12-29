import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  defineDecision,
  createRule,
  engine,
  createProfileRegistry,
} from "./index.js";

// Test decision: Currency Exposure Risk
const currencyRiskDecision = defineDecision({
  id: "currency-exposure-risk",
  version: "1.0.0",
  inputSchema: z.object({
    holding_days: z.number().int().positive(),
    monthly_inflation_rate: z.number().nonnegative(),
    currency_volatility: z.number().nonnegative().optional(),
  }),
  outputSchema: z.object({
    risk_level: z.enum(["LOW", "MEDIUM", "HIGH"]),
    reason: z.string(),
  }),
  profileSchema: z.object({
    high_risk_inflation_threshold: z.number(),
    high_risk_horizon_days: z.number(),
    medium_risk_inflation_threshold: z.number(),
    medium_risk_horizon_days: z.number(),
  }),
  rules: [
    createRule({
      id: "high-risk",
      when: (ctx, profile) =>
        ctx.holding_days >= profile.high_risk_horizon_days &&
        ctx.monthly_inflation_rate >= profile.high_risk_inflation_threshold,
      emit: () => ({
        risk_level: "HIGH" as const,
        reason: "Long exposure under high inflation thresholds",
      }),
      explain: () => "Long exposure under high inflation thresholds",
    }),
    createRule({
      id: "medium-risk",
      when: (ctx, profile) =>
        ctx.holding_days >= profile.medium_risk_horizon_days &&
        ctx.monthly_inflation_rate >= profile.medium_risk_inflation_threshold,
      emit: () => ({
        risk_level: "MEDIUM" as const,
        reason: "Medium exposure under moderate inflation thresholds",
      }),
      explain: () => "Medium exposure under moderate inflation thresholds",
    }),
    createRule({
      id: "low-risk-default",
      when: () => true,
      emit: () => ({
        risk_level: "LOW" as const,
        reason: "Default: does not meet higher risk thresholds",
      }),
      explain: () => "Default: does not meet higher risk thresholds",
    }),
  ],
});

// Test profiles
const highInflationProfile = {
  high_risk_inflation_threshold: 0.05,
  high_risk_horizon_days: 60,
  medium_risk_inflation_threshold: 0.03,
  medium_risk_horizon_days: 30,
};

const stableEconomyProfile = {
  high_risk_inflation_threshold: 0.02,
  high_risk_horizon_days: 120,
  medium_risk_inflation_threshold: 0.01,
  medium_risk_horizon_days: 60,
};

describe("Engine", () => {
  describe("run()", () => {
    it("should return OK with matched rule for HIGH risk", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: highInflationProfile }
      );

      expect(result.status).toBe("OK");
      expect(result.data?.risk_level).toBe("HIGH");
      expect(result.meta.matchedRule).toBe("high-risk");
    });

    it("should return OK with matched rule for MEDIUM risk", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 45, monthly_inflation_rate: 0.04 },
        { profile: highInflationProfile }
      );

      expect(result.status).toBe("OK");
      expect(result.data?.risk_level).toBe("MEDIUM");
      expect(result.meta.matchedRule).toBe("medium-risk");
    });

    it("should return OK with catch-all rule for LOW risk", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 15, monthly_inflation_rate: 0.01 },
        { profile: highInflationProfile }
      );

      expect(result.status).toBe("OK");
      expect(result.data?.risk_level).toBe("LOW");
      expect(result.meta.matchedRule).toBe("low-risk-default");
    });

    it("should evaluate same context differently with different profiles", () => {
      // Context: 150 days holding, 2.5% monthly inflation
      const context = { holding_days: 150, monthly_inflation_rate: 0.025 };

      // High inflation profile: needs 5% for HIGH, 3% for MEDIUM
      // 0.025 < 0.03, so falls through to LOW
      const highInflationResult = engine.run(
        currencyRiskDecision,
        context,
        { profile: highInflationProfile }
      );

      // Stable economy profile: needs 2% for HIGH, 1% for MEDIUM
      // 150 >= 120 AND 0.025 >= 0.02 → HIGH
      const stableResult = engine.run(
        currencyRiskDecision,
        context,
        { profile: stableEconomyProfile }
      );

      // Same context, different profiles = different results
      expect(highInflationResult.data?.risk_level).toBe("LOW");
      expect(stableResult.data?.risk_level).toBe("HIGH");
    });

    it("should include evaluation trace in meta", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: highInflationProfile }
      );

      expect(result.meta.evaluatedRules).toHaveLength(1);
      expect(result.meta.evaluatedRules[0].ruleId).toBe("high-risk");
      expect(result.meta.evaluatedRules[0].matched).toBe(true);
    });

    it("should include all evaluated rules in trace when falling through", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 10, monthly_inflation_rate: 0.01 },
        { profile: highInflationProfile }
      );

      expect(result.meta.evaluatedRules).toHaveLength(3);
      expect(result.meta.evaluatedRules[0]).toEqual({
        ruleId: "high-risk",
        matched: false,
        explanation: undefined,
      });
      expect(result.meta.evaluatedRules[1]).toEqual({
        ruleId: "medium-risk",
        matched: false,
        explanation: undefined,
      });
      expect(result.meta.evaluatedRules[2].ruleId).toBe("low-risk-default");
      expect(result.meta.evaluatedRules[2].matched).toBe(true);
    });
  });

  describe("input validation", () => {
    it("should return INVALID_INPUT for invalid input", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: -5, monthly_inflation_rate: 0.05 } as any,
        { profile: highInflationProfile }
      );

      expect(result.status).toBe("INVALID_INPUT");
      expect(result.data).toBeNull();
      expect(result.meta.explanation).toContain("Input validation failed");
    });

    it("should return INVALID_INPUT for missing required fields", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 30 } as any,
        { profile: highInflationProfile }
      );

      expect(result.status).toBe("INVALID_INPUT");
    });
  });

  describe("profile validation", () => {
    it("should return INVALID_INPUT for invalid profile", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 30, monthly_inflation_rate: 0.05 },
        { profile: { high_risk_inflation_threshold: 0.05 } as any }
      );

      expect(result.status).toBe("INVALID_INPUT");
      expect(result.meta.explanation).toContain("Profile validation failed");
    });
  });

  describe("profile registry", () => {
    it("should resolve profile from registry", () => {
      const registry = createProfileRegistry<typeof highInflationProfile>();
      registry.register("high-inflation", highInflationProfile);

      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: "high-inflation" },
        registry
      );

      expect(result.status).toBe("OK");
      expect(result.data?.risk_level).toBe("HIGH");
      expect(result.meta.profileId).toBe("high-inflation");
    });

    it("should return INVALID_INPUT when profile not found", () => {
      const registry = createProfileRegistry<typeof highInflationProfile>();

      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: "unknown-profile" },
        registry
      );

      expect(result.status).toBe("INVALID_INPUT");
      expect(result.meta.explanation).toContain("Profile not found");
    });

    it("should return INVALID_INPUT when registry not provided for string profile", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: "high-inflation" }
      );

      expect(result.status).toBe("INVALID_INPUT");
      expect(result.meta.explanation).toContain("no registry supplied");
    });
  });

  describe("determinism", () => {
    it("should produce identical results for identical inputs", () => {
      const context = { holding_days: 45, monthly_inflation_rate: 0.04 };

      const result1 = engine.run(
        currencyRiskDecision,
        context,
        { profile: highInflationProfile }
      );

      const result2 = engine.run(
        currencyRiskDecision,
        context,
        { profile: highInflationProfile }
      );

      expect(result1.status).toBe(result2.status);
      expect(result1.data).toEqual(result2.data);
      expect(result1.meta.matchedRule).toBe(result2.meta.matchedRule);
    });
  });

  describe("explain()", () => {
    it("should format explanation for OK result", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: 90, monthly_inflation_rate: 0.06 },
        { profile: highInflationProfile }
      );

      const explanation = engine.explain(result);

      expect(explanation).toContain("currency-exposure-risk");
      expect(explanation).toContain("OK");
      expect(explanation).toContain("high-risk");
    });

    it("should format explanation for error result", () => {
      const result = engine.run(
        currencyRiskDecision,
        { holding_days: -5, monthly_inflation_rate: 0.05 } as any,
        { profile: highInflationProfile }
      );

      const explanation = engine.explain(result);

      expect(explanation).toContain("INVALID_INPUT");
      expect(explanation).toContain("Error:");
    });
  });
});

describe("NO_MATCH and INVALID_OUTPUT", () => {
  // Decision without catch-all rule
  const strictDecision = defineDecision({
    id: "strict-decision",
    version: "1.0.0",
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ result: z.string() }),
    profileSchema: z.object({}),
    rules: [
      createRule({
        id: "only-positive",
        when: (ctx) => ctx.value > 0,
        emit: () => ({ result: "positive" }),
        explain: () => "Value is positive",
      }),
    ],
  });

  it("should return NO_MATCH when no rule matches", () => {
    const result = engine.run(
      strictDecision,
      { value: -5 },
      { profile: {} }
    );

    expect(result.status).toBe("NO_MATCH");
    expect(result.data).toBeNull();
    expect(result.meta.explanation).toContain("No rule matched");
  });

  // Decision with invalid output
  const badOutputDecision = defineDecision({
    id: "bad-output-decision",
    version: "1.0.0",
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ result: z.string().min(10) }), // Requires min 10 chars
    profileSchema: z.object({}),
    rules: [
      createRule({
        id: "short-output",
        when: () => true,
        emit: () => ({ result: "short" }), // Only 5 chars, will fail validation
        explain: () => "Always matches",
      }),
    ],
  });

  it("should return INVALID_OUTPUT when rule emits invalid data", () => {
    const result = engine.run(
      badOutputDecision,
      { value: 1 },
      { profile: {} }
    );

    expect(result.status).toBe("INVALID_OUTPUT");
    expect(result.data).toBeNull();
    expect(result.meta.explanation).toContain("Output validation failed");
  });
});

describe("explain() with profile ID", () => {
  const simpleDecision = defineDecision({
    id: "simple-decision",
    version: "1.0.0",
    inputSchema: z.object({ value: z.number() }),
    outputSchema: z.object({ result: z.string() }),
    profileSchema: z.object({ threshold: z.number() }),
    rules: [
      createRule({
        id: "above-threshold",
        when: (ctx, profile) => ctx.value > profile.threshold,
        emit: () => ({ result: "above" }),
        explain: () => "Value above threshold",
      }),
      createRule({
        id: "default",
        when: () => true,
        emit: () => ({ result: "below" }),
        explain: () => "Default",
      }),
    ],
  });

  it("should include profile ID in explanation when using registry", () => {
    const registry = createProfileRegistry<{ threshold: number }>();
    registry.register("my-profile", { threshold: 10 });

    const result = engine.run(
      simpleDecision,
      { value: 5 },
      { profile: "my-profile" },
      registry
    );

    const explanation = engine.explain(result);

    expect(explanation).toContain("Profile: my-profile");
  });
});

describe("Rule execution errors", () => {
  it("should return INVALID_INPUT when rule.when() throws", () => {
    const throwingDecision = defineDecision({
      id: "throwing-when",
      version: "1.0.0",
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      profileSchema: z.object({}),
      rules: [
        createRule({
          id: "throws-in-when",
          when: () => {
            throw new Error("when() exploded");
          },
          emit: () => ({ result: "never" }),
          explain: () => "never",
        }),
      ],
    });

    const result = engine.run(
      throwingDecision,
      { value: 1 },
      { profile: {} }
    );

    expect(result.status).toBe("INVALID_INPUT");
    expect(result.meta.explanation).toContain("Rule evaluation error");
    expect(result.meta.explanation).toContain("throws-in-when");
  });

  it("should return INVALID_OUTPUT when rule.emit() throws", () => {
    const throwingDecision = defineDecision({
      id: "throwing-emit",
      version: "1.0.0",
      inputSchema: z.object({ value: z.number() }),
      outputSchema: z.object({ result: z.string() }),
      profileSchema: z.object({}),
      rules: [
        createRule({
          id: "throws-in-emit",
          when: () => true,
          emit: () => {
            throw new Error("emit() exploded");
          },
          explain: () => "matched",
        }),
      ],
    });

    const result = engine.run(
      throwingDecision,
      { value: 1 },
      { profile: {} }
    );

    expect(result.status).toBe("INVALID_OUTPUT");
    expect(result.meta.explanation).toContain("Rule emit error");
    expect(result.meta.explanation).toContain("throws-in-emit");
  });
});

describe("ProfileRegistry.has()", () => {
  it("should return true when profile exists", () => {
    const registry = createProfileRegistry<{ value: number }>();
    registry.register("test", { value: 1 });

    expect(registry.has("test")).toBe(true);
  });

  it("should return false when profile does not exist", () => {
    const registry = createProfileRegistry<{ value: number }>();

    expect(registry.has("nonexistent")).toBe(false);
  });
});

describe("User Tier Eligibility Decision", () => {
  const tierDecision = defineDecision({
    id: "user-tier-eligibility",
    version: "1.0.0",
    inputSchema: z.object({
      account_age_days: z.number().int().nonnegative(),
      monthly_transactions: z.number().int().nonnegative(),
      verified_identity: z.boolean(),
    }),
    outputSchema: z.object({
      tier: z.enum(["BASIC", "STANDARD", "PREMIUM"]),
      reason: z.string(),
    }),
    profileSchema: z.object({}), // No profile needed
    rules: [
      createRule({
        id: "premium",
        when: (ctx) =>
          ctx.verified_identity &&
          ctx.account_age_days >= 90 &&
          ctx.monthly_transactions >= 50,
        emit: () => ({
          tier: "PREMIUM" as const,
          reason: "Verified user with high tenure and high activity",
        }),
        explain: () => "Verified user with high tenure and high activity",
      }),
      createRule({
        id: "standard",
        when: (ctx) =>
          ctx.verified_identity &&
          ctx.account_age_days >= 30 &&
          ctx.monthly_transactions >= 10,
        emit: () => ({
          tier: "STANDARD" as const,
          reason: "Verified user meeting standard thresholds",
        }),
        explain: () => "Verified user meeting standard thresholds",
      }),
      createRule({
        id: "basic-default",
        when: () => true,
        emit: () => ({
          tier: "BASIC" as const,
          reason: "Default access tier",
        }),
        explain: () => "Default access tier",
      }),
    ],
  });

  it("should classify premium user correctly", () => {
    const result = engine.run(
      tierDecision,
      {
        account_age_days: 120,
        monthly_transactions: 75,
        verified_identity: true,
      },
      { profile: {} }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.tier).toBe("PREMIUM");
  });

  it("should classify standard user correctly", () => {
    const result = engine.run(
      tierDecision,
      {
        account_age_days: 45,
        monthly_transactions: 20,
        verified_identity: true,
      },
      { profile: {} }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.tier).toBe("STANDARD");
  });

  it("should classify unverified user as basic", () => {
    const result = engine.run(
      tierDecision,
      {
        account_age_days: 120,
        monthly_transactions: 75,
        verified_identity: false,
      },
      { profile: {} }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.tier).toBe("BASIC");
  });
});
