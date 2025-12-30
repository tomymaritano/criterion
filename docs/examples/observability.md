# Observability Example

Monitor your decisions in production with OpenTelemetry tracing and Prometheus metrics.

## Overview

This example shows how to:
- Add distributed tracing to decision evaluation
- Export metrics to Prometheus
- View traces in Jaeger
- Set up alerting on decision latency

## Setup

```bash
npm install @criterionx/core @criterionx/opentelemetry \
  @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-prometheus
```

## Traced Engine

```typescript
// engine.ts
import { defineDecision } from "@criterionx/core";
import {
  createTracedEngine,
  createMetricsRecorder,
} from "@criterionx/opentelemetry";
import { z } from "zod";

// Define your decision
const fraudCheck = defineDecision({
  id: "fraud-check",
  version: "2.1.0",
  inputSchema: z.object({
    amount: z.number(),
    country: z.string(),
    userId: z.string(),
  }),
  outputSchema: z.object({
    risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
    block: z.boolean(),
  }),
  profileSchema: z.object({
    highRiskThreshold: z.number(),
    blockedCountries: z.array(z.string()),
  }),
  rules: [
    {
      id: "blocked-country",
      when: (input, profile) =>
        profile.blockedCountries.includes(input.country),
      emit: () => ({ risk: "HIGH", block: true }),
      explain: (input) => `Country ${input.country} is blocked`,
    },
    {
      id: "high-amount",
      when: (input, profile) => input.amount > profile.highRiskThreshold,
      emit: () => ({ risk: "HIGH", block: false }),
      explain: (input, profile) =>
        `Amount ${input.amount} > threshold ${profile.highRiskThreshold}`,
    },
    {
      id: "default",
      when: () => true,
      emit: () => ({ risk: "LOW", block: false }),
      explain: () => "Transaction within normal parameters",
    },
  ],
});

// Create traced engine
const engine = createTracedEngine({
  serviceName: "payment-service",
  serviceVersion: "1.0.0",
});

// Create metrics recorder
const metrics = createMetricsRecorder({
  prefix: "criterion",
});

// Evaluate with tracing + metrics
export function evaluateFraud(input: {
  amount: number;
  country: string;
  userId: string;
}) {
  const profile = {
    highRiskThreshold: 10000,
    blockedCountries: ["XX", "YY"],
  };

  const result = engine.run(fraudCheck, input, { profile });

  // Record metrics
  metrics.record(result);

  return result;
}
```

## OpenTelemetry Configuration

```typescript
// tracing.ts
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";

const sdk = new NodeSDK({
  serviceName: "payment-service",
  traceExporter: new OTLPTraceExporter({
    url: "http://localhost:4318/v1/traces",
  }),
  metricReader: new PrometheusExporter({
    port: 9464,
  }),
});

sdk.start();

// Graceful shutdown
process.on("SIGTERM", () => {
  sdk.shutdown();
});
```

## Server with Tracing

```typescript
// server.ts
import "./tracing"; // Initialize OpenTelemetry first
import { createServer } from "@criterionx/server";
import { fraudCheck } from "./engine";

const server = createServer({
  decisions: [fraudCheck],
  profiles: {
    "fraud-check": {
      highRiskThreshold: 10000,
      blockedCountries: ["XX", "YY"],
    },
  },
  opentelemetry: {
    enabled: true,
    serviceName: "payment-service",
  },
  logging: {
    enabled: true,
    level: "info",
  },
});

server.listen(3000);
```

## Span Attributes

Each decision evaluation creates a span with these attributes:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `criterion.decision.id` | Decision identifier | `"fraud-check"` |
| `criterion.decision.version` | Decision version | `"2.1.0"` |
| `criterion.status` | Evaluation status | `"OK"` or `"ERROR"` |
| `criterion.matched_rule` | Which rule matched | `"high-amount"` |
| `criterion.rules_evaluated` | Number of rules checked | `2` |

## Prometheus Metrics

Metrics exported at `/metrics` (port 9464):

```promql
# Decision evaluation counter
criterion_decisions_total{decision="fraud-check", status="OK", rule="high-amount"}

# Evaluation latency histogram
criterion_decision_duration_seconds_bucket{decision="fraud-check", le="0.001"}
criterion_decision_duration_seconds_bucket{decision="fraud-check", le="0.005"}
criterion_decision_duration_seconds_bucket{decision="fraud-check", le="0.01"}

# Active evaluations gauge
criterion_decisions_active{decision="fraud-check"}
```

## Grafana Dashboard

```json
{
  "panels": [
    {
      "title": "Decision Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(criterion_decisions_total[5m])",
          "legendFormat": "{{decision}} - {{rule}}"
        }
      ]
    },
    {
      "title": "P99 Latency",
      "type": "stat",
      "targets": [
        {
          "expr": "histogram_quantile(0.99, rate(criterion_decision_duration_seconds_bucket[5m]))"
        }
      ]
    },
    {
      "title": "Error Rate",
      "type": "graph",
      "targets": [
        {
          "expr": "rate(criterion_decisions_total{status=\"ERROR\"}[5m]) / rate(criterion_decisions_total[5m])"
        }
      ]
    }
  ]
}
```

## Alerting Rules

```yaml
# prometheus-alerts.yml
groups:
  - name: criterion
    rules:
      - alert: HighDecisionLatency
        expr: |
          histogram_quantile(0.99,
            rate(criterion_decision_duration_seconds_bucket[5m])
          ) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Decision latency is high"
          description: "P99 latency > 100ms for {{ $labels.decision }}"

      - alert: HighBlockRate
        expr: |
          rate(criterion_decisions_total{rule="blocked-country"}[5m])
          / rate(criterion_decisions_total{decision="fraud-check"}[5m])
          > 0.1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High block rate detected"
          description: "More than 10% of transactions being blocked"
```

## Docker Compose

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
      - "9464:9464"
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://jaeger:4318

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    volumes:
      - ./grafana:/etc/grafana/provisioning
```

## Jaeger Traces

View traces at `http://localhost:16686`:

```
payment-service: POST /decisions/fraud-check
├── criterion.evaluate: fraud-check v2.1.0
│   ├── criterion.rule.evaluate: blocked-country (skip)
│   ├── criterion.rule.evaluate: high-amount (match)
│   └── criterion.matched_rule: high-amount
└── http.response: 200 OK
```

## Custom Span Enrichment

Add business context to spans:

```typescript
import { trace } from "@opentelemetry/api";

function evaluateWithContext(input: FraudInput) {
  const span = trace.getActiveSpan();

  // Add business context
  span?.setAttributes({
    "user.id": input.userId,
    "transaction.amount": input.amount,
    "transaction.currency": "USD",
  });

  const result = engine.run(fraudCheck, input, { profile });

  // Add result context
  span?.setAttributes({
    "fraud.risk_level": result.data.risk,
    "fraud.blocked": result.data.block,
  });

  return result;
}
```

## Best Practices

1. **Sample high-volume decisions** — Use head-based sampling for high-throughput endpoints
2. **Add business context** — Include user IDs, transaction IDs for correlation
3. **Monitor rule distribution** — Track which rules fire most often
4. **Alert on anomalies** — Sudden changes in rule distribution may indicate issues
5. **Use baggage** — Propagate context across service boundaries
