import type { Decision, Engine, ProfileRegistry, Result } from "@criterionx/core";

/**
 * Options for creating a decision procedure
 */
export interface DecisionProcedureOptions<TInput, TOutput, TProfile> {
  /** The decision to evaluate */
  decision: Decision<TInput, TOutput, TProfile>;
  /** Engine instance (uses default if not provided) */
  engine?: Engine;
  /** Profile registry for ID-based profile resolution */
  registry?: ProfileRegistry<TProfile>;
  /** Default profile to use if not specified in input */
  defaultProfile?: TProfile | string;
}

/**
 * Input for decision evaluation via tRPC
 */
export interface DecisionInput<TInput, TProfile> {
  /** Decision input data */
  input: TInput;
  /** Profile object or profile ID */
  profile?: TProfile | string;
}

/**
 * Options for creating a decision router
 */
export interface DecisionRouterOptions<TProfile> {
  /** Decisions to include in the router */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Array<Decision<any, any, TProfile>>;
  /** Profile map by decision ID or profile name */
  profiles?: Record<string, TProfile>;
  /** Engine instance */
  engine?: Engine;
  /** Profile registry */
  registry?: ProfileRegistry<TProfile>;
}

/**
 * Result type for decision evaluation
 */
export type DecisionResult<TOutput> = Result<TOutput>;
