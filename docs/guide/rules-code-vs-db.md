# Rules: Code vs Database

A common question: should rules live in code, config files, or a database?

Criterion takes a clear stance: **rules in code, parameters in profiles**.

## The Spectrum

| Approach | Rules | Parameters | Flexibility | Safety |
|----------|-------|------------|-------------|--------|
| Hardcoded | Code | Code | Low | High |
| **Criterion** | Code | Profiles | Medium | High |
| Rule engines | Config | Config | High | Medium |
| Dynamic rules | DB | DB | Very High | Low |

## Why Rules in Code?

### 1. Type Safety

TypeScript catches errors at compile time:

```typescript
// ❌ This won't compile
rules: [
  {
    id: "bad-rule",
    when: (input) => input.ammount > 100,  // Typo caught!
    //                    ^ Property 'ammount' does not exist
  }
]
```

Database-stored rules can't provide this.

### 2. Version Control

Rules are commits:
- See exactly what changed and when
- Review in PRs before deploy
- Rollback with `git revert`
- Audit history is automatic

### 3. Testing

Rules are testable:

```typescript
describe("fraud-check", () => {
  it("blocks high-risk countries", () => {
    const result = engine.run(fraudDecision,
      { country: "XX" },
      { profile }
    );
    expect(result.data.action).toBe("BLOCK");
  });
});
```

CI catches regressions before production.

### 4. No Runtime Parsing

Database rules require:
- Expression parsers
- Sandboxed evaluators
- Error handling for bad syntax

Criterion rules are plain functions — no parsing overhead.

## What Goes in Profiles?

Profiles hold **parameters that vary**, not logic:

```typescript
// ✅ Good: thresholds and limits
profileSchema: z.object({
  highRiskThreshold: z.number(),
  maxTransactionAmount: z.number(),
  blockedCountries: z.array(z.string()),
});

// ❌ Bad: trying to put logic in profiles
profileSchema: z.object({
  ruleExpression: z.string(),  // "amount > threshold"
});
```

## Profile Storage Strategies

### Static Profiles (Simplest)

Profiles in code alongside decisions:

```typescript
// profiles.ts
export const profiles = {
  "us-standard": {
    threshold: 10000,
    blockedCountries: ["XX", "YY"],
  },
  "eu-strict": {
    threshold: 5000,
    blockedCountries: ["XX", "YY", "ZZ"],
  },
};
```

**Pros:** Simple, versioned, type-safe
**Cons:** Changes require deploy

### Config Files

JSON/YAML loaded at startup:

```yaml
# profiles/us-standard.yaml
threshold: 10000
blockedCountries:
  - XX
  - YY
```

```typescript
import { load } from "js-yaml";
const profile = load(readFileSync("profiles/us-standard.yaml"));
```

**Pros:** Non-developers can edit, still versioned
**Cons:** No type safety at write time

### Environment Variables

For simple overrides:

```typescript
const profile = {
  threshold: parseInt(process.env.RISK_THRESHOLD ?? "10000"),
  maxAmount: parseInt(process.env.MAX_AMOUNT ?? "50000"),
};
```

**Pros:** Easy deployment configuration
**Cons:** Limited to simple values

### Database

For truly dynamic per-tenant profiles:

```typescript
async function getProfile(tenantId: string) {
  const row = await db.query(
    "SELECT profile FROM tenant_profiles WHERE tenant_id = $1",
    [tenantId]
  );
  return tenantProfileSchema.parse(row.profile);
}

// At request time
const profile = await getProfile(request.tenantId);
const result = engine.run(decision, input, { profile });
```

**Pros:** Changes without deploy, per-tenant
**Cons:** More complexity, need validation

### Profile Registry

Criterion's built-in registry with lazy loading:

```typescript
import { createProfileRegistry } from "@criterionx/core";

const registry = createProfileRegistry({
  schema: profileSchema,
  loader: async (key) => {
    // Load from anywhere
    return await fetchFromConfigService(key);
  },
  cache: {
    ttl: 60000,  // Cache for 1 minute
  },
});

// Use it
const profile = await registry.get("us-standard");
const result = engine.run(decision, input, { profile });
```

## The Recommended Pattern

For most applications:

```
┌─────────────────────────────────────────────┐
│                  CODE                        │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │  Decisions  │    │  Default Profiles   │ │
│  │  (rules)    │    │  (baseline config)  │ │
│  └─────────────┘    └─────────────────────┘ │
└─────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│              CONFIG/DB                       │
│  ┌─────────────────────────────────────────┐│
│  │  Profile Overrides                      ││
│  │  (per-tenant, per-environment)          ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

1. **Rules** — Always in code (versioned, tested, typed)
2. **Default profiles** — In code (baseline)
3. **Profile overrides** — In DB or config (per-tenant customization)

```typescript
// Merge default with tenant overrides
const defaultProfile = { threshold: 10000, countries: ["US"] };
const tenantOverrides = await db.getTenantProfile(tenantId);
const profile = { ...defaultProfile, ...tenantOverrides };

const result = engine.run(decision, input, { profile });
```

## When to Break the Rule

Consider database-stored rules **only if**:

1. **Non-developers must create rules** — And you'll build a validated UI
2. **Rules change faster than deploys** — Multiple times per day
3. **Thousands of unique rule sets** — Per-customer customization at scale

Even then, consider:
- Store rule **parameters** in DB, not rule **logic**
- Use generators to create Criterion decisions from DB specs
- Build a proper admin UI with validation

## Anti-Patterns

### Eval is Not a Rule Engine

```typescript
// ❌ NEVER do this
const rule = await db.getRuleExpression();  // "input.amount > 1000"
const result = eval(rule);  // Security nightmare
```

### String Templates Are Not Type-Safe

```typescript
// ❌ Fragile and unvalidated
const condition = `input.${field} ${operator} ${value}`;
```

### JSON Rules Without Validation

```typescript
// ❌ Will fail at runtime with cryptic errors
const rules = JSON.parse(dbRulesJson);
engine.run({ ...decision, rules }, input, { profile });
```

## Summary

| Store | What | When |
|-------|------|------|
| Code | Rules, logic, functions | Always |
| Code | Default profiles | Most cases |
| Config files | Environment-specific profiles | Simple deployments |
| Database | Per-tenant profile overrides | Multi-tenant SaaS |

**Rules in code. Parameters in profiles. Profiles from anywhere.**

## Next Steps

- [Profiles Guide](/guide/profiles) — Working with profiles
- [Profile Registry](/guide/profile-registry) — Dynamic profile loading
- [Testing](/guide/testing) — Testing decisions and profiles
