import type { Decision } from "@criterionx/core";

// Re-export schema types from core
export type { JsonSchema, DecisionSchema } from "@criterionx/core";

/**
 * Server configuration options
 */
export interface ServerOptions {
  /** Decisions to expose via HTTP */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decisions: Decision<any, any, any>[];
  /** Default profiles for decisions (keyed by decision ID) */
  profiles?: Record<string, unknown>;
  /** Enable CORS (default: true) */
  cors?: boolean;
}

/**
 * Request body for decision evaluation
 */
export interface EvaluateRequest {
  /** Input data for the decision */
  input: unknown;
  /** Profile to use (overrides default) */
  profile?: unknown;
}

/**
 * Decision info for listing
 */
export interface DecisionInfo {
  id: string;
  version: string;
  description?: string;
  meta?: Record<string, unknown>;
}
