import type { Tracer, Meter } from "@opentelemetry/api";
import type { Engine, Decision, Result, ProfileRegistry, RunOptions } from "@criterionx/core";

/**
 * Options for creating a traced engine
 */
export interface TracedEngineOptions {
  /** OpenTelemetry Tracer instance */
  tracer?: Tracer;
  /** OpenTelemetry Meter instance for metrics */
  meter?: Meter;
  /** Include input data in span attributes (careful with PII) */
  recordInput?: boolean;
  /** Include output data in span attributes */
  recordOutput?: boolean;
  /** Include profile data in span attributes */
  recordProfile?: boolean;
  /** Custom span name prefix (default: "criterion") */
  spanNamePrefix?: string;
}

/**
 * Span attributes added to decision evaluation spans
 */
export interface DecisionSpanAttributes {
  "criterion.decision.id": string;
  "criterion.decision.version": string;
  "criterion.status": string;
  "criterion.matched_rule"?: string;
  "criterion.rules_evaluated": number;
  "criterion.profile_id"?: string;
  "criterion.input"?: string;
  "criterion.output"?: string;
  "criterion.profile"?: string;
  "criterion.error"?: string;
}

/**
 * Metric names used by the instrumentation
 */
export const METRIC_NAMES = {
  /** Counter for decision evaluations */
  EVALUATIONS: "criterion.evaluations",
  /** Histogram for evaluation duration */
  DURATION: "criterion.duration",
  /** Counter for matched rules */
  RULES_MATCHED: "criterion.rules.matched",
  /** Counter for errors */
  ERRORS: "criterion.errors",
} as const;

/**
 * Metric label names
 */
export const METRIC_LABELS = {
  DECISION_ID: "decision_id",
  DECISION_VERSION: "decision_version",
  STATUS: "status",
  RULE_ID: "rule_id",
  ERROR_TYPE: "error_type",
} as const;

/**
 * Interface for a traced engine that wraps the base Engine
 */
export interface TracedEngine {
  /** Run a decision with tracing */
  run<TInput, TOutput, TProfile>(
    decision: Decision<TInput, TOutput, TProfile>,
    context: TInput,
    options: RunOptions<TProfile>,
    registry?: ProfileRegistry<TProfile>
  ): Result<TOutput>;

  /** Get the underlying engine */
  getEngine(): Engine;
}
