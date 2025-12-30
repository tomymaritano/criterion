import { describe, it, expect, vi } from "vitest";
import { defineDecision, Engine } from "@criterionx/core";
import { z } from "zod";
import { createMetricsRecorder, createMeteredEngine } from "./metrics.js";

// Test decision
const testDecision = defineDecision({
  id: "metrics-test",
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

describe("createMetricsRecorder", () => {
  it("should create a metrics recorder", () => {
    const recorder = createMetricsRecorder();
    expect(recorder).toBeDefined();
    expect(typeof recorder.recordEvaluation).toBe("function");
  });

  it("should record evaluation without errors", () => {
    const recorder = createMetricsRecorder();
    const engine = new Engine();

    const result = engine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    // Should not throw
    expect(() => {
      recorder.recordEvaluation(testDecision, result, 5.5);
    }).not.toThrow();
  });

  it("should record successful evaluation metrics", () => {
    // Create mock meter
    const mockCounter = { add: vi.fn() };
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createCounter: vi.fn(() => mockCounter),
      createHistogram: vi.fn(() => mockHistogram),
    };

    const recorder = createMetricsRecorder({
      // @ts-expect-error - using mock
      meter: mockMeter,
    });

    const engine = new Engine();
    const result = engine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    recorder.recordEvaluation(testDecision, result, 5.5);

    // Should have recorded evaluation count
    expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
      decision_id: "metrics-test",
      status: "OK",
    }));

    // Should have recorded duration
    expect(mockHistogram.record).toHaveBeenCalledWith(5.5, expect.objectContaining({
      decision_id: "metrics-test",
    }));
  });

  it("should record error metrics for failed evaluations", () => {
    const mockCounter = { add: vi.fn() };
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createCounter: vi.fn(() => mockCounter),
      createHistogram: vi.fn(() => mockHistogram),
    };

    const recorder = createMetricsRecorder({
      // @ts-expect-error - using mock
      meter: mockMeter,
    });

    const engine = new Engine();
    const result = engine.run(
      testDecision,
      { value: "invalid" as unknown as number },
      { profile: { threshold: 10 } }
    );

    recorder.recordEvaluation(testDecision, result, 2.0);

    // Should have recorded error counter
    expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
      decision_id: "metrics-test",
      error_type: "INVALID_INPUT",
    }));
  });

  it("should record matched rule metrics", () => {
    const mockCounter = { add: vi.fn() };
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createCounter: vi.fn(() => mockCounter),
      createHistogram: vi.fn(() => mockHistogram),
    };

    const recorder = createMetricsRecorder({
      // @ts-expect-error - using mock
      meter: mockMeter,
    });

    const engine = new Engine();
    const result = engine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    recorder.recordEvaluation(testDecision, result, 3.0);

    // Should have recorded rule match
    expect(mockCounter.add).toHaveBeenCalledWith(1, expect.objectContaining({
      decision_id: "metrics-test",
      rule_id: "above",
    }));
  });
});

describe("createMeteredEngine", () => {
  it("should create a metered engine", () => {
    const engine = createMeteredEngine();
    expect(engine).toBeDefined();
    expect(typeof engine.run).toBe("function");
  });

  it("should evaluate decisions correctly", () => {
    const engine = createMeteredEngine();

    const result = engine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    expect(result.status).toBe("OK");
    expect(result.data?.result).toBe("ABOVE");
  });

  it("should automatically record metrics", () => {
    const mockCounter = { add: vi.fn() };
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createCounter: vi.fn(() => mockCounter),
      createHistogram: vi.fn(() => mockHistogram),
    };

    const engine = createMeteredEngine({
      // @ts-expect-error - using mock
      meter: mockMeter,
    });

    engine.run(
      testDecision,
      { value: 50 },
      { profile: { threshold: 10 } }
    );

    // Should have recorded metrics automatically
    expect(mockCounter.add).toHaveBeenCalled();
    expect(mockHistogram.record).toHaveBeenCalled();
  });
});
