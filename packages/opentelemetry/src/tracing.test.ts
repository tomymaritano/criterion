import { describe, it, expect, beforeEach } from "vitest";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { defineDecision, Engine } from "@criterionx/core";
import { z } from "zod";
import { createTracedEngine, wrapEngine } from "./tracing.js";

// Test decision
const testDecision = defineDecision({
  id: "otel-test",
  version: "1.0.0",
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.string() }),
  profileSchema: z.object({ threshold: z.number() }),
  rules: [
    {
      id: "above",
      when: (input, profile) => input.value > profile.threshold,
      emit: () => ({ result: "ABOVE" }),
      explain: () => "Value is above threshold",
    },
    {
      id: "below",
      when: () => true,
      emit: () => ({ result: "BELOW" }),
      explain: () => "Default: below threshold",
    },
  ],
});

describe("createTracedEngine", () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  it("should create a traced engine", () => {
    const tracedEngine = createTracedEngine();
    expect(tracedEngine).toBeDefined();
    expect(typeof tracedEngine.run).toBe("function");
    expect(typeof tracedEngine.getEngine).toBe("function");
  });

  it("should evaluate decisions correctly", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
    });

    const result = tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("ABOVE");
  });

  it("should create spans with decision attributes", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);

    const span = spans[0];
    expect(span.name).toBe("criterion.otel-test");
    expect(span.attributes["criterion.decision.id"]).toBe("otel-test");
    expect(span.attributes["criterion.decision.version"]).toBe("1.0.0");
    expect(span.attributes["criterion.status"]).toBe("OK");
    expect(span.attributes["criterion.matched_rule"]).toBe("above");
    expect(span.attributes["criterion.rules_evaluated"]).toBe(1);
  });

  it("should record input when enabled", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
      recordInput: true,
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    const span = spans[0];
    expect(span.attributes["criterion.input"]).toBe('{"value":50}');
  });

  it("should record output when enabled", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
      recordOutput: true,
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    const span = spans[0];
    expect(span.attributes["criterion.output"]).toBe('{"result":"ABOVE"}');
  });

  it("should record profile when enabled", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
      recordProfile: true,
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    const span = spans[0];
    expect(span.attributes["criterion.profile"]).toBe('{"threshold":10}');
  });

  it("should use custom span name prefix", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
      spanNamePrefix: "decisions",
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    expect(spans[0].name).toBe("decisions.otel-test");
  });

  it("should set error status for failed evaluations", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
    });

    const result = tracedEngine.run(
      testDecision,
      { value: "invalid" as unknown as number },
      { profile: { threshold: 10 } }
    );

    expect(result.status).toBe("INVALID_INPUT");

    const spans = exporter.getFinishedSpans();
    const span = spans[0];
    expect(span.status.code).toBe(SpanStatusCode.ERROR);
    expect(span.attributes["criterion.status"]).toBe("INVALID_INPUT");
    expect(span.attributes["criterion.error"]).toBeDefined();
  });

  it("should record duration", () => {
    const tracedEngine = createTracedEngine({
      tracer: provider.getTracer("test"),
    });

    tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    const spans = exporter.getFinishedSpans();
    const span = spans[0];
    expect(span.attributes["criterion.duration_ms"]).toBeDefined();
    expect(typeof span.attributes["criterion.duration_ms"]).toBe("number");
  });
});

describe("wrapEngine", () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    provider.register();
  });

  it("should wrap an existing engine", () => {
    const engine = new Engine();
    const tracedEngine = wrapEngine(engine, {
      tracer: provider.getTracer("test"),
    });

    expect(tracedEngine).toBeDefined();
    expect(tracedEngine.getEngine()).toBe(engine);
  });

  it("should trace evaluations on wrapped engine", () => {
    const engine = new Engine();
    const tracedEngine = wrapEngine(engine, {
      tracer: provider.getTracer("test"),
    });

    const result = tracedEngine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    expect(result.status).toBe("OK");

    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBe(1);
    expect(spans[0].attributes["criterion.decision.id"]).toBe("otel-test");
  });
});
