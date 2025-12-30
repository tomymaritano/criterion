/**
 * Pattern: Composite
 * Decision: Transaction Risk Assessment
 *
 * Evaluate multiple weighted factors to produce a score and classification.
 *
 * Run with: npx tsx examples/patterns/composite/transaction-risk.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const inputSchema = z.object({
  amount: z.number().positive(),
  accountAgeDays: z.number().int().nonnegative(),
  ipCountry: z.string().length(2),
  billingCountry: z.string().length(2),
  isNewPaymentMethod: z.boolean(),
  hourOfDay: z.number().int().min(0).max(23),
  previousTransactions: z.number().int().nonnegative(),
});

const profileSchema = z.object({
  weights: z.object({
    highAmount: z.number(),
    newAccount: z.number(),
    countryMismatch: z.number(),
    newPaymentMethod: z.number(),
    unusualHour: z.number(),
    noHistory: z.number(),
  }),
  thresholds: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
  }),
  highAmountThreshold: z.number(),
  newAccountDays: z.number(),
});

const outputSchema = z.object({
  score: z.number(),
  level: z.enum(["low", "medium", "high", "critical"]),
  flags: z.array(z.string()),
  action: z.enum(["allow", "review", "challenge", "block"]),
  reason: z.string(),
});

// ============================================================================
// PURE SCORING FUNCTION
// ============================================================================

type Input = z.infer<typeof inputSchema>;
type Profile = z.infer<typeof profileSchema>;

function computeRiskScore(
  ctx: Input,
  profile: Profile
): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  // High amount
  if (ctx.amount > profile.highAmountThreshold) {
    score += profile.weights.highAmount;
    flags.push("high-amount");
  }

  // New account
  if (ctx.accountAgeDays < profile.newAccountDays) {
    score += profile.weights.newAccount;
    flags.push("new-account");
  }

  // Country mismatch
  if (ctx.ipCountry !== ctx.billingCountry) {
    score += profile.weights.countryMismatch;
    flags.push("country-mismatch");
  }

  // New payment method
  if (ctx.isNewPaymentMethod) {
    score += profile.weights.newPaymentMethod;
    flags.push("new-payment-method");
  }

  // Unusual hour (before 6am or after 10pm)
  if (ctx.hourOfDay < 6 || ctx.hourOfDay > 22) {
    score += profile.weights.unusualHour;
    flags.push("unusual-hour");
  }

  // No transaction history
  if (ctx.previousTransactions === 0) {
    score += profile.weights.noHistory;
    flags.push("no-history");
  }

  return { score: Math.min(100, score), flags };
}

// ============================================================================
// DECISION
// ============================================================================

export const transactionRisk = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    {
      id: "critical-risk",
      when: (ctx, profile) =>
        computeRiskScore(ctx, profile).score >= profile.thresholds.critical,
      emit: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return {
          score,
          flags,
          level: "critical",
          action: "block",
          reason: "Transaction blocked due to critical risk level",
        };
      },
      explain: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return `Risk score ${score} >= critical threshold ${profile.thresholds.critical}. Flags: ${flags.join(", ")}`;
      },
    },
    {
      id: "high-risk",
      when: (ctx, profile) =>
        computeRiskScore(ctx, profile).score >= profile.thresholds.high,
      emit: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return {
          score,
          flags,
          level: "high",
          action: "review",
          reason: "Transaction flagged for manual review",
        };
      },
      explain: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return `Risk score ${score} >= high threshold ${profile.thresholds.high}. Flags: ${flags.join(", ")}`;
      },
    },
    {
      id: "medium-risk",
      when: (ctx, profile) =>
        computeRiskScore(ctx, profile).score >= profile.thresholds.medium,
      emit: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return {
          score,
          flags,
          level: "medium",
          action: "challenge",
          reason: "Additional verification required",
        };
      },
      explain: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return `Risk score ${score} >= medium threshold ${profile.thresholds.medium}. Flags: ${flags.join(", ")}`;
      },
    },
    {
      id: "low-risk",
      when: () => true,
      emit: (ctx, profile) => {
        const { score, flags } = computeRiskScore(ctx, profile);
        return {
          score,
          flags,
          level: "low",
          action: "allow",
          reason: "Transaction approved",
        };
      },
      explain: (ctx, profile) => {
        const { score } = computeRiskScore(ctx, profile);
        return `Risk score ${score} below medium threshold ${profile.thresholds.medium}. Transaction allowed.`;
      },
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = {
    weights: {
      highAmount: 25,
      newAccount: 20,
      countryMismatch: 30,
      newPaymentMethod: 15,
      unusualHour: 10,
      noHistory: 15,
    },
    thresholds: {
      critical: 80,
      high: 50,
      medium: 25,
    },
    highAmountThreshold: 1000,
    newAccountDays: 30,
  };

  const testCases = [
    // Low risk: established user, normal transaction
    {
      amount: 50,
      accountAgeDays: 365,
      ipCountry: "US",
      billingCountry: "US",
      isNewPaymentMethod: false,
      hourOfDay: 14,
      previousTransactions: 50,
    },
    // Medium risk: new payment method + high amount
    {
      amount: 1500,
      accountAgeDays: 90,
      ipCountry: "US",
      billingCountry: "US",
      isNewPaymentMethod: true,
      hourOfDay: 10,
      previousTransactions: 10,
    },
    // High risk: country mismatch + new account + high amount
    {
      amount: 2000,
      accountAgeDays: 5,
      ipCountry: "NG",
      billingCountry: "US",
      isNewPaymentMethod: true,
      hourOfDay: 15,
      previousTransactions: 1,
    },
    // Critical risk: all flags
    {
      amount: 5000,
      accountAgeDays: 2,
      ipCountry: "RU",
      billingCountry: "US",
      isNewPaymentMethod: true,
      hourOfDay: 3,
      previousTransactions: 0,
    },
  ];

  console.log("Pattern: Composite");
  console.log("Decision: transaction-risk\n");
  console.log("Thresholds: critical=80, high=50, medium=25\n");

  for (const input of testCases) {
    const result = engine.run(transactionRisk, input, { profile });
    console.log(`Amount: $${input.amount} | Account: ${input.accountAgeDays}d | IP: ${input.ipCountry} | Billing: ${input.billingCountry}`);
    console.log(`  Score: ${result.data?.score}`);
    console.log(`  Level: ${result.data?.level}`);
    console.log(`  Action: ${result.data?.action}`);
    console.log(`  Flags: ${result.data?.flags.join(", ") || "none"}`);
    console.log(`  Rule: ${result.meta.matchedRule}\n`);
  }
}
