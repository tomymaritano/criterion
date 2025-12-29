import { describe, it, expect, beforeEach } from "vitest";
import {
  MetricsCollector,
  METRIC_EVALUATIONS_TOTAL,
  METRIC_EVALUATION_DURATION_SECONDS,
  METRIC_RULE_MATCHES_TOTAL,
} from "./metrics.js";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("increment", () => {
    it("should increment a counter", () => {
      collector.increment("test_counter");
      expect(collector.getCounter("test_counter")).toBe(1);

      collector.increment("test_counter");
      expect(collector.getCounter("test_counter")).toBe(2);
    });

    it("should increment a counter with labels", () => {
      collector.increment("test_counter", { status: "OK" });
      collector.increment("test_counter", { status: "OK" });
      collector.increment("test_counter", { status: "ERROR" });

      expect(collector.getCounter("test_counter", { status: "OK" })).toBe(2);
      expect(collector.getCounter("test_counter", { status: "ERROR" })).toBe(1);
    });

    it("should increment by a custom value", () => {
      collector.increment("test_counter", {}, 5);
      expect(collector.getCounter("test_counter")).toBe(5);
    });
  });

  describe("observe", () => {
    it("should observe values in a histogram", () => {
      collector.observe("test_histogram", { decision_id: "test" }, 0.05);
      collector.observe("test_histogram", { decision_id: "test" }, 0.1);
      collector.observe("test_histogram", { decision_id: "test" }, 0.2);

      const stats = collector.getHistogram("test_histogram", { decision_id: "test" });
      expect(stats).toBeDefined();
      expect(stats!.count).toBe(3);
      expect(stats!.sum).toBeCloseTo(0.35);
    });

    it("should return undefined for non-existent histogram", () => {
      const stats = collector.getHistogram("non_existent", {});
      expect(stats).toBeUndefined();
    });
  });

  describe("toPrometheus", () => {
    it("should output counter in Prometheus format", () => {
      collector.increment(METRIC_EVALUATIONS_TOTAL, { decision_id: "test", status: "OK" });
      collector.increment(METRIC_EVALUATIONS_TOTAL, { decision_id: "test", status: "OK" });

      const output = collector.toPrometheus();
      expect(output).toContain(`# TYPE ${METRIC_EVALUATIONS_TOTAL} counter`);
      expect(output).toContain(`${METRIC_EVALUATIONS_TOTAL}{decision_id="test",status="OK"} 2`);
    });

    it("should output histogram in Prometheus format", () => {
      collector.observe(METRIC_EVALUATION_DURATION_SECONDS, { decision_id: "test" }, 0.05);

      const output = collector.toPrometheus();
      expect(output).toContain(`# TYPE ${METRIC_EVALUATION_DURATION_SECONDS} histogram`);
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_bucket`);
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_sum`);
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_count`);
    });

    it("should output histogram buckets correctly", () => {
      // Value of 0.05 should be in bucket 0.05 and above
      collector.observe(METRIC_EVALUATION_DURATION_SECONDS, { decision_id: "test" }, 0.05);

      const output = collector.toPrometheus();

      // Check cumulative bucket values
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_bucket{decision_id="test",le="0.001"} 0`);
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_bucket{decision_id="test",le="0.05"} 1`);
      expect(output).toContain(`${METRIC_EVALUATION_DURATION_SECONDS}_bucket{decision_id="test",le="+Inf"} 1`);
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      collector.increment("test_counter", { label: "value" });
      collector.observe("test_histogram", {}, 0.1);

      collector.reset();

      expect(collector.getCounter("test_counter", { label: "value" })).toBe(0);
      expect(collector.getHistogram("test_histogram", {})).toBeUndefined();
    });
  });

  describe("custom buckets", () => {
    it("should support custom histogram buckets", () => {
      const customCollector = new MetricsCollector({
        buckets: [0.1, 0.5, 1.0],
      });

      customCollector.observe("test", {}, 0.3);
      const output = customCollector.toPrometheus();

      expect(output).toContain('le="0.1"');
      expect(output).toContain('le="0.5"');
      expect(output).toContain('le="1"');
      expect(output).not.toContain('le="0.001"'); // Default bucket not present
    });
  });
});

describe("Metric name constants", () => {
  it("should have correct metric names", () => {
    expect(METRIC_EVALUATIONS_TOTAL).toBe("criterion_evaluations_total");
    expect(METRIC_EVALUATION_DURATION_SECONDS).toBe("criterion_evaluation_duration_seconds");
    expect(METRIC_RULE_MATCHES_TOTAL).toBe("criterion_rule_matches_total");
  });
});
