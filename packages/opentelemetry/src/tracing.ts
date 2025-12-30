/**
 * OpenTelemetry tracing for Criterion decision engine
 *
 * @example Basic usage
 * ```typescript
 * import { trace } from "@opentelemetry/api";
 * import { createTracedEngine } from "@criterionx/opentelemetry";
 *
 * const tracedEngine = createTracedEngine({
 *   tracer: trace.getTracer("my-app"),
 * });
 *
 * const result = tracedEngine.run(decision, input, { profile });
 * // Automatically creates a span with decision metadata
 * ```
 */

import {
  trace,
  SpanKind,
  SpanStatusCode,
  type Span,
} from "@opentelemetry/api";
import { Engine, type Decision, type ProfileRegistry, type Result, type RunOptions } from "@criterionx/core";
import type { TracedEngineOptions, TracedEngine } from "./types.js";

const DEFAULT_SPAN_PREFIX = "criterion";

/**
 * Create a traced engine that wraps decision evaluation with OpenTelemetry spans
 *
 * @example With custom options
 * ```typescript
 * const tracedEngine = createTracedEngine({
 *   tracer: trace.getTracer("my-service", "1.0.0"),
 *   recordInput: true,  // Include input in span (careful with PII)
 *   recordOutput: true, // Include output in span
 *   spanNamePrefix: "decisions",
 * });
 * ```
 */
export function createTracedEngine(options: TracedEngineOptions = {}): TracedEngine {
  const {
    tracer = trace.getTracer("@criterionx/opentelemetry"),
    recordInput = false,
    recordOutput = false,
    recordProfile = false,
    spanNamePrefix = DEFAULT_SPAN_PREFIX,
  } = options;

  const engine = new Engine();

  return {
    run<TInput, TOutput, TProfile>(
      decision: Decision<TInput, TOutput, TProfile>,
      context: TInput,
      runOptions: RunOptions<TProfile>,
      registry?: ProfileRegistry<TProfile>
    ): Result<TOutput> {
      const spanName = `${spanNamePrefix}.${decision.id}`;

      return tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, (span: Span) => {
        const startTime = performance.now();

        try {
          // Set initial attributes
          span.setAttribute("criterion.decision.id", decision.id);
          span.setAttribute("criterion.decision.version", decision.version);

          // Record input if enabled
          if (recordInput) {
            span.setAttribute("criterion.input", JSON.stringify(context));
          }

          // Record profile info
          if (typeof runOptions.profile === "string") {
            span.setAttribute("criterion.profile_id", runOptions.profile);
          } else if (recordProfile) {
            span.setAttribute("criterion.profile", JSON.stringify(runOptions.profile));
          }

          // Run the decision
          const result = engine.run(decision, context, runOptions, registry);

          // Record result attributes
          span.setAttribute("criterion.status", result.status);
          span.setAttribute("criterion.rules_evaluated", result.meta.evaluatedRules.length);

          if (result.status === "OK" && result.meta.matchedRule) {
            span.setAttribute("criterion.matched_rule", result.meta.matchedRule);
          }

          if (result.meta.profileId) {
            span.setAttribute("criterion.profile_id", result.meta.profileId);
          }

          // Record output if enabled
          if (recordOutput && result.data) {
            span.setAttribute("criterion.output", JSON.stringify(result.data));
          }

          // Set span status based on result
          if (result.status === "OK") {
            span.setStatus({ code: SpanStatusCode.OK });
          } else {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.meta.explanation,
            });
            span.setAttribute("criterion.error", result.meta.explanation);
          }

          // Record duration
          const duration = performance.now() - startTime;
          span.setAttribute("criterion.duration_ms", duration);

          return result;
        } catch (error) {
          // Record exception
          const err = error instanceof Error ? error : new Error(String(error));
          span.recordException(err);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
          span.setAttribute("criterion.error", err.message);
          throw error;
        } finally {
          span.end();
        }
      });
    },

    getEngine(): Engine {
      return engine;
    },
  };
}

/**
 * Wrap an existing engine with tracing capabilities
 *
 * @example
 * ```typescript
 * import { Engine } from "@criterionx/core";
 * import { wrapEngine } from "@criterionx/opentelemetry";
 *
 * const engine = new Engine();
 * const tracedEngine = wrapEngine(engine, {
 *   tracer: myTracer,
 * });
 * ```
 */
export function wrapEngine(engine: Engine, options: TracedEngineOptions = {}): TracedEngine {
  const {
    tracer = trace.getTracer("@criterionx/opentelemetry"),
    recordInput = false,
    recordOutput = false,
    recordProfile = false,
    spanNamePrefix = DEFAULT_SPAN_PREFIX,
  } = options;

  return {
    run<TInput, TOutput, TProfile>(
      decision: Decision<TInput, TOutput, TProfile>,
      context: TInput,
      runOptions: RunOptions<TProfile>,
      registry?: ProfileRegistry<TProfile>
    ): Result<TOutput> {
      const spanName = `${spanNamePrefix}.${decision.id}`;

      return tracer.startActiveSpan(spanName, { kind: SpanKind.INTERNAL }, (span: Span) => {
        const startTime = performance.now();

        try {
          span.setAttribute("criterion.decision.id", decision.id);
          span.setAttribute("criterion.decision.version", decision.version);

          if (recordInput) {
            span.setAttribute("criterion.input", JSON.stringify(context));
          }

          if (typeof runOptions.profile === "string") {
            span.setAttribute("criterion.profile_id", runOptions.profile);
          } else if (recordProfile) {
            span.setAttribute("criterion.profile", JSON.stringify(runOptions.profile));
          }

          const result = engine.run(decision, context, runOptions, registry);

          span.setAttribute("criterion.status", result.status);
          span.setAttribute("criterion.rules_evaluated", result.meta.evaluatedRules.length);

          if (result.status === "OK" && result.meta.matchedRule) {
            span.setAttribute("criterion.matched_rule", result.meta.matchedRule);
          }

          if (result.meta.profileId) {
            span.setAttribute("criterion.profile_id", result.meta.profileId);
          }

          if (recordOutput && result.data) {
            span.setAttribute("criterion.output", JSON.stringify(result.data));
          }

          if (result.status === "OK") {
            span.setStatus({ code: SpanStatusCode.OK });
          } else {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: result.meta.explanation,
            });
            span.setAttribute("criterion.error", result.meta.explanation);
          }

          const duration = performance.now() - startTime;
          span.setAttribute("criterion.duration_ms", duration);

          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          span.recordException(err);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
          span.setAttribute("criterion.error", err.message);
          throw error;
        } finally {
          span.end();
        }
      });
    },

    getEngine(): Engine {
      return engine;
    },
  };
}
