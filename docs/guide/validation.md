# Validation

Criterion uses [Zod](https://zod.dev) for schema validation at every step.

## What Gets Validated

1. **Input** — Before rules are evaluated
2. **Profile** — Before rules are evaluated
3. **Output** — After a rule emits a result

## Validation Flow

```
Input → Validate → Profile → Validate → Rules → Output → Validate → Result
```

If any validation fails, the engine returns an error result instead of throwing.

## Input Validation

```typescript
const inputSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  customerId: z.string().uuid(),
});
```

Invalid input returns:

```typescript
{
  status: "INVALID_INPUT",
  data: null,
  meta: {
    explanation: "Input validation failed: amount must be positive"
  }
}
```

## Profile Validation

```typescript
const profileSchema = z.object({
  threshold: z.number().min(0),
  maxRetries: z.number().int().positive(),
});
```

## Output Validation

```typescript
const outputSchema = z.object({
  risk: z.enum(["HIGH", "MEDIUM", "LOW"]),
  score: z.number().min(0).max(100),
});
```

If a rule emits invalid output, you get `INVALID_OUTPUT` — this indicates a bug in your rule logic.

## Best Practices

1. **Be specific** — Use `.positive()`, `.min()`, `.max()` to catch edge cases
2. **Use enums** — `z.enum()` for finite sets of values
3. **Document with descriptions** — `z.string().describe("ISO currency code")`
4. **Validate early** — Stricter schemas catch bugs faster
