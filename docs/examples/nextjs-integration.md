# Next.js Integration

Build a full-stack Next.js application with Criterion for dynamic pricing decisions.

## Overview

This example demonstrates:
- Server-side decision evaluation with tRPC
- Client-side hooks with React
- Type-safe end-to-end integration

## Project Setup

```bash
npx create-next-app@latest my-criterion-app --typescript
cd my-criterion-app
npm install @criterionx/core @criterionx/react @criterionx/trpc @trpc/server @trpc/client @trpc/react-query @tanstack/react-query zod
```

## Define the Decision

```typescript
// src/decisions/pricing.ts
import { defineDecision, createRule } from '@criterionx/core';
import { z } from 'zod';

export const pricingDecision = defineDecision({
  id: 'pricing',
  version: '1.0.0',
  inputSchema: z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    customerType: z.enum(['regular', 'premium', 'vip']),
  }),
  outputSchema: z.object({
    unitPrice: z.number(),
    discount: z.number(),
    total: z.number(),
    tier: z.string(),
  }),
  profileSchema: z.object({
    basePrice: z.number(),
    premiumDiscount: z.number(),
    vipDiscount: z.number(),
    bulkThreshold: z.number(),
    bulkDiscount: z.number(),
  }),
  rules: [
    createRule({
      id: 'vip-bulk',
      when: (input, profile) =>
        input.customerType === 'vip' && input.quantity >= profile.bulkThreshold,
      emit: (input, profile) => {
        const discount = profile.vipDiscount + profile.bulkDiscount;
        const unitPrice = profile.basePrice * (1 - discount);
        return {
          unitPrice,
          discount,
          total: unitPrice * input.quantity,
          tier: 'VIP + Bulk',
        };
      },
      explain: () => 'VIP customer with bulk order discount',
    }),
    createRule({
      id: 'vip',
      when: (input) => input.customerType === 'vip',
      emit: (input, profile) => {
        const unitPrice = profile.basePrice * (1 - profile.vipDiscount);
        return {
          unitPrice,
          discount: profile.vipDiscount,
          total: unitPrice * input.quantity,
          tier: 'VIP',
        };
      },
      explain: () => 'VIP customer discount',
    }),
    createRule({
      id: 'premium',
      when: (input) => input.customerType === 'premium',
      emit: (input, profile) => {
        const unitPrice = profile.basePrice * (1 - profile.premiumDiscount);
        return {
          unitPrice,
          discount: profile.premiumDiscount,
          total: unitPrice * input.quantity,
          tier: 'Premium',
        };
      },
      explain: () => 'Premium customer discount',
    }),
    createRule({
      id: 'regular',
      when: () => true,
      emit: (input, profile) => ({
        unitPrice: profile.basePrice,
        discount: 0,
        total: profile.basePrice * input.quantity,
        tier: 'Regular',
      }),
      explain: () => 'Standard pricing',
    }),
  ],
});

export type PricingInput = z.infer<typeof pricingDecision.inputSchema>;
export type PricingOutput = z.infer<typeof pricingDecision.outputSchema>;
```

## Setup tRPC Server

```typescript
// src/server/trpc.ts
import { initTRPC } from '@trpc/server';

const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

```typescript
// src/server/routers/pricing.ts
import { createDecisionProcedure } from '@criterionx/trpc';
import { initTRPC } from '@trpc/server';
import { pricingDecision } from '@/decisions/pricing';

const t = initTRPC.create();

export const pricingRouter = t.router({
  calculate: createDecisionProcedure(t, {
    decision: pricingDecision,
    profile: {
      basePrice: 99.99,
      premiumDiscount: 0.1,
      vipDiscount: 0.2,
      bulkThreshold: 10,
      bulkDiscount: 0.05,
    },
  }),
});
```

```typescript
// src/server/routers/_app.ts
import { router } from '../trpc';
import { pricingRouter } from './pricing';

export const appRouter = router({
  pricing: pricingRouter,
});

export type AppRouter = typeof appRouter;
```

## Setup tRPC API Route

```typescript
// src/app/api/trpc/[trpc]/route.ts
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
```

## Setup tRPC Client

```typescript
// src/lib/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
```

```tsx
// src/app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

## Build the UI

```tsx
// src/app/page.tsx
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';

export default function PricingCalculator() {
  const [quantity, setQuantity] = useState(1);
  const [customerType, setCustomerType] = useState<'regular' | 'premium' | 'vip'>('regular');

  const pricingMutation = trpc.pricing.calculate.useMutation();

  const handleCalculate = () => {
    pricingMutation.mutate({
      productId: 'PROD-001',
      quantity,
      customerType,
    });
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Pricing Calculator</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Customer Type</label>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as any)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="regular">Regular</option>
            <option value="premium">Premium</option>
            <option value="vip">VIP</option>
          </select>
        </div>

        <button
          onClick={handleCalculate}
          disabled={pricingMutation.isPending}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {pricingMutation.isPending ? 'Calculating...' : 'Calculate Price'}
        </button>
      </div>

      {pricingMutation.data?.data && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h2 className="font-semibold mb-2">Result</h2>
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt>Tier:</dt>
              <dd className="font-medium">{pricingMutation.data.data.tier}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Unit Price:</dt>
              <dd>${pricingMutation.data.data.unitPrice.toFixed(2)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Discount:</dt>
              <dd>{(pricingMutation.data.data.discount * 100).toFixed(0)}%</dd>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <dt>Total:</dt>
              <dd>${pricingMutation.data.data.total.toFixed(2)}</dd>
            </div>
          </dl>

          {pricingMutation.data.meta?.explanation && (
            <p className="mt-2 text-sm text-gray-600">
              {pricingMutation.data.meta.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Alternative: Client-Side Only

For simpler use cases, use `@criterionx/react` directly:

```tsx
// src/app/client-pricing/page.tsx
'use client';

import { CriterionProvider, useDecision } from '@criterionx/react';
import { pricingDecision } from '@/decisions/pricing';

function PricingForm() {
  const { result, isEvaluating, evaluate } = useDecision('pricing');

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      evaluate({
        productId: 'PROD-001',
        quantity: Number(formData.get('quantity')),
        customerType: formData.get('customerType') as any,
      });
    }}>
      {/* form fields */}
      <button type="submit" disabled={isEvaluating}>
        Calculate
      </button>
      {result?.data && (
        <div>Total: ${result.data.total.toFixed(2)}</div>
      )}
    </form>
  );
}

export default function ClientPricingPage() {
  return (
    <CriterionProvider
      decisions={[pricingDecision]}
      profiles={{
        pricing: {
          basePrice: 99.99,
          premiumDiscount: 0.1,
          vipDiscount: 0.2,
          bulkThreshold: 10,
          bulkDiscount: 0.05,
        },
      }}
    >
      <PricingForm />
    </CriterionProvider>
  );
}
```

## Key Takeaways

1. **Type Safety** - Full type inference from decision schemas to UI
2. **Flexibility** - Choose server-side (tRPC) or client-side (React hooks) evaluation
3. **Separation of Concerns** - Business logic in decisions, UI in components
4. **Easy Profiling** - Change pricing rules without code changes
