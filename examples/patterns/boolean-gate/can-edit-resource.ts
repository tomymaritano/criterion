/**
 * Pattern: Boolean Gate
 * Decision: Can Edit Resource
 *
 * Evaluate conditions to produce a yes/no decision.
 *
 * Run with: npx tsx examples/patterns/boolean-gate/can-edit-resource.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const inputSchema = z.object({
  userId: z.string(),
  resourceId: z.string(),
  userRole: z.enum(["admin", "editor", "viewer"]),
  isOwner: z.boolean(),
  resourceLocked: z.boolean(),
});

const profileSchema = z.object({
  allowEditLocked: z.boolean(),
});

const outputSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
});

// ============================================================================
// DECISION
// ============================================================================

export const canEditResource = defineDecision({
  id: "can-edit-resource",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    // Blockers first
    {
      id: "locked-blocked",
      when: (ctx, profile) => ctx.resourceLocked && !profile.allowEditLocked,
      emit: () => ({
        allowed: false,
        reason: "Resource is locked and editing locked resources is disabled",
      }),
      explain: () =>
        "Resource is locked and profile does not allow editing locked resources",
    },
    // Special cases
    {
      id: "owner-allowed",
      when: (ctx) => ctx.isOwner,
      emit: () => ({
        allowed: true,
        reason: "Resource owner can always edit",
      }),
      explain: (ctx) => `User ${ctx.userId} is the resource owner`,
    },
    {
      id: "admin-allowed",
      when: (ctx) => ctx.userRole === "admin",
      emit: () => ({
        allowed: true,
        reason: "Admins can edit all resources",
      }),
      explain: (ctx) => `User ${ctx.userId} has admin role`,
    },
    {
      id: "editor-allowed",
      when: (ctx) => ctx.userRole === "editor",
      emit: () => ({
        allowed: true,
        reason: "Editors can edit resources",
      }),
      explain: (ctx) => `User ${ctx.userId} has editor role`,
    },
    // Default deny
    {
      id: "viewer-denied",
      when: () => true,
      emit: (ctx) => ({
        allowed: false,
        reason: `Role '${ctx.userRole}' cannot edit resources`,
      }),
      explain: (ctx) =>
        `User ${ctx.userId} with role ${ctx.userRole} does not have edit permissions`,
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = { allowEditLocked: false };

  const testCases = [
    { userId: "u1", resourceId: "r1", userRole: "viewer" as const, isOwner: false, resourceLocked: false },
    { userId: "u2", resourceId: "r1", userRole: "editor" as const, isOwner: false, resourceLocked: false },
    { userId: "u3", resourceId: "r1", userRole: "admin" as const, isOwner: false, resourceLocked: false },
    { userId: "u4", resourceId: "r1", userRole: "viewer" as const, isOwner: true, resourceLocked: false },
    { userId: "u5", resourceId: "r1", userRole: "admin" as const, isOwner: false, resourceLocked: true },
  ];

  console.log("Pattern: Boolean Gate");
  console.log("Decision: can-edit-resource\n");
  console.log(`Profile: allowEditLocked=${profile.allowEditLocked}\n`);

  for (const input of testCases) {
    const result = engine.run(canEditResource, input, { profile });
    console.log(`User: ${input.userId} | Role: ${input.userRole} | Owner: ${input.isOwner} | Locked: ${input.resourceLocked}`);
    console.log(`  Allowed: ${result.data?.allowed}`);
    console.log(`  Rule: ${result.meta.matchedRule}`);
    console.log(`  Reason: ${result.data?.reason}\n`);
  }
}
