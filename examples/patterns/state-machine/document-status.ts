/**
 * Pattern: State Machine
 * Decision: Document Status Change
 *
 * Validate state transitions based on current state, requested state, and role.
 *
 * Run with: npx tsx examples/patterns/state-machine/document-status.ts
 */

import { z } from "zod";
import { defineDecision, engine } from "../../../packages/core/src/index.js";

// ============================================================================
// SCHEMAS
// ============================================================================

const statusEnum = z.enum(["draft", "review", "approved", "published", "archived"]);

const inputSchema = z.object({
  documentId: z.string(),
  currentStatus: statusEnum,
  requestedStatus: statusEnum,
  userRole: z.enum(["author", "reviewer", "admin"]),
});

const profileSchema = z.object({
  transitions: z.record(z.array(z.string())),
  rolePermissions: z.record(z.array(z.string())),
});

const outputSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
  validNextStates: z.array(z.string()),
});

// ============================================================================
// DECISION
// ============================================================================

export const documentStatus = defineDecision({
  id: "document-status-change",
  version: "1.0.0",
  inputSchema,
  profileSchema,
  outputSchema,
  rules: [
    {
      id: "same-status",
      when: (ctx) => ctx.currentStatus === ctx.requestedStatus,
      emit: (ctx, profile) => ({
        allowed: true,
        reason: `Document already in ${ctx.currentStatus} status`,
        validNextStates: profile.transitions[ctx.currentStatus] || [],
      }),
      explain: (ctx) =>
        `No transition needed - document already in ${ctx.currentStatus} status`,
    },
    {
      id: "invalid-transition",
      when: (ctx, profile) =>
        !profile.transitions[ctx.currentStatus]?.includes(ctx.requestedStatus),
      emit: (ctx, profile) => ({
        allowed: false,
        reason: `Cannot move from ${ctx.currentStatus} to ${ctx.requestedStatus}`,
        validNextStates: profile.transitions[ctx.currentStatus] || [],
      }),
      explain: (ctx, profile) =>
        `Invalid transition: ${ctx.currentStatus} → ${ctx.requestedStatus}. ` +
        `Valid transitions: ${profile.transitions[ctx.currentStatus]?.join(", ") || "none"}`,
    },
    {
      id: "role-not-permitted",
      when: (ctx, profile) => {
        const transitionKey = `${ctx.currentStatus}→${ctx.requestedStatus}`;
        return !profile.rolePermissions[ctx.userRole]?.includes(transitionKey);
      },
      emit: (ctx, profile) => ({
        allowed: false,
        reason: `Role '${ctx.userRole}' cannot perform this transition`,
        validNextStates: profile.transitions[ctx.currentStatus] || [],
      }),
      explain: (ctx) =>
        `Role ${ctx.userRole} is not permitted to transition from ${ctx.currentStatus} to ${ctx.requestedStatus}`,
    },
    {
      id: "transition-allowed",
      when: () => true,
      emit: (ctx, profile) => ({
        allowed: true,
        reason: `Transition ${ctx.currentStatus} → ${ctx.requestedStatus} approved`,
        validNextStates: profile.transitions[ctx.requestedStatus] || [],
      }),
      explain: (ctx) =>
        `${ctx.userRole} approved to transition document from ${ctx.currentStatus} to ${ctx.requestedStatus}`,
    },
  ],
});

// ============================================================================
// DEMO
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const profile = {
    transitions: {
      draft: ["review"],
      review: ["draft", "approved"],
      approved: ["published", "review"],
      published: ["archived"],
      archived: [],
    },
    rolePermissions: {
      author: ["draft→review"],
      reviewer: ["review→draft", "review→approved"],
      admin: [
        "draft→review",
        "review→draft",
        "review→approved",
        "approved→published",
        "approved→review",
        "published→archived",
      ],
    },
  };

  const testCases = [
    { documentId: "doc1", currentStatus: "draft" as const, requestedStatus: "review" as const, userRole: "author" as const },
    { documentId: "doc2", currentStatus: "draft" as const, requestedStatus: "published" as const, userRole: "author" as const },
    { documentId: "doc3", currentStatus: "review" as const, requestedStatus: "approved" as const, userRole: "reviewer" as const },
    { documentId: "doc4", currentStatus: "review" as const, requestedStatus: "approved" as const, userRole: "author" as const },
    { documentId: "doc5", currentStatus: "approved" as const, requestedStatus: "published" as const, userRole: "admin" as const },
    { documentId: "doc6", currentStatus: "archived" as const, requestedStatus: "draft" as const, userRole: "admin" as const },
  ];

  console.log("Pattern: State Machine");
  console.log("Decision: document-status-change\n");
  console.log("Transitions: draft→review→approved→published→archived\n");

  for (const input of testCases) {
    const result = engine.run(documentStatus, input, { profile });
    console.log(`${input.currentStatus} → ${input.requestedStatus} (by ${input.userRole})`);
    console.log(`  Allowed: ${result.data?.allowed}`);
    console.log(`  Rule: ${result.meta.matchedRule}`);
    console.log(`  Reason: ${result.data?.reason}`);
    if (!result.data?.allowed) {
      console.log(`  Valid next: ${result.data?.validNextStates.join(", ") || "none"}`);
    }
    console.log();
  }
}
