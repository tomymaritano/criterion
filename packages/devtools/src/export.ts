import type { Trace, TraceSummary, ViewerOptions } from "./types.js";
import { generateHtmlReport } from "./viewer.js";

/**
 * Export traces to JSON format
 */
export function exportToJson(
  traces: Trace[],
  options: { pretty?: boolean; includeData?: boolean } = {}
): string {
  const { pretty = true, includeData = true } = options;

  const exportData = traces.map((trace) => {
    if (!includeData) {
      return {
        id: trace.id,
        timestamp: trace.timestamp,
        decisionId: trace.decisionId,
        decisionVersion: trace.decisionVersion,
        status: trace.result.status,
        matchedRule: trace.result.meta.matchedRule,
        durationMs: trace.durationMs,
      };
    }
    return trace;
  });

  return pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}

/**
 * Export traces to HTML format
 */
export function exportToHtml(
  traces: Trace[],
  summary: TraceSummary,
  options: ViewerOptions = {}
): string {
  return generateHtmlReport(traces, summary, options);
}

/**
 * Export a single trace for debugging
 */
export function exportTrace(trace: Trace, format: "json" | "markdown" = "json"): string {
  if (format === "markdown") {
    return formatTraceAsMarkdown(trace);
  }
  return JSON.stringify(trace, null, 2);
}

/**
 * Format a trace as markdown
 */
function formatTraceAsMarkdown(trace: Trace): string {
  const lines: string[] = [];

  lines.push(`# Trace: ${trace.decisionId}`);
  lines.push("");
  lines.push(`- **Version:** ${trace.decisionVersion}`);
  lines.push(`- **Status:** ${trace.result.status}`);
  lines.push(`- **Duration:** ${trace.durationMs.toFixed(2)}ms`);
  lines.push(`- **Timestamp:** ${trace.timestamp}`);
  lines.push("");

  lines.push("## Rule Evaluation");
  lines.push("");
  lines.push("| Rule | Matched | Explanation |");
  lines.push("|------|---------|-------------|");

  for (const rule of trace.result.meta.evaluatedRules) {
    const matched = rule.matched ? "Yes" : "No";
    const explain = rule.explanation ?? "-";
    lines.push(`| ${rule.ruleId} | ${matched} | ${explain} |`);
  }

  lines.push("");
  lines.push("## Input");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(trace.input, null, 2));
  lines.push("```");
  lines.push("");

  if (trace.result.data) {
    lines.push("## Output");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(trace.result.data, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Explanation");
  lines.push("");
  lines.push(trace.result.meta.explanation);

  return lines.join("\n");
}

/**
 * Create a shareable report URL (data URI)
 */
export function createShareableUrl(
  traces: Trace[],
  summary: TraceSummary,
  options: ViewerOptions = {}
): string {
  const html = generateHtmlReport(traces, summary, options);
  const encoded = Buffer.from(html).toString("base64");
  return `data:text/html;base64,${encoded}`;
}
