# Types

Complete TypeScript type definitions for Criterion.

## Decision

```typescript
interface Decision<TInput, TOutput, TProfile> {
  id: string;
  version: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  profileSchema: ZodSchema<TProfile>;
  rules: Rule<TInput, TProfile, TOutput>[];
  meta?: DecisionMeta;
}
```

## Rule

```typescript
interface Rule<TContext, TProfile, TOutput> {
  id: string;
  when: (context: TContext, profile: TProfile) => boolean;
  emit: (context: TContext, profile: TProfile) => TOutput;
  explain: (context: TContext, profile: TProfile) => string;
}
```

## Result

```typescript
interface Result<TOutput> {
  status: ResultStatus;
  data: TOutput | null;
  meta: ResultMeta;
}
```

## ResultStatus

```typescript
type ResultStatus =
  | "OK"
  | "NO_MATCH"
  | "INVALID_INPUT"
  | "INVALID_OUTPUT";
```

## ResultMeta

```typescript
interface ResultMeta {
  decisionId: string;
  decisionVersion: string;
  profileId?: string;
  matchedRule?: string;
  evaluatedRules: RuleTrace[];
  explanation: string;
  evaluatedAt: string;
}
```

## RuleTrace

```typescript
interface RuleTrace {
  ruleId: string;
  matched: boolean;
  explanation?: string;
}
```

## DecisionMeta

```typescript
interface DecisionMeta {
  owner?: string;
  tags?: string[];
  tier?: string;
  description?: string;
}
```

## RunOptions

```typescript
type RunOptions<TProfile> =
  | { profile: string }     // Profile ID (requires registry)
  | { profile: TProfile };  // Inline profile object
```

## ProfileRegistry

```typescript
interface ProfileRegistry<TProfile> {
  get(id: string): TProfile | undefined;
  register(id: string, profile: TProfile): void;
  has(id: string): boolean;
}
```
