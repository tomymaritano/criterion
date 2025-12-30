import type { Decision, Engine, ProfileRegistry, Result } from "@criterionx/core";

/**
 * Options for creating decision middleware
 */
export interface DecisionMiddlewareOptions<TInput, TOutput, TProfile> {
  /** The decision to evaluate */
  decision: Decision<TInput, TOutput, TProfile>;
  /** Engine instance (uses default if not provided) */
  engine?: Engine;
  /** Profile registry for ID-based profile resolution */
  registry?: ProfileRegistry<TProfile>;
  /** Extract input from request (default: req.body) */
  getInput?: (req: unknown) => TInput;
  /** Get profile or profile ID (default: req.query.profile or req.body.profile) */
  getProfile?: (req: unknown) => TProfile | string;
  /** Custom response formatter */
  formatResponse?: (result: Result<TOutput>) => unknown;
  /** Custom error handler */
  onError?: (error: Error, req: unknown, res: unknown) => void;
}

/**
 * Criterion middleware result attached to request
 */
export interface CriterionResult<TOutput> {
  result: Result<TOutput>;
  decision: string;
  evaluatedAt: string;
}
