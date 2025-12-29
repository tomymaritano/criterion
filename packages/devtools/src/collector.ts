import {
  Engine,
  type Decision,
  type Result,
  type RunOptions,
  type ProfileRegistry,
} from "@criterionx/core";
import type { Trace, CollectorOptions, TraceSummary } from "./types.js";

/**
 * Generate a unique trace ID
 */
function generateId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Trace Collector
 *
 * Wraps the Criterion engine to collect and analyze decision traces.
 */
export class TraceCollector {
  private traces: Trace[] = [];
  private readonly maxTraces: number;
  private readonly autoLog: boolean;
  private readonly engine: Engine;

  constructor(options: CollectorOptions = {}) {
    this.maxTraces = options.maxTraces ?? 1000;
    this.autoLog = options.autoLog ?? false;
    this.engine = new Engine();
  }

  /**
   * Run a decision and collect the trace
   */
  run<TInput, TOutput, TProfile>(
    decision: Decision<TInput, TOutput, TProfile>,
    input: TInput,
    options: RunOptions<TProfile>,
    registry?: ProfileRegistry<TProfile>
  ): Result<TOutput> {
    const startTime = performance.now();

    const result = this.engine.run(decision, input, options, registry);

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    const trace: Trace<TInput, TOutput, TProfile> = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      decisionId: decision.id,
      decisionVersion: decision.version,
      input,
      profile:
        typeof options.profile === "string"
          ? (registry?.get(options.profile) as TProfile)
          : options.profile,
      profileId:
        typeof options.profile === "string" ? options.profile : undefined,
      result: result as Result<TOutput>,
      durationMs,
    };

    this.addTrace(trace);

    if (this.autoLog) {
      this.logTrace(trace);
    }

    return result;
  }

  /**
   * Add a trace to the collection
   */
  private addTrace(trace: Trace): void {
    this.traces.push(trace);

    // Trim old traces if over limit
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }

  /**
   * Log a trace to console
   */
  private logTrace(trace: Trace): void {
    const status = trace.result.status;
    const rule = trace.result.meta.matchedRule ?? "none";
    const duration = trace.durationMs.toFixed(2);

    console.log(
      `[Criterion] ${trace.decisionId} | ${status} | rule: ${rule} | ${duration}ms`
    );
  }

  /**
   * Get all collected traces
   */
  getTraces(): Trace[] {
    return [...this.traces];
  }

  /**
   * Get traces for a specific decision
   */
  getTracesForDecision(decisionId: string): Trace[] {
    return this.traces.filter((t) => t.decisionId === decisionId);
  }

  /**
   * Get the most recent trace
   */
  getLastTrace(): Trace | undefined {
    return this.traces[this.traces.length - 1];
  }

  /**
   * Get summary statistics
   */
  getSummary(): TraceSummary {
    const byDecision: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byRule: Record<string, number> = {};
    let totalDuration = 0;

    for (const trace of this.traces) {
      // By decision
      byDecision[trace.decisionId] = (byDecision[trace.decisionId] ?? 0) + 1;

      // By status
      byStatus[trace.result.status] = (byStatus[trace.result.status] ?? 0) + 1;

      // By rule
      const rule = trace.result.meta.matchedRule ?? "NO_MATCH";
      byRule[rule] = (byRule[rule] ?? 0) + 1;

      // Duration
      totalDuration += trace.durationMs;
    }

    return {
      totalTraces: this.traces.length,
      byDecision,
      byStatus,
      byRule,
      avgDurationMs:
        this.traces.length > 0 ? totalDuration / this.traces.length : 0,
    };
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces = [];
  }

  /**
   * Get trace count
   */
  get count(): number {
    return this.traces.length;
  }
}

/**
 * Create a new trace collector
 */
export function createCollector(options?: CollectorOptions): TraceCollector {
  return new TraceCollector(options);
}
