/**
 * @criterionx/trpc
 *
 * tRPC integration for Criterion decision engine.
 * Provides type-safe RPC procedures for evaluating decisions.
 *
 * @example Basic usage
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import { createDecisionProcedure, createDecisionRouter } from "@criterionx/trpc";
 * import { pricingDecision, eligibilityDecision } from "./decisions";
 *
 * const t = initTRPC.create();
 *
 * // Option 1: Individual procedures
 * const appRouter = t.router({
 *   pricing: createDecisionProcedure(t, {
 *     decision: pricingDecision,
 *     defaultProfile: { basePrice: 100 },
 *   }),
 * });
 *
 * // Option 2: Router with multiple decisions
 * const decisionsRouter = createDecisionRouter(t, {
 *   decisions: [pricingDecision, eligibilityDecision],
 *   profiles: {
 *     pricing: { basePrice: 100 },
 *     eligibility: { minAge: 18 },
 *   },
 * });
 *
 * // Client usage (fully typed)
 * const result = await trpc.pricing.mutate({
 *   input: { quantity: 5 },
 *   profile: { basePrice: 150 }, // Optional override
 * });
 * ```
 */

// Router and procedure factories
export {
  createDecisionProcedure,
  createDecisionRouter,
  createDecisionCaller,
} from "./router.js";

// Types
export type {
  DecisionProcedureOptions,
  DecisionInput,
  DecisionRouterOptions,
  DecisionResult,
} from "./types.js";
