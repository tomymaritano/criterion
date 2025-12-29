# @criterionx/devtools

Development tools for debugging and visualizing Criterion decision traces.

## Installation

```bash
npm install @criterionx/devtools
# or
pnpm add @criterionx/devtools
```

## Features

- **Trace Collector** - Capture and analyze decision evaluations
- **HTML Report** - Visual trace viewer with rule evaluation details
- **Export** - JSON, HTML, and Markdown export formats
- **Console Formatting** - Pretty-print traces for debugging
- **Statistics** - Summary analytics for collected traces

## Usage

### Collecting Traces

```typescript
import { createCollector } from "@criterionx/devtools";
import { riskDecision } from "./decisions";

const collector = createCollector({
  maxTraces: 1000, // Maximum traces to keep
  autoLog: true,   // Log to console automatically
});

// Use collector.run() instead of engine.run()
const result = collector.run(
  riskDecision,
  { amount: 50000, country: "US" },
  { profile: defaultProfile }
);

// Get the last trace
const trace = collector.getLastTrace();
console.log(trace?.result.status); // "OK"
console.log(trace?.durationMs);    // 0.42
```

### Generating HTML Reports

```typescript
import { createCollector, generateHtmlReport } from "@criterionx/devtools";
import fs from "fs";

const collector = createCollector();

// Run some decisions
collector.run(riskDecision, input1, { profile });
collector.run(riskDecision, input2, { profile });
collector.run(riskDecision, input3, { profile });

// Generate HTML report
const html = generateHtmlReport(
  collector.getTraces(),
  collector.getSummary(),
  {
    title: "Risk Decision Traces",
    darkMode: true,
  }
);

fs.writeFileSync("traces.html", html);
```

### Console Output

```typescript
import { createCollector, formatTraceForConsole } from "@criterionx/devtools";

const collector = createCollector();
collector.run(riskDecision, { amount: 100, country: "US" }, { profile });

const trace = collector.getLastTrace()!;
console.log(formatTraceForConsole(trace));

// Output:
// ──────────────────────────────────────────────────
// Decision: transaction-risk v1.0.0
// Status: OK
// Duration: 0.42ms
// Time: 2024-01-15T10:30:00.000Z
//
// Rule Evaluation:
//   ✗ blocked-country
//   ✗ high-amount
//   ✓ default — Default low risk
//
// Result: Default low risk
// ──────────────────────────────────────────────────
```

### Exporting Traces

```typescript
import { createCollector, exportToJson, exportTrace } from "@criterionx/devtools";

const collector = createCollector();
// ... run decisions ...

// Export all traces as JSON
const json = exportToJson(collector.getTraces(), {
  pretty: true,
  includeData: true, // Include input/output data
});

// Export single trace as markdown
const trace = collector.getLastTrace()!;
const markdown = exportTrace(trace, "markdown");
```

### Statistics

```typescript
const collector = createCollector();
// ... run multiple decisions ...

const summary = collector.getSummary();

console.log(summary.totalTraces);     // 150
console.log(summary.avgDurationMs);   // 0.38
console.log(summary.byStatus);        // { OK: 145, NO_MATCH: 5 }
console.log(summary.byRule);          // { "high-risk": 50, "default": 95, ... }
console.log(summary.byDecision);      // { "transaction-risk": 100, ... }
```

## API Reference

### `createCollector(options?)`

Create a new trace collector.

**Options:**
- `maxTraces` - Maximum traces to keep (default: 1000)
- `autoLog` - Log traces to console (default: false)

**Methods:**
- `run(decision, input, options, registry?)` - Run decision and collect trace
- `getTraces()` - Get all collected traces
- `getTracesForDecision(id)` - Filter traces by decision ID
- `getLastTrace()` - Get most recent trace
- `getSummary()` - Get statistics summary
- `clear()` - Clear all traces
- `count` - Number of traces

### `generateHtmlReport(traces, summary, options?)`

Generate an HTML report.

**Options:**
- `title` - Report title (default: "Criterion Trace Viewer")
- `darkMode` - Use dark theme (default: false)

### `formatTraceForConsole(trace)`

Format a trace for console output.

### `exportToJson(traces, options?)`

Export traces as JSON.

**Options:**
- `pretty` - Pretty print (default: true)
- `includeData` - Include input/output (default: true)

### `exportToHtml(traces, summary, options?)`

Export traces as HTML (same as `generateHtmlReport`).

### `exportTrace(trace, format)`

Export single trace as JSON or Markdown.

### `createShareableUrl(traces, summary, options?)`

Create a data URI for sharing (base64 encoded HTML).

## License

MIT
