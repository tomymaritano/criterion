# tRPC Full-Stack Example

Build a type-safe decision API with tRPC and Criterion.

## Overview

This example shows how to:
- Create a tRPC router with decision procedures
- Call decisions from a React client with full type safety
- Handle loading and error states

## Backend Setup

### Decision Definition

```typescript
// decisions/loan-approval.ts
import { defineDecision } from "@criterionx/core";
import { z } from "zod";

export const loanApproval = defineDecision({
  id: "loan-approval",
  version: "1.0.0",
  inputSchema: z.object({
    income: z.number(),
    creditScore: z.number(),
    requestedAmount: z.number(),
  }),
  outputSchema: z.object({
    approved: z.boolean(),
    maxAmount: z.number().optional(),
    reason: z.string(),
  }),
  profileSchema: z.object({
    minCreditScore: z.number(),
    maxDebtToIncome: z.number(),
  }),
  rules: [
    {
      id: "low-credit",
      when: (input, profile) => input.creditScore < profile.minCreditScore,
      emit: () => ({
        approved: false,
        reason: "Credit score below minimum requirement",
      }),
      explain: (input, profile) =>
        `Credit score ${input.creditScore} < ${profile.minCreditScore}`,
    },
    {
      id: "high-dti",
      when: (input, profile) =>
        input.requestedAmount / input.income > profile.maxDebtToIncome,
      emit: (input) => ({
        approved: false,
        reason: "Debt-to-income ratio too high",
      }),
      explain: (input, profile) =>
        `DTI ${(input.requestedAmount / input.income).toFixed(2)} > ${profile.maxDebtToIncome}`,
    },
    {
      id: "approved",
      when: () => true,
      emit: (input) => ({
        approved: true,
        maxAmount: input.income * 5,
        reason: "All criteria met",
      }),
      explain: () => "Applicant meets all requirements",
    },
  ],
});

export const loanProfile = {
  minCreditScore: 650,
  maxDebtToIncome: 0.4,
};
```

### tRPC Router

```typescript
// server/trpc.ts
import { initTRPC } from "@trpc/server";
import { createDecisionProcedure, createDecisionRouter } from "@criterionx/trpc";
import { loanApproval, loanProfile } from "../decisions/loan-approval";

const t = initTRPC.create();

export const appRouter = t.router({
  // Single decision as a procedure
  loanCheck: createDecisionProcedure(t, loanApproval, loanProfile),

  // Or create a sub-router for multiple decisions
  decisions: createDecisionRouter(t, {
    decisions: [loanApproval],
    profiles: { "loan-approval": loanProfile },
  }),
});

export type AppRouter = typeof appRouter;
```

### Server Entry

```typescript
// server/index.ts
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { appRouter } from "./trpc";

const server = createHTTPServer({
  router: appRouter,
});

server.listen(3000);
console.log("tRPC server running on http://localhost:3000");
```

## Frontend Setup

### tRPC Client

```typescript
// client/trpc.ts
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/trpc";

export const trpc = createTRPCReact<AppRouter>();
```

### React Component

```tsx
// client/LoanChecker.tsx
import { useState } from "react";
import { trpc } from "./trpc";

export function LoanChecker() {
  const [income, setIncome] = useState(75000);
  const [creditScore, setCreditScore] = useState(700);
  const [amount, setAmount] = useState(20000);

  const loanCheck = trpc.loanCheck.useMutation();

  const handleCheck = () => {
    loanCheck.mutate({
      income,
      creditScore,
      requestedAmount: amount,
    });
  };

  return (
    <div>
      <h2>Loan Application</h2>

      <div>
        <label>Annual Income</label>
        <input
          type="number"
          value={income}
          onChange={(e) => setIncome(Number(e.target.value))}
        />
      </div>

      <div>
        <label>Credit Score</label>
        <input
          type="number"
          value={creditScore}
          onChange={(e) => setCreditScore(Number(e.target.value))}
        />
      </div>

      <div>
        <label>Loan Amount</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </div>

      <button onClick={handleCheck} disabled={loanCheck.isLoading}>
        {loanCheck.isLoading ? "Checking..." : "Check Eligibility"}
      </button>

      {loanCheck.data && (
        <div>
          <h3>Result</h3>
          <p>
            <strong>Status:</strong>{" "}
            {loanCheck.data.data.approved ? "✅ Approved" : "❌ Denied"}
          </p>
          <p>
            <strong>Reason:</strong> {loanCheck.data.data.reason}
          </p>
          {loanCheck.data.data.maxAmount && (
            <p>
              <strong>Max Amount:</strong> ${loanCheck.data.data.maxAmount.toLocaleString()}
            </p>
          )}
          <p>
            <strong>Matched Rule:</strong> {loanCheck.data.matchedRule}
          </p>
        </div>
      )}

      {loanCheck.error && (
        <div style={{ color: "red" }}>
          Error: {loanCheck.error.message}
        </div>
      )}
    </div>
  );
}
```

### App Provider

```tsx
// client/App.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./trpc";
import { LoanChecker } from "./LoanChecker";

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "http://localhost:3000",
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LoanChecker />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

## Type Safety Benefits

With tRPC, you get:

1. **Input validation** — TypeScript errors if you pass wrong types
2. **Output types** — `loanCheck.data` is fully typed
3. **Auto-completion** — IDE knows all available fields
4. **Refactoring safety** — Change the decision schema, see all affected code

```typescript
// This would be a TypeScript error:
loanCheck.mutate({
  income: "75000", // Error: Type 'string' not assignable to 'number'
  creditScore: 700,
  requestedAmount: 20000,
});

// This is correctly typed:
if (loanCheck.data?.data.approved) {
  console.log(loanCheck.data.data.maxAmount); // number | undefined
}
```

## Server-Side Calling

For background jobs or server-to-server calls:

```typescript
import { createDecisionCaller } from "@criterionx/trpc";
import { loanApproval, loanProfile } from "./decisions/loan-approval";

const evaluateLoan = createDecisionCaller(loanApproval, loanProfile);

// Use in cron jobs, queue workers, etc.
const result = await evaluateLoan({
  income: 100000,
  creditScore: 750,
  requestedAmount: 50000,
});

if (result.data.approved) {
  // Process approved loan...
}
```

## Testing

```typescript
import { createDecisionCaller } from "@criterionx/trpc";
import { describe, it, expect } from "vitest";
import { loanApproval, loanProfile } from "./decisions/loan-approval";

describe("loan approval", () => {
  const evaluate = createDecisionCaller(loanApproval, loanProfile);

  it("approves good applicants", async () => {
    const result = await evaluate({
      income: 100000,
      creditScore: 750,
      requestedAmount: 30000,
    });
    expect(result.data.approved).toBe(true);
    expect(result.data.maxAmount).toBe(500000);
  });

  it("denies low credit score", async () => {
    const result = await evaluate({
      income: 100000,
      creditScore: 500,
      requestedAmount: 30000,
    });
    expect(result.data.approved).toBe(false);
    expect(result.matchedRule).toBe("low-credit");
  });
});
```
