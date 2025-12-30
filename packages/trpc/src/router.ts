/**
 * tRPC integration for Criterion decision engine
 *
 * @example Basic usage
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import { createDecisionProcedure } from "@criterionx/trpc";
 * import { pricingDecision } from "./decisions";
 *
 * const t = initTRPC.create();
 *
 * const appRouter = t.router({
 *   pricing: createDecisionProcedure(t, {
 *     decision: pricingDecision,
 *     defaultProfile: { basePrice: 100 },
 *   }),
 * });
 *
 * // Client usage (fully typed)
 * const result = await trpc.pricing.mutate({
 *   input: { quantity: 5 },
 * });
 * ```
 */

import { z } from "zod";
import { Engine } from "@criterionx/core";
import type { Result } from "@criterionx/core";
import type { DecisionProcedureOptions, DecisionRouterOptions } from "./types.js";

const defaultEngine = new Engine();

/**
 * Create a tRPC procedure for evaluating a decision
 *
 * Returns a mutation procedure that accepts decision input and optional profile,
 * and returns the evaluation result with full type inference.
 *
 * @example
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import { createDecisionProcedure } from "@criterionx/trpc";
 *
 * const t = initTRPC.create();
 *
 * const router = t.router({
 *   pricing: createDecisionProcedure(t, {
 *     decision: pricingDecision,
 *     defaultProfile: { basePrice: 100 },
 *   }),
 *   eligibility: createDecisionProcedure(t, {
 *     decision: eligibilityDecision,
 *     defaultProfile: "standard",
 *   }),
 * });
 * ```
 */
export function createDecisionProcedure<
  TInput,
  TOutput,
  TProfile,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { procedure: any; router: any }
>(
  t: T,
  options: DecisionProcedureOptions<TInput, TOutput, TProfile>
): ReturnType<T["procedure"]["input"]> {
  const {
    decision,
    engine = defaultEngine,
    registry,
    defaultProfile,
  } = options;

  // Create input schema that combines decision input with optional profile
  const inputSchema = z.object({
    input: decision.inputSchema,
    profile: z.union([decision.profileSchema, z.string()]).optional(),
  });

  return t.procedure
    .input(inputSchema)
    .mutation(({ input: { input, profile: profileInput } }: { input: { input: TInput; profile?: TProfile | string } }) => {
      const profile = profileInput ?? defaultProfile;

      if (profile === undefined) {
        return {
          status: "INVALID_INPUT" as const,
          data: null,
          meta: {
            decisionId: decision.id,
            decisionVersion: decision.version,
            evaluatedRules: [],
            explanation: "No profile provided and no default profile configured",
            evaluatedAt: new Date().toISOString(),
          },
        } as Result<TOutput>;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return engine.run(decision, input, { profile } as any, registry);
    });
}

/**
 * Create a tRPC router with procedures for multiple decisions
 *
 * Each decision becomes a procedure in the router, accessible by its ID.
 *
 * @example
 * ```typescript
 * import { initTRPC } from "@trpc/server";
 * import { createDecisionRouter } from "@criterionx/trpc";
 *
 * const t = initTRPC.create();
 *
 * const decisionsRouter = createDecisionRouter(t, {
 *   decisions: [pricingDecision, eligibilityDecision],
 *   profiles: {
 *     pricing: { basePrice: 100 },
 *     eligibility: { minAge: 18 },
 *   },
 * });
 *
 * const appRouter = t.router({
 *   decisions: decisionsRouter,
 * });
 *
 * // Client usage
 * const result = await trpc.decisions.pricing.mutate({ input: { quantity: 5 } });
 * ```
 */
export function createDecisionRouter<
  TProfile,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends { procedure: any; router: any }
>(
  t: T,
  options: DecisionRouterOptions<TProfile>
): ReturnType<T["router"]> {
  const {
    decisions,
    profiles = {},
    engine = defaultEngine,
    registry,
  } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const procedures: Record<string, any> = {};

  for (const decision of decisions) {
    procedures[decision.id] = createDecisionProcedure(t, {
      decision,
      engine,
      registry,
      defaultProfile: profiles[decision.id],
    });
  }

  return t.router(procedures);
}

/**
 * Helper to create a typed decision caller for use outside of tRPC context
 *
 * Useful for server-side code that needs to call decisions directly
 * with the same interface as tRPC procedures.
 *
 * @example
 * ```typescript
 * import { createDecisionCaller } from "@criterionx/trpc";
 *
 * const callPricing = createDecisionCaller({
 *   decision: pricingDecision,
 *   defaultProfile: { basePrice: 100 },
 * });
 *
 * const result = callPricing({ input: { quantity: 5 } });
 * ```
 */
export function createDecisionCaller<TInput, TOutput, TProfile>(
  options: DecisionProcedureOptions<TInput, TOutput, TProfile>
): (args: { input: TInput; profile?: TProfile | string }) => Result<TOutput> {
  const {
    decision,
    engine = defaultEngine,
    registry,
    defaultProfile,
  } = options;

  return ({ input, profile: profileInput }) => {
    const profile = profileInput ?? defaultProfile;

    if (profile === undefined) {
      return {
        status: "INVALID_INPUT",
        data: null,
        meta: {
          decisionId: decision.id,
          decisionVersion: decision.version,
          evaluatedRules: [],
          explanation: "No profile provided and no default profile configured",
          evaluatedAt: new Date().toISOString(),
        },
      } as Result<TOutput>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return engine.run(decision, input, { profile } as any, registry);
  };
}
