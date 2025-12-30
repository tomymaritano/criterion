/**
 * OpenTelemetry metrics for Criterion decision engine
 *
 * @example Basic usage
 * ```typescript
 * import { metrics } from "@opentelemetry/api";
 * import { createMetricsRecorder, recordEvaluation } from "@criterionx/opentelemetry";
 *
 * const recorder = createMetricsRecorder({
 *   meter: metrics.getMeter("my-app"),
 * });
 *
 * // After running a decision
 * recorder.recordEvaluation(decision, result, durationMs);
 * ```
 */

import { metrics, type Meter } from "@opentelemetry/api";
import { Engine, type Decision, type Result, type ProfileRegistry, type RunOptions } from "@criterionx/core";
import { METRIC_LABELS } from "./types.js";

/**
 * Options for creating a metrics recorder
 */
export interface MetricsRecorderOptions {
  /** OpenTelemetry Meter instance */
  meter?: Meter;
  /** Metric name prefix (default: "criterion") */
  prefix?: string;
}

/**
 * Metrics recorder for decision evaluations
 */
export interface MetricsRecorder {
  /** Record a decision evaluation */
  recordEvaluation<TOutput>(
    decision: Decision<unknown, TOutput, unknown>,
    result: Result<TOutput>,
    durationMs: number
  ): void;
}

/**
 * Create a metrics recorder for decision evaluations
 *
 * Records:
 * - `criterion.evaluations` (counter): Total evaluations by decision_id, status
 * - `criterion.duration` (histogram): Evaluation duration in milliseconds
 * - `criterion.rules.matched` (counter): Rule matches by decision_id, rule_id
 * - `criterion.errors` (counter): Errors by decision_id, error_type
 *
 * @example
 * ```typescript
 * import { metrics } from "@opentelemetry/api";
 * import { createMetricsRecorder } from "@criterionx/opentelemetry";
 *
 * const recorder = createMetricsRecorder({
 *   meter: metrics.getMeter("my-service"),
 * });
 *
 * // Use with engine
 * const start = performance.now();
 * const result = engine.run(decision, input, { profile });
 * const duration = performance.now() - start;
 *
 * recorder.recordEvaluation(decision, result, duration);
 * ```
 */
export function createMetricsRecorder(options: MetricsRecorderOptions = {}): MetricsRecorder {
  const {
    meter = metrics.getMeter("@criterionx/opentelemetry"),
    prefix = "criterion",
  } = options;

  // Create instruments
  const evaluationsCounter = meter.createCounter(`${prefix}.evaluations`, {
    description: "Total number of decision evaluations",
    unit: "1",
  });

  const durationHistogram = meter.createHistogram(`${prefix}.duration`, {
    description: "Decision evaluation duration",
    unit: "ms",
  });

  const rulesMatchedCounter = meter.createCounter(`${prefix}.rules.matched`, {
    description: "Number of rule matches by rule ID",
    unit: "1",
  });

  const errorsCounter = meter.createCounter(`${prefix}.errors`, {
    description: "Number of evaluation errors",
    unit: "1",
  });

  return {
    recordEvaluation<TOutput>(
      decision: Decision<unknown, TOutput, unknown>,
      result: Result<TOutput>,
      durationMs: number
    ): void {
      const labels = {
        [METRIC_LABELS.DECISION_ID]: decision.id,
        [METRIC_LABELS.DECISION_VERSION]: decision.version,
        [METRIC_LABELS.STATUS]: result.status,
      };

      // Record evaluation count
      evaluationsCounter.add(1, labels);

      // Record duration
      durationHistogram.record(durationMs, labels);

      // Record matched rule
      if (result.status === "OK" && result.meta.matchedRule) {
        rulesMatchedCounter.add(1, {
          [METRIC_LABELS.DECISION_ID]: decision.id,
          [METRIC_LABELS.RULE_ID]: result.meta.matchedRule,
        });
      }

      // Record errors
      if (result.status !== "OK") {
        errorsCounter.add(1, {
          [METRIC_LABELS.DECISION_ID]: decision.id,
          [METRIC_LABELS.ERROR_TYPE]: result.status,
        });
      }
    },
  };
}

/**
 * Create a metered engine that automatically records metrics
 *
 * Combines the base engine with automatic metrics recording.
 *
 * @example
 * ```typescript
 * import { createMeteredEngine } from "@criterionx/opentelemetry";
 *
 * const engine = createMeteredEngine({
 *   meter: metrics.getMeter("my-service"),
 * });
 *
 * // Metrics are automatically recorded
 * const result = engine.run(decision, input, { profile });
 * ```
 */
export function createMeteredEngine(options: MetricsRecorderOptions = {}): {
  run<TInput, TOutput, TProfile>(
    decision: Decision<TInput, TOutput, TProfile>,
    context: TInput,
    runOptions: RunOptions<TProfile>,
    registry?: ProfileRegistry<TProfile>
  ): Result<TOutput>;
} {
  const engine = new Engine();
  const recorder = createMetricsRecorder(options);

  return {
    run<TInput, TOutput, TProfile>(
      decision: Decision<TInput, TOutput, TProfile>,
      context: TInput,
      runOptions: RunOptions<TProfile>,
      registry?: ProfileRegistry<TProfile>
    ): Result<TOutput> {
      const start = performance.now();
      const result = engine.run(decision, context, runOptions, registry);
      const duration = performance.now() - start;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recorder.recordEvaluation(decision as any, result, duration);

      return result;
    },
  };
}
