/**
 * @criterionx/opentelemetry
 *
 * OpenTelemetry instrumentation for Criterion decision engine.
 * Provides tracing and metrics for observability.
 *
 * @example Tracing
 * ```typescript
 * import { trace } from "@opentelemetry/api";
 * import { createTracedEngine } from "@criterionx/opentelemetry";
 *
 * const tracedEngine = createTracedEngine({
 *   tracer: trace.getTracer("my-service"),
 *   recordInput: true,  // Optional: include input in spans
 *   recordOutput: true, // Optional: include output in spans
 * });
 *
 * // Automatically creates spans with decision metadata
 * const result = tracedEngine.run(decision, input, { profile });
 * ```
 *
 * @example Metrics
 * ```typescript
 * import { metrics } from "@opentelemetry/api";
 * import { createMetricsRecorder } from "@criterionx/opentelemetry";
 *
 * const recorder = createMetricsRecorder({
 *   meter: metrics.getMeter("my-service"),
 * });
 *
 * // After running a decision
 * const start = performance.now();
 * const result = engine.run(decision, input, { profile });
 * recorder.recordEvaluation(decision, result, performance.now() - start);
 * ```
 *
 * @example Combined tracing and metrics
 * ```typescript
 * import { trace, metrics } from "@opentelemetry/api";
 * import { createTracedEngine, createMetricsRecorder } from "@criterionx/opentelemetry";
 *
 * const tracedEngine = createTracedEngine({
 *   tracer: trace.getTracer("my-service"),
 * });
 *
 * const recorder = createMetricsRecorder({
 *   meter: metrics.getMeter("my-service"),
 * });
 *
 * // Run with tracing
 * const start = performance.now();
 * const result = tracedEngine.run(decision, input, { profile });
 * recorder.recordEvaluation(decision, result, performance.now() - start);
 * ```
 */

// Tracing
export { createTracedEngine, wrapEngine } from "./tracing.js";

// Metrics
export { createMetricsRecorder, createMeteredEngine, type MetricsRecorderOptions, type MetricsRecorder } from "./metrics.js";

// Types
export type {
  TracedEngineOptions,
  TracedEngine,
  DecisionSpanAttributes,
} from "./types.js";

export { METRIC_NAMES, METRIC_LABELS } from "./types.js";
