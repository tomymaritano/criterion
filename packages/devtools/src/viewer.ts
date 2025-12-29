import type { Trace, ViewerOptions, TraceSummary } from "./types.js";

/**
 * Generate CSS styles for the trace viewer
 */
function generateStyles(darkMode: boolean): string {
  const bg = darkMode ? "#1a1a2e" : "#ffffff";
  const bgCard = darkMode ? "#16213e" : "#f8f9fa";
  const text = darkMode ? "#eaeaea" : "#212529";
  const textMuted = darkMode ? "#a0a0a0" : "#6c757d";
  const border = darkMode ? "#0f3460" : "#dee2e6";
  const success = "#28a745";
  const danger = "#dc3545";
  const warning = "#ffc107";

  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bg};
      color: ${text};
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { margin-bottom: 1.5rem; font-size: 1.75rem; }
    h2 { margin: 1.5rem 0 1rem; font-size: 1.25rem; color: ${textMuted}; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: ${bgCard};
      border: 1px solid ${border};
      border-radius: 8px;
      padding: 1rem;
    }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { color: ${textMuted}; font-size: 0.875rem; }
    .trace {
      background: ${bgCard};
      border: 1px solid ${border};
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .trace-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid ${border};
      cursor: pointer;
    }
    .trace-header:hover { background: ${darkMode ? "#1f2b4a" : "#f1f3f4"}; }
    .trace-title { font-weight: 600; }
    .trace-meta { display: flex; gap: 1rem; font-size: 0.875rem; color: ${textMuted}; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .badge-ok { background: ${success}; color: white; }
    .badge-no-match { background: ${warning}; color: black; }
    .badge-invalid { background: ${danger}; color: white; }
    .trace-body { padding: 1rem; display: none; }
    .trace.open .trace-body { display: block; }
    .trace-section { margin-bottom: 1rem; }
    .trace-section-title { font-weight: 600; margin-bottom: 0.5rem; font-size: 0.875rem; }
    .rules-list { list-style: none; }
    .rule {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.25rem;
    }
    .rule-matched { background: ${darkMode ? "#1a3a2a" : "#d4edda"}; }
    .rule-icon { font-size: 1rem; }
    .rule-id { font-weight: 500; }
    .rule-explain { color: ${textMuted}; font-size: 0.875rem; }
    pre {
      background: ${darkMode ? "#0d1117" : "#f6f8fa"};
      border: 1px solid ${border};
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.875rem;
    }
    code { font-family: 'SF Mono', Monaco, Consolas, monospace; }
  `;
}

/**
 * Generate HTML for a single trace
 */
function renderTrace(trace: Trace, index: number): string {
  const statusClass =
    trace.result.status === "OK"
      ? "badge-ok"
      : trace.result.status === "NO_MATCH"
        ? "badge-no-match"
        : "badge-invalid";

  const rules = trace.result.meta.evaluatedRules
    .map(
      (rule) => `
      <li class="rule ${rule.matched ? "rule-matched" : ""}">
        <span class="rule-icon">${rule.matched ? "✓" : "✗"}</span>
        <span class="rule-id">${rule.ruleId}</span>
        ${rule.explanation ? `<span class="rule-explain">— ${rule.explanation}</span>` : ""}
      </li>
    `
    )
    .join("");

  return `
    <div class="trace" id="trace-${index}">
      <div class="trace-header" onclick="toggleTrace(${index})">
        <div>
          <span class="trace-title">${trace.decisionId}</span>
          <span class="badge ${statusClass}">${trace.result.status}</span>
        </div>
        <div class="trace-meta">
          <span>${trace.result.meta.matchedRule ?? "No match"}</span>
          <span>${trace.durationMs.toFixed(2)}ms</span>
          <span>${new Date(trace.timestamp).toLocaleTimeString()}</span>
        </div>
      </div>
      <div class="trace-body">
        <div class="trace-section">
          <div class="trace-section-title">Rule Evaluation</div>
          <ul class="rules-list">${rules}</ul>
        </div>
        <div class="trace-section">
          <div class="trace-section-title">Input</div>
          <pre><code>${JSON.stringify(trace.input, null, 2)}</code></pre>
        </div>
        ${
          trace.result.data
            ? `
        <div class="trace-section">
          <div class="trace-section-title">Output</div>
          <pre><code>${JSON.stringify(trace.result.data, null, 2)}</code></pre>
        </div>
        `
            : ""
        }
        <div class="trace-section">
          <div class="trace-section-title">Explanation</div>
          <p>${trace.result.meta.explanation}</p>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generate summary section HTML
 */
function renderSummary(summary: TraceSummary): string {
  return `
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${summary.totalTraces}</div>
        <div class="stat-label">Total Traces</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.avgDurationMs.toFixed(2)}ms</div>
        <div class="stat-label">Avg Duration</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.byStatus["OK"] ?? 0}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat">
        <div class="stat-value">${(summary.byStatus["NO_MATCH"] ?? 0) + (summary.byStatus["INVALID_INPUT"] ?? 0) + (summary.byStatus["INVALID_OUTPUT"] ?? 0)}</div>
        <div class="stat-label">Failed/No Match</div>
      </div>
    </div>
  `;
}

/**
 * Generate a complete HTML report for traces
 */
export function generateHtmlReport(
  traces: Trace[],
  summary: TraceSummary,
  options: ViewerOptions = {}
): string {
  const title = options.title ?? "Criterion Trace Viewer";
  const darkMode = options.darkMode ?? false;

  const tracesHtml = traces
    .slice()
    .reverse()
    .map((t, i) => renderTrace(t, i))
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${generateStyles(darkMode)}</style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>

    <h2>Summary</h2>
    ${renderSummary(summary)}

    <h2>Traces (${traces.length})</h2>
    ${tracesHtml || "<p>No traces recorded yet.</p>"}
  </div>

  <script>
    function toggleTrace(index) {
      const trace = document.getElementById('trace-' + index);
      trace.classList.toggle('open');
    }
  </script>
</body>
</html>`;
}

/**
 * Format a trace for console output
 */
export function formatTraceForConsole(trace: Trace): string {
  const lines: string[] = [];
  const hr = "─".repeat(50);

  lines.push(hr);
  lines.push(`Decision: ${trace.decisionId} v${trace.decisionVersion}`);
  lines.push(`Status: ${trace.result.status}`);
  lines.push(`Duration: ${trace.durationMs.toFixed(2)}ms`);
  lines.push(`Time: ${trace.timestamp}`);
  lines.push("");
  lines.push("Rule Evaluation:");

  for (const rule of trace.result.meta.evaluatedRules) {
    const icon = rule.matched ? "✓" : "✗";
    const explain = rule.explanation ? ` — ${rule.explanation}` : "";
    lines.push(`  ${icon} ${rule.ruleId}${explain}`);
  }

  lines.push("");
  lines.push(`Result: ${trace.result.meta.explanation}`);
  lines.push(hr);

  return lines.join("\n");
}
