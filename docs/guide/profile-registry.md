# Profile Registry

The Profile Registry allows you to register named profiles and reference them by ID.

## Why Use a Registry?

- **Centralized management** — All profiles in one place
- **Reference by ID** — `{ profile: "us-standard" }` instead of inline objects
- **Runtime flexibility** — Load profiles from config files or database

## Creating a Registry

```typescript
import { createProfileRegistry } from "@criterionx/core";

const registry = createProfileRegistry<MyProfileType>();
```

## Registering Profiles

```typescript
registry.register("us-standard", {
  highThreshold: 10000,
  mediumThreshold: 5000,
});

registry.register("eu-strict", {
  highThreshold: 5000,
  mediumThreshold: 2000,
});
```

## Using with Engine

Pass the registry as the 4th argument to `engine.run()`:

```typescript
import { Engine, createProfileRegistry } from "@criterionx/core";

// Create and populate registry
const registry = createProfileRegistry<ProfileType>();
registry.register("us", usProfile);
registry.register("eu", euProfile);

// Run with profile ID - pass registry as 4th argument
const engine = new Engine();
const result = engine.run(
  riskDecision,
  input,
  { profile: "us" },  // String ID
  registry            // Registry containing profiles
);
```

> **Note:** The registry is passed per-call, not stored on the engine. This keeps the engine stateless and allows different registries for different contexts.

## Checking Profiles

```typescript
if (registry.has("us-standard")) {
  const profile = registry.get("us-standard");
}
```

## Loading from Config

```typescript
import profiles from "./profiles.json";

Object.entries(profiles).forEach(([id, profile]) => {
  registry.register(id, profile);
});
```

## Best Practices

1. **Use descriptive IDs** — `us-premium-2024` not `profile1`
2. **Validate on register** — Check profiles against schema
3. **Version your profiles** — Include version in config files
4. **Document each profile** — What's different and why
