# Express REST API

Build a production-ready REST API with Criterion for loan eligibility decisions.

## Overview

This example demonstrates:
- Express middleware integration
- OpenTelemetry observability
- Multiple decision endpoints
- Error handling and validation

## Project Setup

```bash
mkdir criterion-api && cd criterion-api
npm init -y
npm install express @criterionx/core @criterionx/express @criterionx/opentelemetry zod
npm install -D typescript @types/express @types/node tsx
```

## Define Decisions

```typescript
// src/decisions/loan-eligibility.ts
import { defineDecision, createRule } from '@criterionx/core';
import { z } from 'zod';

export const loanEligibilityDecision = defineDecision({
  id: 'loan-eligibility',
  version: '1.0.0',
  inputSchema: z.object({
    applicantAge: z.number().min(18).max(100),
    annualIncome: z.number().positive(),
    creditScore: z.number().min(300).max(850),
    existingDebt: z.number().min(0),
    loanAmount: z.number().positive(),
    loanTermMonths: z.number().min(12).max(360),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    maxAmount: z.number(),
    interestRate: z.number(),
    monthlyPayment: z.number(),
    reason: z.string(),
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  }),
  profileSchema: z.object({
    minCreditScore: z.number(),
    maxDtiRatio: z.number(),
    baseRate: z.number(),
    riskPremium: z.object({
      low: z.number(),
      medium: z.number(),
      high: z.number(),
    }),
  }),
  rules: [
    createRule({
      id: 'reject-low-credit',
      when: (input, profile) => input.creditScore < profile.minCreditScore,
      emit: (input) => ({
        approved: false,
        maxAmount: 0,
        interestRate: 0,
        monthlyPayment: 0,
        reason: `Credit score ${input.creditScore} below minimum requirement`,
        riskLevel: 'HIGH' as const,
      }),
      explain: () => 'Credit score below minimum threshold',
    }),
    createRule({
      id: 'reject-high-dti',
      when: (input, profile) => {
        const monthlyIncome = input.annualIncome / 12;
        const dti = input.existingDebt / monthlyIncome;
        return dti > profile.maxDtiRatio;
      },
      emit: (input) => ({
        approved: false,
        maxAmount: 0,
        interestRate: 0,
        monthlyPayment: 0,
        reason: 'Debt-to-income ratio too high',
        riskLevel: 'HIGH' as const,
      }),
      explain: () => 'Debt-to-income ratio exceeds maximum',
    }),
    createRule({
      id: 'approve-excellent',
      when: (input) => input.creditScore >= 750,
      emit: (input, profile) => {
        const rate = profile.baseRate + profile.riskPremium.low;
        const monthlyRate = rate / 12;
        const payment = (input.loanAmount * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -input.loanTermMonths));
        return {
          approved: true,
          maxAmount: input.annualIncome * 5,
          interestRate: rate,
          monthlyPayment: Math.round(payment * 100) / 100,
          reason: 'Excellent credit profile',
          riskLevel: 'LOW' as const,
        };
      },
      explain: () => 'Approved with excellent credit terms',
    }),
    createRule({
      id: 'approve-good',
      when: (input) => input.creditScore >= 670,
      emit: (input, profile) => {
        const rate = profile.baseRate + profile.riskPremium.medium;
        const monthlyRate = rate / 12;
        const payment = (input.loanAmount * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -input.loanTermMonths));
        return {
          approved: true,
          maxAmount: input.annualIncome * 3,
          interestRate: rate,
          monthlyPayment: Math.round(payment * 100) / 100,
          reason: 'Good credit profile',
          riskLevel: 'MEDIUM' as const,
        };
      },
      explain: () => 'Approved with standard terms',
    }),
    createRule({
      id: 'approve-fair',
      when: () => true,
      emit: (input, profile) => {
        const rate = profile.baseRate + profile.riskPremium.high;
        const monthlyRate = rate / 12;
        const payment = (input.loanAmount * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -input.loanTermMonths));
        return {
          approved: true,
          maxAmount: input.annualIncome * 2,
          interestRate: rate,
          monthlyPayment: Math.round(payment * 100) / 100,
          reason: 'Fair credit - higher rate applies',
          riskLevel: 'HIGH' as const,
        };
      },
      explain: () => 'Approved with elevated risk terms',
    }),
  ],
});
```

## Setup Express Server

```typescript
// src/index.ts
import express from 'express';
import { createDecisionRouter } from '@criterionx/express';
import { loanEligibilityDecision } from './decisions/loan-eligibility';

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Decision endpoints
app.use('/api/v1/decisions', createDecisionRouter({
  decisions: [loanEligibilityDecision],
  profiles: {
    'loan-eligibility': {
      minCreditScore: 580,
      maxDtiRatio: 0.43,
      baseRate: 0.05,
      riskPremium: {
        low: 0.01,
        medium: 0.03,
        high: 0.06,
      },
    },
  },
}));

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Add Observability

```typescript
// src/index.ts (with OpenTelemetry)
import express from 'express';
import { createDecisionMiddleware } from '@criterionx/express';
import { createTracedEngine, createMetricsRecorder } from '@criterionx/opentelemetry';
import { trace, metrics } from '@opentelemetry/api';
import { loanEligibilityDecision } from './decisions/loan-eligibility';

// Setup tracing
const tracer = trace.getTracer('loan-service');
const meter = metrics.getMeter('loan-service');

const tracedEngine = createTracedEngine({
  tracer,
  recordInput: false, // Don't log PII
});

const metricsRecorder = createMetricsRecorder({ meter });

const app = express();
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Loan eligibility endpoint with tracing
app.post('/api/v1/loans/check-eligibility',
  createDecisionMiddleware({
    decision: loanEligibilityDecision,
    profile: {
      minCreditScore: 580,
      maxDtiRatio: 0.43,
      baseRate: 0.05,
      riskPremium: { low: 0.01, medium: 0.03, high: 0.06 },
    },
    engine: tracedEngine,
    onResult: (result, req, res) => {
      // Record metrics
      metricsRecorder.record(result, loanEligibilityDecision);

      // Add custom logging
      if (result.status === 'OK') {
        console.log(`Loan decision: ${result.data?.approved ? 'APPROVED' : 'DENIED'}`);
      }
    },
  })
);

app.listen(3000);
```

## API Usage

### Check Loan Eligibility

```bash
curl -X POST http://localhost:3000/api/v1/loans/check-eligibility \
  -H "Content-Type: application/json" \
  -d '{
    "applicantAge": 35,
    "annualIncome": 85000,
    "creditScore": 720,
    "existingDebt": 500,
    "loanAmount": 250000,
    "loanTermMonths": 360
  }'
```

### Response (Approved)

```json
{
  "status": "OK",
  "data": {
    "approved": true,
    "maxAmount": 255000,
    "interestRate": 0.08,
    "monthlyPayment": 1834.41,
    "reason": "Good credit profile",
    "riskLevel": "MEDIUM"
  },
  "meta": {
    "decisionId": "loan-eligibility",
    "decisionVersion": "1.0.0",
    "matchedRule": "approve-good",
    "explanation": "Approved with standard terms",
    "evaluatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Response (Denied)

```json
{
  "status": "OK",
  "data": {
    "approved": false,
    "maxAmount": 0,
    "interestRate": 0,
    "monthlyPayment": 0,
    "reason": "Credit score 520 below minimum requirement",
    "riskLevel": "HIGH"
  },
  "meta": {
    "decisionId": "loan-eligibility",
    "matchedRule": "reject-low-credit",
    "explanation": "Credit score below minimum threshold"
  }
}
```

### Validation Error

```json
{
  "status": "INVALID_INPUT",
  "message": "Input validation failed: creditScore must be at least 300",
  "meta": {
    "decisionId": "loan-eligibility",
    "evaluatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

## Docker Deployment

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP
```

## Testing

```typescript
// src/decisions/loan-eligibility.test.ts
import { describe, it, expect } from 'vitest';
import { Engine } from '@criterionx/core';
import { loanEligibilityDecision } from './loan-eligibility';

const engine = new Engine();
const profile = {
  minCreditScore: 580,
  maxDtiRatio: 0.43,
  baseRate: 0.05,
  riskPremium: { low: 0.01, medium: 0.03, high: 0.06 },
};

describe('Loan Eligibility', () => {
  it('should approve excellent credit', () => {
    const result = engine.run(loanEligibilityDecision, {
      applicantAge: 35,
      annualIncome: 100000,
      creditScore: 780,
      existingDebt: 500,
      loanAmount: 300000,
      loanTermMonths: 360,
    }, { profile });

    expect(result.data?.approved).toBe(true);
    expect(result.data?.riskLevel).toBe('LOW');
  });

  it('should reject low credit score', () => {
    const result = engine.run(loanEligibilityDecision, {
      applicantAge: 35,
      annualIncome: 100000,
      creditScore: 520,
      existingDebt: 0,
      loanAmount: 50000,
      loanTermMonths: 60,
    }, { profile });

    expect(result.data?.approved).toBe(false);
    expect(result.meta?.matchedRule).toBe('reject-low-credit');
  });
});
```
