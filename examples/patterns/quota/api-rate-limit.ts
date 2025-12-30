/**
 * Pattern: Quota
 * Decision: API Rate Limit
 *
 * Track usage against a limit and return remaining capacity.
 *
 * Run with: npx tsx examples/patterns/quota/api-rate-limit.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const inputSchema = z.object({
  callsInWindow: z.number().int().nonnegative(),
  windowStartTime: z.string(), // ISO timestamp
  currentTime: z.string(),     // ISO timestamp
  userTier: z.enum(["free", "paid", "enterprise"]),
});

const profileSchema = z.object({
  windowSeconds: z.number().int().positive(),
  limits: z.object({
    free: z.number().int(),
    paid: z.number().int(),
    enterprise: z.number().int(),
  }),
});

const outputSchema = z.object({
  allowed: z.boolean(),
  remaining: z.number(),
  retryAfter: z.number().nullable(),
  reason: z.string(),
});

// ============================================================================
// HELPERS (pure functions)
// ============================================================================

function calculateRetryAfter(
  windowStartTime: string,
  currentTime: string,
  windowSeconds: number
): number {
  const windowStart = new Date(windowStartTime).getTime();
  const now = new Date(currentTime).getTime();
  const elapsed = (now - windowStart) / 1000;
  return Math.max(0, Math.ceil(windowSeconds - elapsed));
}

// ============================================================================
// DECISION
// ============================================================================

export const apiRateLimit = defineDecision({
  id: "api-rate-limit",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    {
      id: "within-limit",
      when: (ctx, profile) => ctx.callsInWindow < profile.limits[ctx.userTier],
      emit: (ctx, profile) => ({
        allowed: true,
        remaining: profile.limits[ctx.userTier] - ctx.callsInWindow - 1,
        retryAfter: null,
        reason: `Request allowed (${ctx.callsInWindow + 1}/${profile.limits[ctx.userTier]} in window)`,
      }),
      explain: (ctx, profile) =>
        `${ctx.callsInWindow + 1}/${profile.limits[ctx.userTier]} calls used for ${ctx.userTier} tier`,
    },
    {
      id: "limit-exceeded",
      when: () => true,
      emit: (ctx, profile) => {
        const retryAfter = calculateRetryAfter(
          ctx.windowStartTime,
          ctx.currentTime,
          profile.windowSeconds
        );
        return {
          allowed: false,
          remaining: 0,
          retryAfter,
          reason: `Rate limit exceeded. Retry after ${retryAfter} seconds`,
        };
      },
      explain: (ctx, profile) =>
        `Rate limit ${profile.limits[ctx.userTier]} exceeded for ${ctx.userTier} tier. ` +
        `${ctx.callsInWindow} calls in current window`,
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = {
    windowSeconds: 60,
    limits: {
      free: 10,
      paid: 100,
      enterprise: 1000,
    },
  };

  const now = new Date();
  const windowStart = new Date(now.getTime() - 30000); // 30 seconds ago

  const testCases = [
    { callsInWindow: 5, userTier: "free" as const },
    { callsInWindow: 10, userTier: "free" as const },
    { callsInWindow: 50, userTier: "paid" as const },
    { callsInWindow: 100, userTier: "paid" as const },
    { callsInWindow: 999, userTier: "enterprise" as const },
  ];

  console.log("Pattern: Quota");
  console.log("Decision: api-rate-limit\n");
  console.log(`Profile: window=${profile.windowSeconds}s, free=${profile.limits.free}, paid=${profile.limits.paid}, enterprise=${profile.limits.enterprise}\n`);

  for (const input of testCases) {
    const fullInput = {
      ...input,
      windowStartTime: windowStart.toISOString(),
      currentTime: now.toISOString(),
    };
    const result = engine.run(apiRateLimit, fullInput, { profile });
    console.log(`Tier: ${input.userTier} | Calls: ${input.callsInWindow}`);
    console.log(`  Allowed: ${result.data?.allowed}`);
    console.log(`  Remaining: ${result.data?.remaining}`);
    console.log(`  Retry After: ${result.data?.retryAfter ?? "N/A"}`);
    console.log(`  Rule: ${result.meta.matchedRule}\n`);
  }
}
