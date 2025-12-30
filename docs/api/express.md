# @criterionx/express

Express and Fastify middleware for Criterion decision engine.

## Installation

```bash
npm install @criterionx/express @criterionx/core
```

## Express Integration

### Quick Start

```typescript
import express from 'express';
import { createDecisionRouter } from '@criterionx/express';
import { pricingDecision, eligibilityDecision } from './decisions';

const app = express();
app.use(express.json());

// Mount decisions as REST endpoints
app.use('/api/decisions', createDecisionRouter({
  decisions: [pricingDecision, eligibilityDecision],
  profiles: {
    pricing: { basePrice: 100, discountRate: 0.1 },
    eligibility: { minAge: 18 }
  }
}));

app.listen(3000);
```

This creates endpoints:
- `POST /api/decisions/pricing` - Evaluate pricing decision
- `POST /api/decisions/eligibility` - Evaluate eligibility decision

### createDecisionMiddleware

Create middleware for a single decision.

```typescript
import { createDecisionMiddleware } from '@criterionx/express';

const pricingMiddleware = createDecisionMiddleware({
  decision: pricingDecision,
  profile: { basePrice: 100 }
});

app.post('/api/calculate-price', pricingMiddleware);
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `decision` | `Decision` | The decision to evaluate |
| `profile` | `object` | Profile data for evaluation |
| `inputMapper` | `(req) => input` | Custom input extraction |
| `onResult` | `(result, req, res) => void` | Custom result handling |

### createDecisionHandler

Create a request handler (not middleware).

```typescript
import { createDecisionHandler } from '@criterionx/express';

const handler = createDecisionHandler({
  decision: riskDecision,
  profile: { threshold: 0.7 }
});

app.post('/api/risk', handler);
```

### createDecisionRouter

Create a router with multiple decisions.

```typescript
import { createDecisionRouter } from '@criterionx/express';

const router = createDecisionRouter({
  decisions: [decision1, decision2, decision3],
  profiles: {
    'decision-1': { /* profile */ },
    'decision-2': { /* profile */ }
  },
  prefix: '/evaluate'  // Optional prefix
});

app.use('/api', router);
// Creates: POST /api/evaluate/:decisionId
```

## Fastify Integration

### Quick Start

```typescript
import Fastify from 'fastify';
import { criterionPlugin } from '@criterionx/express/fastify';

const fastify = Fastify();

await fastify.register(criterionPlugin, {
  decisions: [pricingDecision, eligibilityDecision],
  profiles: {
    pricing: { basePrice: 100 },
    eligibility: { minAge: 18 }
  },
  prefix: '/decisions'
});

fastify.listen({ port: 3000 });
```

### criterionPlugin

Fastify plugin that registers decision routes.

```typescript
import { criterionPlugin } from '@criterionx/express/fastify';

fastify.register(criterionPlugin, {
  decisions: Decision[];
  profiles?: Record<string, unknown>;
  prefix?: string;
});
```

### createDecisionRoute

Create a single decision route.

```typescript
import { createDecisionRoute } from '@criterionx/express/fastify';

fastify.post('/api/pricing', createDecisionRoute({
  decision: pricingDecision,
  profile: { basePrice: 100 }
}));
```

### createDecisionHook

Create a Fastify hook for decision evaluation.

```typescript
import { createDecisionHook } from '@criterionx/express/fastify';

fastify.addHook('preHandler', createDecisionHook({
  decision: authDecision,
  profile: { allowedRoles: ['admin'] },
  inputMapper: (request) => ({
    userId: request.headers['x-user-id'],
    role: request.headers['x-user-role']
  }),
  onDeny: (result, request, reply) => {
    reply.code(403).send({ error: 'Access denied' });
  }
}));
```

## Request/Response Format

### Request

```http
POST /api/decisions/pricing
Content-Type: application/json

{
  "quantity": 5,
  "customerType": "premium"
}
```

### Response (Success)

```json
{
  "status": "OK",
  "data": {
    "unitPrice": 90,
    "total": 450,
    "discount": 50
  },
  "meta": {
    "decisionId": "pricing",
    "decisionVersion": "1.0.0",
    "matchedRule": "premium-discount",
    "explanation": "Premium customer 10% discount applied",
    "evaluatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Response (Validation Error)

```json
{
  "status": "INVALID_INPUT",
  "message": "Input validation failed: quantity must be positive",
  "meta": {
    "decisionId": "pricing",
    "evaluatedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Advanced Patterns

### Custom Input Mapping

```typescript
createDecisionMiddleware({
  decision: pricingDecision,
  profile: { basePrice: 100 },
  inputMapper: (req) => ({
    ...req.body,
    userId: req.user?.id,
    timestamp: new Date()
  })
});
```

### Authentication Integration

```typescript
// Protect with auth middleware first
app.post('/api/premium-pricing',
  authMiddleware,
  createDecisionMiddleware({
    decision: premiumPricingDecision,
    profile: { vipDiscount: 0.2 }
  })
);
```

### Error Handling

```typescript
createDecisionMiddleware({
  decision: riskDecision,
  profile: { threshold: 0.5 },
  onResult: (result, req, res) => {
    if (result.status !== 'OK') {
      // Log to monitoring
      logger.error('Decision failed', { result });
    }
    // Default response handling continues
  }
});
```

### Dynamic Profiles

```typescript
app.post('/api/pricing/:region',
  async (req, res, next) => {
    const profile = await loadRegionProfile(req.params.region);
    req.decisionProfile = profile;
    next();
  },
  createDecisionMiddleware({
    decision: pricingDecision,
    profileResolver: (req) => req.decisionProfile
  })
);
```
