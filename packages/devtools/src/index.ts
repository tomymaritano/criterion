/**
 * @criterionx/devtools
 *
 * Development tools for debugging Criterion decisions
 */

// Trace collector
export { TraceCollector, createCollector } from "./collector.js";

// Viewer
export { generateHtmlReport, formatTraceForConsole } from "./viewer.js";

// Export utilities
export {
  exportToJson,
  exportToHtml,
  exportTrace,
  createShareableUrl,
} from "./export.js";

// Types
export type {
  Trace,
  CollectorOptions,
  ExportOptions,
  TraceSummary,
  ViewerOptions,
} from "./types.js";
