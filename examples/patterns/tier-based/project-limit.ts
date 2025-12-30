/**
 * Pattern: Tier-Based
 * Decision: Project Limit
 *
 * Map user tier/plan to specific limits and permissions.
 *
 * Run with: npx tsx examples/patterns/tier-based/project-limit.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const inputSchema = z.object({
  userPlan: z.enum(["free", "starter", "pro", "enterprise"]),
  currentProjectCount: z.number().int().nonnegative(),
});

const profileSchema = z.object({
  limits: z.object({
    free: z.number().int(),
    starter: z.number().int(),
    pro: z.number().int(),
    enterprise: z.number().int(), // -1 = unlimited
  }),
});

const outputSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  maxAllowed: z.number(),
  remaining: z.number(),
});

// ============================================================================
// DECISION
// ============================================================================

export const projectLimit = defineDecision({
  id: "project-limit",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    {
      id: "enterprise-unlimited",
      when: (ctx, profile) =>
        ctx.userPlan === "enterprise" && profile.limits.enterprise === -1,
      emit: () => ({
        allowed: true,
        reason: "Enterprise plan has unlimited projects",
        maxAllowed: -1,
        remaining: -1,
      }),
      explain: (ctx) =>
        `User on enterprise plan with ${ctx.currentProjectCount} projects (unlimited)`,
    },
    {
      id: "within-limit",
      when: (ctx, profile) =>
        ctx.currentProjectCount < profile.limits[ctx.userPlan],
      emit: (ctx, profile) => ({
        allowed: true,
        reason: `Can create project (${ctx.currentProjectCount + 1}/${profile.limits[ctx.userPlan]})`,
        maxAllowed: profile.limits[ctx.userPlan],
        remaining: profile.limits[ctx.userPlan] - ctx.currentProjectCount - 1,
      }),
      explain: (ctx, profile) =>
        `${ctx.currentProjectCount}/${profile.limits[ctx.userPlan]} projects used on ${ctx.userPlan} plan`,
    },
    {
      id: "at-limit",
      when: () => true,
      emit: (ctx, profile) => ({
        allowed: false,
        reason: `Reached ${profile.limits[ctx.userPlan]} project limit on ${ctx.userPlan} plan`,
        maxAllowed: profile.limits[ctx.userPlan],
        remaining: 0,
      }),
      explain: (ctx, profile) =>
        `${ctx.currentProjectCount}/${profile.limits[ctx.userPlan]} projects - limit reached on ${ctx.userPlan} plan`,
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = {
    limits: {
      free: 3,
      starter: 10,
      pro: 50,
      enterprise: -1,
    },
  };

  const testCases = [
    { userPlan: "free" as const, currentProjectCount: 1 },
    { userPlan: "free" as const, currentProjectCount: 3 },
    { userPlan: "starter" as const, currentProjectCount: 5 },
    { userPlan: "pro" as const, currentProjectCount: 49 },
    { userPlan: "enterprise" as const, currentProjectCount: 500 },
  ];

  console.log("Pattern: Tier-Based");
  console.log("Decision: project-limit\n");
  console.log(`Profile: free=${profile.limits.free}, starter=${profile.limits.starter}, pro=${profile.limits.pro}, enterprise=unlimited\n`);

  for (const input of testCases) {
    const result = engine.run(projectLimit, input, { profile });
    console.log(`Plan: ${input.userPlan} | Projects: ${input.currentProjectCount}`);
    console.log(`  Allowed: ${result.data?.allowed}`);
    console.log(`  Remaining: ${result.data?.remaining === -1 ? "unlimited" : result.data?.remaining}`);
    console.log(`  Rule: ${result.meta.matchedRule}`);
    console.log(`  Reason: ${result.data?.reason}\n`);
  }
}
