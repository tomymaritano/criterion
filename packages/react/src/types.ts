import type { Engine, ProfileRegistry, Result, RunOptions } from "@criterionx/core";

/**
 * State returned by useDecision hook
 */
export interface UseDecisionState<TOutput> {
  /** Current result (null if not yet evaluated) */
  result: Result<TOutput> | null;
  /** Whether an evaluation is in progress */
  isEvaluating: boolean;
  /** Error from the last evaluation (null if no error) */
  error: Error | null;
}

/**
 * Actions returned by useDecision hook
 */
export interface UseDecisionActions<TInput, TProfile> {
  /** Evaluate the decision with given input and options */
  evaluate: (input: TInput, options: RunOptions<TProfile>) => void;
  /** Reset the state (clear result and error) */
  reset: () => void;
}

/**
 * Complete return type for useDecision hook
 */
export type UseDecisionReturn<TInput, TOutput, TProfile> = UseDecisionState<TOutput> &
  UseDecisionActions<TInput, TProfile>;

/**
 * Options for useDecision hook
 */
export interface UseDecisionOptions<TProfile> {
  /** Custom engine instance (uses default if not provided) */
  engine?: Engine;
  /** Profile registry for ID-based profile resolution */
  registry?: ProfileRegistry<TProfile>;
}

/**
 * Context value for CriterionProvider
 */
export interface CriterionContextValue {
  /** Engine instance */
  engine: Engine;
  /** Optional profile registry */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry?: ProfileRegistry<any>;
}

/**
 * Props for CriterionProvider
 */
export interface CriterionProviderProps {
  /** React children */
  children: React.ReactNode;
  /** Custom engine instance (creates default if not provided) */
  engine?: Engine;
  /** Profile registry for shared profiles */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registry?: ProfileRegistry<any>;
}
