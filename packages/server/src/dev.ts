/**
 * Development server example
 *
 * Run with: pnpm dev (from packages/server)
 */

import { defineDecision } from "@criterionx/core";
import { z } from "zod";
import { createServer } from "./server.js";

// Example decision: Transaction Risk
const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  meta: {
    description: "Evaluate transaction risk based on amount and customer tier",
  },
  inputSchema: z.object({
    amount: z.number().positive(),
    customerId: z.string(),
    tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  }),
  outputSchema: z.object({
    risk: z.enum(["LOW", "MEDIUM", "HIGH"]),
    action: z.enum(["APPROVE", "REVIEW", "BLOCK"]),
    reason: z.string(),
  }),
  profileSchema: z.object({
    highAmountThreshold: z.number(),
    tierRiskMapping: z.record(z.enum(["LOW", "MEDIUM", "HIGH"])),
  }),
  rules: [
    {
      id: "high-amount",
      when: (input, profile) => input.amount > profile.highAmountThreshold,
      emit: () => ({
        risk: "HIGH",
        action: "REVIEW",
        reason: "Transaction amount exceeds threshold",
      }),
      explain: (input, profile) =>
        `Amount $${input.amount} exceeds threshold $${profile.highAmountThreshold}`,
    },
    {
      id: "tier-based",
      when: () => true,
      emit: (input, profile) => {
        const risk = profile.tierRiskMapping[input.tier] || "LOW";
        return {
          risk,
          action: risk === "LOW" ? "APPROVE" : "REVIEW",
          reason: `${input.tier} tier customer`,
        };
      },
      explain: (input) => `Applied ${input.tier} tier rules`,
    },
  ],
});

// Example decision: Pricing
const pricingDecision = defineDecision({
  id: "dynamic-pricing",
  version: "1.0.0",
  meta: {
    description: "Calculate dynamic pricing based on customer tier and quantity",
  },
  inputSchema: z.object({
    basePrice: z.number().positive(),
    quantity: z.number().int().positive(),
    tier: z.enum(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  }),
  outputSchema: z.object({
    originalPrice: z.number(),
    discount: z.number(),
    finalPrice: z.number(),
  }),
  profileSchema: z.object({
    tierDiscounts: z.record(z.number()),
    bulkThreshold: z.number(),
    bulkDiscount: z.number(),
  }),
  rules: [
    {
      id: "bulk-discount",
      when: (input, profile) => input.quantity >= profile.bulkThreshold,
      emit: (input, profile) => {
        const tierDiscount = profile.tierDiscounts[input.tier] || 0;
        const totalDiscount = Math.min(tierDiscount + profile.bulkDiscount, 50);
        const originalPrice = input.basePrice * input.quantity;
        return {
          originalPrice,
          discount: totalDiscount,
          finalPrice: originalPrice * (1 - totalDiscount / 100),
        };
      },
      explain: (input, profile) =>
        `Bulk order (${input.quantity} >= ${profile.bulkThreshold})`,
    },
    {
      id: "tier-discount",
      when: () => true,
      emit: (input, profile) => {
        const discount = profile.tierDiscounts[input.tier] || 0;
        const originalPrice = input.basePrice * input.quantity;
        return {
          originalPrice,
          discount,
          finalPrice: originalPrice * (1 - discount / 100),
        };
      },
      explain: (input) => `${input.tier} tier discount applied`,
    },
  ],
});

// Create and start server
const server = createServer({
  decisions: [riskDecision, pricingDecision],
  profiles: {
    "transaction-risk": {
      highAmountThreshold: 10000,
      tierRiskMapping: {
        BRONZE: "MEDIUM",
        SILVER: "LOW",
        GOLD: "LOW",
        PLATINUM: "LOW",
      },
    },
    "dynamic-pricing": {
      tierDiscounts: {
        BRONZE: 0,
        SILVER: 5,
        GOLD: 10,
        PLATINUM: 15,
      },
      bulkThreshold: 10,
      bulkDiscount: 10,
    },
  },
});

server.listen(3000);
