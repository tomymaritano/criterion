/**
 * Pattern: Threshold
 * Decision: Transaction Limit
 *
 * Compare a numeric value against boundaries to classify or permit.
 *
 * Run with: npx tsx examples/patterns/threshold/transaction-limit.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const inputSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
});

const profileSchema = z.object({
  maxAmount: z.number().positive(),
  warningThreshold: z.number().positive(),
});

const outputSchema = z.object({
  allowed: z.boolean(),
  warning: z.boolean(),
  reason: z.string(),
});

// ============================================================================
// DECISION
// ============================================================================

export const transactionLimit = defineDecision({
  id: "transaction-limit",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    {
      id: "exceeds-max",
      when: (ctx, profile) => ctx.amount > profile.maxAmount,
      emit: () => ({
        allowed: false,
        warning: false,
        reason: "Transaction exceeds maximum limit",
      }),
      explain: (ctx, profile) =>
        `Amount ${ctx.currency} ${ctx.amount} exceeds maximum ${ctx.currency} ${profile.maxAmount}`,
    },
    {
      id: "above-warning",
      when: (ctx, profile) => ctx.amount > profile.warningThreshold,
      emit: () => ({
        allowed: true,
        warning: true,
        reason: "Transaction allowed but flagged for review",
      }),
      explain: (ctx, profile) =>
        `Amount ${ctx.currency} ${ctx.amount} above warning threshold ${ctx.currency} ${profile.warningThreshold}`,
    },
    {
      id: "normal",
      when: () => true,
      emit: () => ({
        allowed: true,
        warning: false,
        reason: "Transaction within normal limits",
      }),
      explain: (ctx, profile) =>
        `Amount ${ctx.currency} ${ctx.amount} within limits (max: ${ctx.currency} ${profile.maxAmount})`,
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = {
    maxAmount: 10000,
    warningThreshold: 5000,
  };

  const testCases = [
    { amount: 100, currency: "USD" },    // Normal
    { amount: 7500, currency: "USD" },   // Warning
    { amount: 15000, currency: "USD" },  // Blocked
  ];

  console.log("Pattern: Threshold");
  console.log("Decision: transaction-limit\n");
  console.log(`Profile: max=${profile.maxAmount}, warning=${profile.warningThreshold}\n`);

  for (const input of testCases) {
    const result = engine.run(transactionLimit, input, { profile });
    console.log(`Amount: ${input.currency} ${input.amount}`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Allowed: ${result.data?.allowed}`);
    console.log(`  Warning: ${result.data?.warning}`);
    console.log(`  Rule: ${result.meta.matchedRule}`);
    console.log(`  Explanation: ${result.meta.explanation}\n`);
  }
}
