# Versioning

Criterion uses semantic versioning for both decisions and profiles.

## Decision Versioning

Every decision has a version in the format `MAJOR.MINOR.PATCH`.

```xml
<decision id="currency-exposure-risk" version="1.2.0">
```

### Version Changes

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking input/output schema change | MAJOR | Removing an input field |
| New optional input/output | MINOR | Adding optional field |
| Rule logic adjustment (same schema) | MINOR | Changing thresholds |
| Documentation, typos, formatting | PATCH | Fixing a reason string |

### Breaking Changes (MAJOR)

A change is breaking if:
- An input field is removed or renamed
- An input field becomes required (was optional)
- An output field is removed or renamed
- Output enum values are removed
- Profile parameters are removed or renamed

### Non-Breaking Changes (MINOR)

A change is non-breaking if:
- A new optional input is added
- A new output field is added
- A new enum value is added
- Rule logic changes but schema stays the same
- A new rule is added

## Profile Versioning

Profiles are versioned independently of decisions.

```json
{
  "id": "high-inflation-emerging",
  "version": "1.0.0",
  "thresholds": { ... }
}
```

### When to Version Profiles

- **MAJOR**: Threshold keys renamed or removed
- **MINOR**: New threshold added, existing values changed
- **PATCH**: Description or metadata changes only

## Compatibility Matrix

| Decision Version | Profile Version | Compatible? |
|------------------|-----------------|-------------|
| 1.x.x | 1.x.x | Yes |
| 2.0.0 | 1.x.x | Check migration guide |
| 1.x.x | 2.0.0 | No (profile too new) |

## Runtime Behavior

The engine validates compatibility:
- Decision expects certain profile parameters
- Profile must provide all required parameters
- Extra profile parameters are ignored (forward compatible)

```ts
// OK: Profile has all required params
engine.run(decisionV1, context, { profile: profileV1 })

// ERROR: Profile missing required params
engine.run(decisionV2, context, { profile: profileV1 })
// → INVALID_INPUT (profile invalid)
```

## Migration Patterns

### Migrating a Decision

1. Create new decision version
2. Mark old version as deprecated (in metadata)
3. Update consuming code to use new version
4. Remove old version after grace period

### Migrating a Profile

1. Create new profile version
2. Update registry with new version
3. Update consuming code to reference new profile
4. Keep old profile for rollback capability

## Best Practices

1. **Never mutate released versions** — create new version instead
2. **Document breaking changes** — in decision metadata or changelog
3. **Test both versions** — during migration period
4. **Use shadow mode** — compare old vs new before switching
5. **Version profiles explicitly** — even if "just thresholds"

## Result Metadata

Every result includes version information:

```ts
result.meta = {
  decision: {
    id: "currency-exposure-risk",
    version: "1.2.0"
  },
  profile: {
    id: "high-inflation-emerging",
    version: "1.0.0"
  },
  // ... other metadata
}
```

This enables auditing and debugging across versions.
