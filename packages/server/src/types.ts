import type { Decision, Result } from "@criterionx/core";

// Re-export schema types from core
export type { JsonSchema, DecisionSchema } from "@criterionx/core";

/**
 * Context passed to hooks
 */
export interface HookContext {
  /** ID of the decision being evaluated */
  decisionId: string;
  /** Input data for the decision */
  input: unknown;
  /** Profile being used */
  profile: unknown;
  /** Request ID for tracing (auto-generated) */
  requestId: string;
  /** Timestamp when evaluation started */
  timestamp: Date;
}

/**
 * Hook called before decision evaluation
 *
 * Can modify context (input, profile) by returning a modified context.
 * Return undefined to keep original context.
 * Throw to abort evaluation with error.
 */
export type BeforeEvaluateHook = (
  ctx: HookContext
) => Promise<Partial<HookContext> | void> | Partial<HookContext> | void;

/**
 * Hook called after decision evaluation
 *
 * Receives the evaluation result. Cannot modify the result.
 * Use for logging, metrics, side effects.
 */
export type AfterEvaluateHook = (
  ctx: HookContext,
  result: Result<unknown>
) => Promise<void> | void;

/**
 * Hook called when an error occurs during evaluation
 */
export type OnErrorHook = (
  ctx: HookContext,
  error: Error
) => Promise<void> | void;

/**
 * Middleware hooks configuration
 */
export interface Hooks {
  /** Called before decision evaluation */
  beforeEvaluate?: BeforeEvaluateHook;
  /** Called after successful evaluation */
  afterEvaluate?: AfterEvaluateHook;
  /** Called when an error occurs */
  onError?: OnErrorHook;
}

/**
 * Metrics configuration options
 */
export interface MetricsOptions {
  /** Enable metrics collection (default: false) */
  enabled?: boolean;
  /** Endpoint path for metrics (default: /metrics) */
  endpoint?: string;
  /** Histogram buckets for latency in seconds */
  buckets?: number[];
}

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
  /** Middleware hooks for evaluation lifecycle */
  hooks?: Hooks;
  /** Prometheus metrics configuration */
  metrics?: MetricsOptions;
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
