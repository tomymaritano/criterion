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

```typescript
const engine = new Engine();

// Register profiles on the engine
engine.registerProfile("risk-decision", "us", usProfile);
engine.registerProfile("risk-decision", "eu", euProfile);

// Run with profile ID
const result = engine.run(
  riskDecision,
  input,
  { profile: "us" }  // String ID instead of object
);
```

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
