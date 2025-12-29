# Profiles

Profiles allow you to parameterize decisions without changing logic.

## What Are Profiles?

A profile contains the variable parameters for a decision:

```typescript
// Same decision logic, different thresholds
const usProfile = {
  highThreshold: 10000,
  mediumThreshold: 5000,
};

const euProfile = {
  highThreshold: 8000,
  mediumThreshold: 3000,
};
```

## Why Use Profiles?

- **Regional variations** - Different rules per country/region
- **Customer tiers** - Premium vs standard thresholds
- **Environments** - Stricter limits in production
- **A/B testing** - Compare parameter variations
- **Time-based rules** - Holiday vs normal periods

## Defining Profile Schema

Use Zod to define what a profile contains:

```typescript
const profileSchema = z.object({
  highThreshold: z.number(),
  mediumThreshold: z.number(),
  blockedMerchants: z.array(z.string()),
  maxDailyTransactions: z.number(),
});
```

## Using Inline Profiles

Pass the profile directly:

```typescript
const result = engine.run(
  decision,
  input,
  { profile: { highThreshold: 10000, mediumThreshold: 5000 } }
);
```

## Using Profile Registry

Register profiles by ID for reuse:

```typescript
// Register profiles
engine.registerProfile("risk-decision", "us", usProfile);
engine.registerProfile("risk-decision", "eu", euProfile);
engine.registerProfile("risk-decision", "latam", latamProfile);

// Use by ID
const result = engine.run(
  decision,
  input,
  { profile: "us" }  // String ID instead of object
);
```

## Profile Resolution

The engine resolves profiles in this order:

1. If `profile` is an object → use it directly
2. If `profile` is a string → look up in registry
3. If not found in registry → return `INVALID_INPUT`

## Creating a Registry

```typescript
import { createProfileRegistry } from "@criterionx/core";

const registry = createProfileRegistry<MyProfileType>();

registry.register("production", productionProfile);
registry.register("staging", stagingProfile);

if (registry.has("production")) {
  const profile = registry.get("production");
}
```

## Profile Patterns

### By Region

```typescript
const profiles = {
  "us": { currency: "USD", maxAmount: 50000 },
  "eu": { currency: "EUR", maxAmount: 40000 },
  "uk": { currency: "GBP", maxAmount: 35000 },
};
```

### By Customer Tier

```typescript
const profiles = {
  "standard": { discountRate: 0, creditLimit: 1000 },
  "silver": { discountRate: 0.05, creditLimit: 5000 },
  "gold": { discountRate: 0.10, creditLimit: 10000 },
  "platinum": { discountRate: 0.15, creditLimit: 50000 },
};
```

### By Environment

```typescript
const profiles = {
  "development": { rateLimit: 1000, strictMode: false },
  "staging": { rateLimit: 100, strictMode: true },
  "production": { rateLimit: 10, strictMode: true },
};
```

## Best Practices

1. **Validate with Zod** - Catch invalid profiles early
2. **Use meaningful IDs** - `us-premium` not `profile1`
3. **Document profile values** - What does each field mean?
4. **Version profiles** - Store in config files with version control
5. **Prefer registry for shared profiles** - Avoid duplicating objects

## Profile Sources

Profiles can come from:

- **Config files** - JSON/YAML loaded at startup
- **Database** - Dynamic profiles per tenant
- **Environment variables** - Deployment-specific settings
- **Feature flags** - A/B testing systems

The engine doesn't care where profiles come from - it just needs a valid object matching the schema.
