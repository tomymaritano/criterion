# Anti-Patterns

Things you should **never** do in Criterion.

## 1. Fetching Data Inside Rules

```ts
// ❌ WRONG
createRule({
  id: "check-balance",
  when: async (ctx) => {
    const balance = await db.getBalance(ctx.userId); // NO!
    return balance > 1000;
  },
  // ...
})
```

```ts
// ✅ CORRECT
// Fetch data BEFORE calling engine.run()
const balance = await db.getBalance(userId);
const context = { userId, balance };
engine.run(decision, context, { profile });
```

**Why:** Rules must be pure. Side effects break determinism.

---

## 2. Using Date.now() Directly

```ts
// ❌ WRONG
createRule({
  id: "is-expired",
  when: (ctx) => Date.now() > ctx.expiresAt, // NO!
  // ...
})
```

```ts
// ✅ CORRECT
// Inject current time via context
const context = { expiresAt, currentTime: Date.now() };
engine.run(decision, context, { profile });

// Rule uses injected time
when: (ctx) => ctx.currentTime > ctx.expiresAt,
```

**Why:** Non-determinism. Same inputs must produce same outputs.

---

## 3. Mutating Context

```ts
// ❌ WRONG
createRule({
  id: "transform",
  when: (ctx) => {
    ctx.value = ctx.value * 2; // NO! Mutation
    return true;
  },
  // ...
})
```

```ts
// ✅ CORRECT
// Context is read-only. Emit new values in output.
createRule({
  id: "transform",
  when: (ctx) => true,
  emit: (ctx) => ({ transformedValue: ctx.value * 2 }),
  // ...
})
```

**Why:** Mutations cause unpredictable behavior across rules.

---

## 4. Implicit Profiles

```ts
// ❌ WRONG
const DEFAULT_THRESHOLD = 0.05; // Global constant

createRule({
  id: "high-risk",
  when: (ctx) => ctx.rate > DEFAULT_THRESHOLD, // NO!
  // ...
})
```

```ts
// ✅ CORRECT
// Use explicit profile parameters
createRule({
  id: "high-risk",
  when: (ctx, profile) => ctx.rate > profile.threshold,
  // ...
})
```

**Why:** Hidden dependencies. Profiles must be explicit and auditable.

---

## 5. Side Effects in emit()

```ts
// ❌ WRONG
createRule({
  id: "notify",
  emit: (ctx) => {
    sendEmail(ctx.email); // NO! Side effect
    return { notified: true };
  },
  // ...
})
```

```ts
// ✅ CORRECT
// Emit intent, let the host system execute
createRule({
  id: "notify",
  emit: (ctx) => ({
    action: "SEND_EMAIL",
    recipient: ctx.email,
  }),
  // ...
})

// Host system handles side effects AFTER decision
if (result.data.action === "SEND_EMAIL") {
  await sendEmail(result.data.recipient);
}
```

**Why:** Criterion decides, the system executes.

---

## 6. Decisions Without Catch-All Rules

```ts
// ❌ WRONG
rules: [
  createRule({ id: "high", when: (ctx) => ctx.score > 80, /* ... */ }),
  createRule({ id: "medium", when: (ctx) => ctx.score > 50, /* ... */ }),
  // What if score <= 50? → NO_MATCH!
]
```

```ts
// ✅ CORRECT
rules: [
  createRule({ id: "high", when: (ctx) => ctx.score > 80, /* ... */ }),
  createRule({ id: "medium", when: (ctx) => ctx.score > 50, /* ... */ }),
  createRule({ id: "low", when: () => true, /* ... */ }), // Catch-all
]
```

**Why:** Classification decisions must be total. NO_MATCH indicates design error.

---

## 7. Unused Inputs

```ts
// ❌ WRONG
inputSchema: z.object({
  name: z.string(),
  age: z.number(),     // Never used in any rule!
  email: z.string(),
}),
rules: [
  createRule({
    when: (ctx) => ctx.name.length > 0, // Only uses 'name'
    // ...
  }),
]
```

```ts
// ✅ CORRECT
// Remove unused inputs
inputSchema: z.object({
  name: z.string(),
}),
```

**Why:** Dead inputs indicate design confusion. Every input must matter.

---

## 8. Throwing Exceptions for Business Logic

```ts
// ❌ WRONG
createRule({
  id: "validate",
  when: (ctx) => {
    if (ctx.value < 0) throw new Error("Invalid value"); // NO!
    return ctx.value > 100;
  },
  // ...
})
```

```ts
// ✅ CORRECT
// Use input validation schema instead
inputSchema: z.object({
  value: z.number().nonnegative(),
}),
```

**Why:** Invalid inputs should fail validation, not throw in rules.

---

## 9. Complex Logic in when()

```ts
// ❌ WRONG (too complex)
createRule({
  id: "complex",
  when: (ctx, profile) => {
    const a = ctx.x * profile.factor;
    const b = Math.sqrt(ctx.y);
    const c = a > b ? a - b : b - a;
    return c > profile.threshold && ctx.z !== null;
  },
  // ...
})
```

```ts
// ✅ CORRECT
// Keep conditions simple, move complexity to context builder
// Or split into multiple rules
```

**Why:** Rules should be readable. Complex logic should be pre-computed.

---

## 10. Hardcoded Values

```ts
// ❌ WRONG
createRule({
  id: "premium",
  when: (ctx) => ctx.balance > 10000, // Magic number!
  // ...
})
```

```ts
// ✅ CORRECT
// Use profile for thresholds
createRule({
  id: "premium",
  when: (ctx, profile) => ctx.balance > profile.premiumThreshold,
  // ...
})
```

**Why:** Hardcoded values can't be adjusted without code changes.

---

## Summary

| Anti-Pattern | Fix |
|--------------|-----|
| Fetching data in rules | Fetch before engine.run() |
| Date.now() in rules | Inject time via context |
| Mutating context | Context is read-only |
| Implicit profiles | Make thresholds explicit |
| Side effects in emit() | Emit intent, execute outside |
| No catch-all rule | Always include fallback |
| Unused inputs | Remove or use them |
| Throwing exceptions | Use input validation |
| Complex when() | Simplify or pre-compute |
| Hardcoded values | Use profile parameters |
