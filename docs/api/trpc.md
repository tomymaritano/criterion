# @criterionx/trpc

tRPC integration for Criterion decision engine with full type safety.

## Installation

```bash
npm install @criterionx/trpc @criterionx/core @trpc/server
```

## Quick Start

```typescript
import { initTRPC } from '@trpc/server';
import { createDecisionProcedure } from '@criterionx/trpc';
import { pricingDecision, eligibilityDecision } from './decisions';

const t = initTRPC.create();

const appRouter = t.router({
  pricing: createDecisionProcedure(t, {
    decision: pricingDecision,
    profile: { basePrice: 100, discountRate: 0.1 }
  }),

  eligibility: createDecisionProcedure(t, {
    decision: eligibilityDecision,
    profile: { minAge: 18, minScore: 650 }
  })
});

export type AppRouter = typeof appRouter;
```

## API Reference

### createDecisionProcedure

Create a tRPC procedure for a single decision.

```typescript
function createDecisionProcedure<TInput, TOutput, TProfile>(
  t: TRPCInstance,
  options: {
    decision: Decision<TInput, TOutput, TProfile>;
    profile: TProfile;
  }
): TRPCProcedure
```

#### Example

```typescript
const pricingProcedure = createDecisionProcedure(t, {
  decision: pricingDecision,
  profile: { basePrice: 100 }
});

// Client usage (fully typed)
const result = await trpc.pricing.mutate({
  quantity: 5,
  customerType: 'premium'
});
// result.data is typed as PricingOutput
```

### createDecisionRouter

Create a router with multiple decisions.

```typescript
import { createDecisionRouter } from '@criterionx/trpc';

const decisionRouter = createDecisionRouter(t, {
  decisions: [pricingDecision, eligibilityDecision, riskDecision],
  profiles: {
    pricing: { basePrice: 100 },
    eligibility: { minAge: 18 },
    'risk-assessment': { threshold: 0.7 }
  }
});

const appRouter = t.router({
  decisions: decisionRouter
});
```

This creates procedures:
- `decisions.pricing.evaluate`
- `decisions.eligibility.evaluate`
- `decisions.risk-assessment.evaluate`

### createDecisionCaller

Create a direct caller for server-side usage.

```typescript
import { createDecisionCaller } from '@criterionx/trpc';

const evaluatePricing = createDecisionCaller({
  decision: pricingDecision,
  profile: { basePrice: 100 }
});

// Use directly without HTTP
const result = await evaluatePricing({
  quantity: 10,
  customerType: 'regular'
});
```

## Type Safety

Full end-to-end type safety with tRPC:

```typescript
// decisions.ts
import { defineDecision } from '@criterionx/core';
import { z } from 'zod';

export const pricingDecision = defineDecision({
  id: 'pricing',
  version: '1.0.0',
  inputSchema: z.object({
    quantity: z.number().positive(),
    customerType: z.enum(['regular', 'premium', 'vip'])
  }),
  outputSchema: z.object({
    unitPrice: z.number(),
    total: z.number(),
    discount: z.number()
  }),
  profileSchema: z.object({
    basePrice: z.number(),
    discountRate: z.number()
  }),
  rules: [/* ... */]
});

// router.ts
const appRouter = t.router({
  pricing: createDecisionProcedure(t, {
    decision: pricingDecision,
    profile: { basePrice: 100, discountRate: 0.1 }
  })
});

// client.tsx - Types are inferred!
const result = await trpc.pricing.mutate({
  quantity: 5,           // ✅ number required
  customerType: 'vip'    // ✅ must be 'regular' | 'premium' | 'vip'
});

result.data?.unitPrice   // ✅ typed as number
result.data?.invalid     // ❌ TypeScript error
```

## Integration Patterns

### With React Query

```tsx
import { trpc } from './utils/trpc';

function PricingCalculator() {
  const pricingMutation = trpc.pricing.useMutation();

  const handleCalculate = () => {
    pricingMutation.mutate({
      quantity: 10,
      customerType: 'premium'
    });
  };

  return (
    <div>
      <button onClick={handleCalculate}>
        Calculate
      </button>
      {pricingMutation.data?.data && (
        <p>Total: ${pricingMutation.data.data.total}</p>
      )}
    </div>
  );
}
```

### With Next.js App Router

```typescript
// app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({})
  });

export { handler as GET, handler as POST };
```

### Protected Procedures

```typescript
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});

const appRouter = t.router({
  pricing: protectedProcedure
    .input(pricingDecision.inputSchema)
    .mutation(async ({ input, ctx }) => {
      const engine = new Engine();
      return engine.run(pricingDecision, input, {
        profile: await getProfileForUser(ctx.user)
      });
    })
});
```

### Dynamic Profiles

```typescript
const appRouter = t.router({
  pricing: t.procedure
    .input(z.object({
      region: z.string(),
      ...pricingDecision.inputSchema.shape
    }))
    .mutation(async ({ input }) => {
      const { region, ...decisionInput } = input;
      const profile = await loadRegionProfile(region);

      const engine = new Engine();
      return engine.run(pricingDecision, decisionInput, { profile });
    })
});
```

## Error Handling

Decision errors are returned in the result, not thrown:

```typescript
const result = await trpc.pricing.mutate({ quantity: -1 });

if (result.status !== 'OK') {
  console.error(result.message);
  // "Input validation failed: quantity must be positive"
}
```

For tRPC-level errors (network, auth), use standard tRPC error handling:

```typescript
try {
  await trpc.pricing.mutate(input);
} catch (error) {
  if (error instanceof TRPCClientError) {
    // Handle tRPC error
  }
}
```
