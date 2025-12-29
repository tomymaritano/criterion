# Helpers

Utility functions for working with Criterion.

## defineDecision()

Type-safe helper to define decisions with full inference.

```typescript
function defineDecision<TInput, TOutput, TProfile>(
  definition: Decision<TInput, TOutput, TProfile>
): Decision<TInput, TOutput, TProfile>
```

**Example:**

```typescript
import { defineDecision } from "@criterionx/core";

const myDecision = defineDecision({
  id: "my-decision",
  version: "1.0.0",
  inputSchema,
  outputSchema,
  profileSchema,
  rules: [/* ... */],
});
```

## createRule()

Type-safe helper to create rules with inference.

```typescript
function createRule<TContext, TProfile, TOutput>(
  rule: Rule<TContext, TProfile, TOutput>
): Rule<TContext, TProfile, TOutput>
```

**Example:**

```typescript
import { createRule } from "@criterionx/core";

const highRiskRule = createRule({
  id: "high-risk",
  when: (input, profile) => input.amount > profile.threshold,
  emit: () => ({ risk: "HIGH" }),
  explain: (input, profile) => `Amount ${input.amount} > ${profile.threshold}`,
});
```

## createProfileRegistry()

Creates an in-memory profile registry.

```typescript
function createProfileRegistry<TProfile>(): ProfileRegistry<TProfile>
```

**Example:**

```typescript
import { createProfileRegistry } from "@criterionx/core";

const registry = createProfileRegistry<MyProfileType>();

registry.register("us", usProfile);
registry.register("eu", euProfile);

const profile = registry.get("us");
```

## isInlineProfile()

Type guard to check if profile option is inline or ID-based.

```typescript
function isInlineProfile<TProfile>(
  options: RunOptions<TProfile>
): options is { profile: TProfile }
```

**Example:**

```typescript
import { isInlineProfile } from "@criterionx/core";

if (isInlineProfile(options)) {
  // options.profile is TProfile
} else {
  // options.profile is string (ID)
}
```
