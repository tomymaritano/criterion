import { useCallback, useState } from "react";
import type { Decision, Result, RunOptions } from "@criterionx/core";
import { useCriterion } from "./context.jsx";
import type { UseDecisionOptions, UseDecisionReturn } from "./types.js";

/**
 * React hook for evaluating Criterion decisions
 *
 * Provides a convenient way to run decisions in React components with
 * automatic state management for results, loading state, and errors.
 *
 * @param decision - The decision to evaluate
 * @param options - Optional configuration (custom engine, registry)
 * @returns State and actions for decision evaluation
 *
 * @example Basic usage
 * ```tsx
 * import { useDecision } from "@criterionx/react";
 * import { pricingDecision } from "./decisions";
 *
 * function PricingComponent() {
 *   const { result, isEvaluating, error, evaluate } = useDecision(pricingDecision);
 *
 *   const handleCalculate = () => {
 *     evaluate(
 *       { quantity: 10, customerType: "premium" },
 *       { profile: { basePrice: 100, premiumDiscount: 0.2 } }
 *     );
 *   };
 *
 *   if (isEvaluating) return <div>Calculating...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <button onClick={handleCalculate}>Calculate Price</button>
 *       {result && <div>Price: ${result.data?.price}</div>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With profile registry
 * ```tsx
 * function PricingComponent() {
 *   const { evaluate, result } = useDecision(pricingDecision);
 *
 *   // Use profile ID from registry
 *   const handleCalculate = () => {
 *     evaluate({ quantity: 10 }, { profile: "premium-pricing" });
 *   };
 *
 *   // ...
 * }
 * ```
 */
export function useDecision<TInput, TOutput, TProfile>(
  decision: Decision<TInput, TOutput, TProfile>,
  options?: UseDecisionOptions<TProfile>
): UseDecisionReturn<TInput, TOutput, TProfile> {
  const context = useCriterion();
  const engine = options?.engine ?? context.engine;
  const registry = options?.registry ?? context.registry;

  const [result, setResult] = useState<Result<TOutput> | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const evaluate = useCallback(
    (input: TInput, runOptions: RunOptions<TProfile>) => {
      setIsEvaluating(true);
      setError(null);

      try {
        const evalResult = engine.run(decision, input, runOptions, registry);
        setResult(evalResult);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setResult(null);
      } finally {
        setIsEvaluating(false);
      }
    },
    [decision, engine, registry]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setIsEvaluating(false);
  }, []);

  return {
    result,
    isEvaluating,
    error,
    evaluate,
    reset,
  };
}
