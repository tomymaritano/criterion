# @criterionx/opentelemetry

OpenTelemetry instrumentation for Criterion decision engine. Add tracing and metrics to your decision evaluations.

## Installation

```bash
npm install @criterionx/opentelemetry @criterionx/core @opentelemetry/api
```

## Quick Start

### Tracing

```typescript
import { createTracedEngine } from '@criterionx/opentelemetry';
import { trace } from '@opentelemetry/api';

// Get tracer from your OpenTelemetry setup
const tracer = trace.getTracer('my-service');

// Create a traced engine
const engine = createTracedEngine({ tracer });

// All evaluations are now traced
const result = engine.run(pricingDecision, input, { profile });
```

### Metrics

```typescript
import { createMeteredEngine, createMetricsRecorder } from '@criterionx/opentelemetry';
import { metrics } from '@opentelemetry/api';

// Get meter from your OpenTelemetry setup
const meter = metrics.getMeter('my-service');

// Create metrics recorder
const recorder = createMetricsRecorder({ meter });

// Create metered engine
const engine = createMeteredEngine({ recorder });

// All evaluations now record metrics
const result = engine.run(pricingDecision, input, { profile });
```

## Tracing API

### createTracedEngine

Create an engine that automatically creates spans for evaluations.

```typescript
import { createTracedEngine } from '@criterionx/opentelemetry';

const engine = createTracedEngine({
  tracer: Tracer;           // OpenTelemetry tracer
  spanNamePrefix?: string;  // Prefix for span names (default: 'criterion')
  recordInput?: boolean;    // Record input as attribute (default: false)
  recordOutput?: boolean;   // Record output as attribute (default: false)
});
```

#### Span Attributes

Each span includes:

| Attribute | Description |
|-----------|-------------|
| `criterion.decision.id` | Decision ID |
| `criterion.decision.version` | Decision version |
| `criterion.result.status` | Result status (OK, INVALID_INPUT, etc.) |
| `criterion.result.matched_rule` | ID of matched rule |
| `criterion.evaluation.duration_ms` | Evaluation duration |

### wrapEngine

Wrap an existing engine with tracing.

```typescript
import { Engine } from '@criterionx/core';
import { wrapEngine } from '@criterionx/opentelemetry';

const baseEngine = new Engine();
const tracedEngine = wrapEngine(baseEngine, { tracer });
```

### Example Trace

```
criterion.evaluate pricing
├── criterion.decision.id: pricing
├── criterion.decision.version: 1.0.0
├── criterion.result.status: OK
├── criterion.result.matched_rule: premium-discount
└── criterion.evaluation.duration_ms: 2.5
```

## Metrics API

### createMetricsRecorder

Create a recorder that tracks decision metrics.

```typescript
import { createMetricsRecorder } from '@criterionx/opentelemetry';

const recorder = createMetricsRecorder({
  meter: Meter;              // OpenTelemetry meter
  prefix?: string;           // Metric name prefix (default: 'criterion')
  histogramBuckets?: number[]; // Custom histogram buckets
});
```

### Recorded Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `criterion.evaluations.total` | Counter | Total evaluations |
| `criterion.evaluations.success` | Counter | Successful evaluations |
| `criterion.evaluations.failure` | Counter | Failed evaluations |
| `criterion.evaluation.duration` | Histogram | Evaluation duration in ms |
| `criterion.rules.evaluated` | Counter | Rules evaluated |
| `criterion.rules.matched` | Counter | Rules matched |

### Metric Attributes

All metrics include:

| Attribute | Description |
|-----------|-------------|
| `decision_id` | Decision ID |
| `decision_version` | Decision version |
| `status` | Result status |
| `matched_rule` | Matched rule ID (if any) |

### createMeteredEngine

Create an engine that records metrics automatically.

```typescript
import { createMeteredEngine } from '@criterionx/opentelemetry';

const engine = createMeteredEngine({
  recorder: MetricsRecorder;  // From createMetricsRecorder
  engine?: Engine;            // Optional base engine
});
```

## Full Setup Example

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { trace, metrics } from '@opentelemetry/api';
import { createTracedEngine, createMeteredEngine, createMetricsRecorder } from '@criterionx/opentelemetry';

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces'
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics'
    })
  })
});

sdk.start();

// Create instrumented engine
const tracer = trace.getTracer('my-decision-service');
const meter = metrics.getMeter('my-decision-service');

const recorder = createMetricsRecorder({ meter });

const engine = createTracedEngine({
  tracer,
  recordInput: true,  // Include input in traces (careful with PII)
});

// Use engine normally
const result = engine.run(pricingDecision, input, { profile });
```

## Integration with @criterionx/server

```typescript
import { createServer } from '@criterionx/server';
import { createTracedEngine, createMetricsRecorder } from '@criterionx/opentelemetry';

const engine = createTracedEngine({ tracer });
const recorder = createMetricsRecorder({ meter });

const server = createServer({
  decisions: [pricingDecision],
  profiles: { pricing: { basePrice: 100 } },
  engine,
  hooks: {
    afterEvaluate: (result, decision) => {
      recorder.record(result, decision);
    }
  }
});
```

## Grafana Dashboard Example

Query for decision success rate:

```promql
sum(rate(criterion_evaluations_success_total[5m])) by (decision_id)
/
sum(rate(criterion_evaluations_total[5m])) by (decision_id)
```

Query for p99 evaluation latency:

```promql
histogram_quantile(0.99,
  sum(rate(criterion_evaluation_duration_bucket[5m])) by (le, decision_id)
)
```

## Best Practices

1. **Don't record sensitive input/output** - Use `recordInput: false` and `recordOutput: false` for decisions with PII
2. **Use appropriate histogram buckets** - Adjust based on your evaluation latency profile
3. **Add custom attributes** - Extend spans with business context
4. **Set up alerts** - Monitor for high failure rates or latency spikes

```typescript
// Adding custom attributes
const tracedEngine = createTracedEngine({
  tracer,
  onSpanStart: (span, decision, input) => {
    span.setAttribute('tenant.id', input.tenantId);
    span.setAttribute('request.id', input.requestId);
  }
});
```
