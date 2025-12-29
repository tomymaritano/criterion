import type { Result } from "@criterionx/core";

/**
 * A recorded trace of a decision evaluation
 */
export interface Trace<TInput = unknown, TOutput = unknown, TProfile = unknown> {
  id: string;
  timestamp: string;
  decisionId: string;
  decisionVersion: string;
  input: TInput;
  profile: TProfile;
  profileId?: string;
  result: Result<TOutput>;
  durationMs: number;
}

/**
 * Options for the trace collector
 */
export interface CollectorOptions {
  /** Maximum number of traces to keep in memory */
  maxTraces?: number;
  /** Auto-flush traces to console */
  autoLog?: boolean;
}

/**
 * Options for exporting traces
 */
export interface ExportOptions {
  /** Format to export */
  format: "json" | "html";
  /** Include input/output data */
  includeData?: boolean;
  /** Pretty print JSON */
  pretty?: boolean;
}

/**
 * Summary statistics for collected traces
 */
export interface TraceSummary {
  totalTraces: number;
  byDecision: Record<string, number>;
  byStatus: Record<string, number>;
  byRule: Record<string, number>;
  avgDurationMs: number;
}

/**
 * Options for the HTML viewer
 */
export interface ViewerOptions {
  /** Title for the HTML report */
  title?: string;
  /** Include inline styles */
  inlineStyles?: boolean;
  /** Dark mode */
  darkMode?: boolean;
}
