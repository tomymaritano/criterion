import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { defineDecision } from "@criterionx/core";
import {
  TraceCollector,
  createCollector,
  generateHtmlReport,
  formatTraceForConsole,
  exportToJson,
  exportToHtml,
  exportTrace,
} from "./index.js";

// Sample decision for testing
const riskDecision = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
  }),
  outputSchema: z.object({
    risk: z.enum(["low", "medium", "high"]),
    score: z.number(),
  }),
  profileSchema: z.object({
    threshold: z.number(),
    blockedCountries: z.array(z.string()),
  }),
  rules: [
    {
      id: "blocked-country",
      when: (ctx, profile) => profile.blockedCountries.includes(ctx.country),
      emit: () => ({ risk: "high" as const, score: 100 }),
      explain: (ctx) => `Country ${ctx.country} is blocked`,
    },
    {
      id: "high-amount",
      when: (ctx, profile) => ctx.amount > profile.threshold,
      emit: (ctx, profile) => ({
        risk: "high" as const,
        score: Math.min(100, (ctx.amount / profile.threshold) * 50),
      }),
      explain: (ctx, profile) =>
        `Amount ${ctx.amount} exceeds threshold ${profile.threshold}`,
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ risk: "low" as const, score: 0 }),
      explain: () => "Default low risk",
    },
  ],
});

const defaultProfile = {
  threshold: 10000,
  blockedCountries: ["NK", "IR"],
};

describe("TraceCollector", () => {
  let collector: TraceCollector;

  beforeEach(() => {
    collector = createCollector();
  });

  it("should collect traces from decision runs", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    expect(collector.count).toBe(1);

    const trace = collector.getLastTrace();
    expect(trace).toBeDefined();
    expect(trace?.decisionId).toBe("transaction-risk");
    expect(trace?.result.status).toBe("OK");
  });

  it("should track multiple traces", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });
    collector.run(riskDecision, { amount: 50000, country: "US" }, { profile: defaultProfile });
    collector.run(riskDecision, { amount: 100, country: "NK" }, { profile: defaultProfile });

    expect(collector.count).toBe(3);

    const traces = collector.getTraces();
    expect(traces).toHaveLength(3);
  });

  it("should respect maxTraces limit", () => {
    const limitedCollector = createCollector({ maxTraces: 2 });

    limitedCollector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });
    limitedCollector.run(riskDecision, { amount: 200, country: "US" }, { profile: defaultProfile });
    limitedCollector.run(riskDecision, { amount: 300, country: "US" }, { profile: defaultProfile });

    expect(limitedCollector.count).toBe(2);

    const traces = limitedCollector.getTraces();
    // Should keep the most recent ones
    expect(traces[0].input).toEqual({ amount: 200, country: "US" });
    expect(traces[1].input).toEqual({ amount: 300, country: "US" });
  });

  it("should filter traces by decision", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });
    collector.run(riskDecision, { amount: 200, country: "US" }, { profile: defaultProfile });

    const traces = collector.getTracesForDecision("transaction-risk");
    expect(traces).toHaveLength(2);

    const nonExistent = collector.getTracesForDecision("non-existent");
    expect(nonExistent).toHaveLength(0);
  });

  it("should provide summary statistics", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });
    collector.run(riskDecision, { amount: 50000, country: "US" }, { profile: defaultProfile });
    collector.run(riskDecision, { amount: 100, country: "NK" }, { profile: defaultProfile });

    const summary = collector.getSummary();

    expect(summary.totalTraces).toBe(3);
    expect(summary.byDecision["transaction-risk"]).toBe(3);
    expect(summary.byStatus["OK"]).toBe(3);
    expect(summary.byRule["default"]).toBe(1);
    expect(summary.byRule["high-amount"]).toBe(1);
    expect(summary.byRule["blocked-country"]).toBe(1);
    expect(summary.avgDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("should clear traces", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });
    expect(collector.count).toBe(1);

    collector.clear();
    expect(collector.count).toBe(0);
  });

  it("should track duration", () => {
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const trace = collector.getLastTrace();
    expect(trace?.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("generateHtmlReport", () => {
  it("should generate valid HTML", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const html = generateHtmlReport(collector.getTraces(), collector.getSummary());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Criterion Trace Viewer");
    expect(html).toContain("transaction-risk");
    expect(html).toContain("OK");
  });

  it("should support dark mode", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const html = generateHtmlReport(collector.getTraces(), collector.getSummary(), {
      darkMode: true,
    });

    expect(html).toContain("#1a1a2e"); // Dark mode background
  });

  it("should support custom title", () => {
    const collector = createCollector();

    const html = generateHtmlReport(collector.getTraces(), collector.getSummary(), {
      title: "My Custom Report",
    });

    expect(html).toContain("My Custom Report");
  });
});

describe("formatTraceForConsole", () => {
  it("should format trace for console output", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const trace = collector.getLastTrace()!;
    const formatted = formatTraceForConsole(trace);

    expect(formatted).toContain("Decision: transaction-risk");
    expect(formatted).toContain("Status: OK");
    expect(formatted).toContain("Rule Evaluation:");
    expect(formatted).toContain("✓ default");
  });
});

describe("exportToJson", () => {
  it("should export traces as JSON", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const json = exportToJson(collector.getTraces());
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].decisionId).toBe("transaction-risk");
  });

  it("should support minimal export without data", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const json = exportToJson(collector.getTraces(), { includeData: false });
    const parsed = JSON.parse(json);

    expect(parsed[0].input).toBeUndefined();
    expect(parsed[0].decisionId).toBe("transaction-risk");
    expect(parsed[0].status).toBe("OK");
  });
});

describe("exportToHtml", () => {
  it("should export traces as HTML", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const html = exportToHtml(collector.getTraces(), collector.getSummary());

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("transaction-risk");
  });
});

describe("exportTrace", () => {
  it("should export single trace as JSON", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const trace = collector.getLastTrace()!;
    const json = exportTrace(trace, "json");
    const parsed = JSON.parse(json);

    expect(parsed.decisionId).toBe("transaction-risk");
  });

  it("should export single trace as markdown", () => {
    const collector = createCollector();
    collector.run(riskDecision, { amount: 100, country: "US" }, { profile: defaultProfile });

    const trace = collector.getLastTrace()!;
    const markdown = exportTrace(trace, "markdown");

    expect(markdown).toContain("# Trace: transaction-risk");
    expect(markdown).toContain("## Rule Evaluation");
    expect(markdown).toContain("| Rule | Matched | Explanation |");
  });
});
