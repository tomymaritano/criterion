/**
 * Criterion - Universal Decision Engine
 *
 * A declarative, deterministic, and explainable decision engine
 * for business-critical decisions.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { defineDecision, createRule, engine, createProfileRegistry } from "criterion";
 *
 * const decision = defineDecision({
 *   id: "user-tier",
 *   version: "1.0.0",
 *   inputSchema: z.object({ age: z.number(), verified: z.boolean() }),
 *   outputSchema: z.object({ tier: z.enum(["basic", "premium"]), reason: z.string() }),
 *   profileSchema: z.object({ minAge: z.number() }),
 *   rules: [
 *     createRule({
 *       id: "premium",
 *       when: (ctx, profile) => ctx.verified && ctx.age >= profile.minAge,
 *       emit: () => ({ tier: "premium", reason: "Verified adult user" }),
 *       explain: () => "User meets premium criteria",
 *     }),
 *     createRule({
 *       id: "basic",
 *       when: () => true,
 *       emit: () => ({ tier: "basic", reason: "Default tier" }),
 *       explain: () => "Default fallback",
 *     }),
 *   ],
 * });
 *
 * const result = engine.run(decision, { age: 25, verified: true }, { profile: { minAge: 18 } });
 * ```
 */

// Types
export type {
  Decision,
  DecisionMeta,
  ProfileRegistry,
  Result,
  ResultMeta,
  ResultStatus,
  Rule,
  RuleTrace,
  RunOptions,
} from "./types.js";

// Functions
export {
  createProfileRegistry,
  createRule,
  defineDecision,
  isInlineProfile,
} from "./types.js";

// Engine
export { Engine, engine } from "./engine.js";
