/**
 * @criterionx/react
 *
 * React hooks for Criterion decision engine.
 *
 * @example Basic usage
 * ```tsx
 * import { useDecision, CriterionProvider } from "@criterionx/react";
 * import { defineDecision } from "@criterionx/core";
 * import { z } from "zod";
 *
 * const pricingDecision = defineDecision({
 *   id: "pricing",
 *   version: "1.0.0",
 *   inputSchema: z.object({ quantity: z.number() }),
 *   outputSchema: z.object({ price: z.number() }),
 *   profileSchema: z.object({ basePrice: z.number() }),
 *   rules: [
 *     {
 *       id: "calculate",
 *       when: () => true,
 *       emit: (input, profile) => ({ price: input.quantity * profile.basePrice }),
 *     },
 *   ],
 * });
 *
 * function PricingComponent() {
 *   const { result, evaluate } = useDecision(pricingDecision);
 *
 *   return (
 *     <button onClick={() => evaluate({ quantity: 5 }, { profile: { basePrice: 10 } })}>
 *       Calculate: {result?.data?.price ?? "?"}
 *     </button>
 *   );
 * }
 *
 * function App() {
 *   return (
 *     <CriterionProvider>
 *       <PricingComponent />
 *     </CriterionProvider>
 *   );
 * }
 * ```
 */

// Context and Provider
export { CriterionContext, CriterionProvider, useCriterion, useEngine, useProfileRegistry } from "./context.jsx";

// Hooks
export { useDecision } from "./useDecision.js";

// Types
export type {
  UseDecisionState,
  UseDecisionActions,
  UseDecisionReturn,
  UseDecisionOptions,
  CriterionContextValue,
  CriterionProviderProps,
} from "./types.js";
