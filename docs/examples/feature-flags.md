# Feature Flags with Criterion

Use Criterion as a lightweight, self-hosted feature flag system with full auditability.

## When to Use This Approach

Choose Criterion over LaunchDarkly/Unleash/Split when:

- You need **audit trails** for compliance
- You want **type-safe** flag definitions
- You prefer **self-hosted** without external dependencies
- You need **complex rules** beyond simple boolean toggles
- You want **explainability** for why a flag was enabled/disabled

## Basic Feature Flag

```typescript
import { defineDecision, Engine } from "@criterionx/core";
import { z } from "zod";

const featureAccess = defineDecision({
  id: "feature-access",
  version: "1.0.0",
  inputSchema: z.object({
    userId: z.string(),
    userPlan: z.enum(["free", "pro", "enterprise"]),
    feature: z.string(),
    betaOptIn: z.boolean().optional(),
  }),
  outputSchema: z.object({
    enabled: z.boolean(),
    reason: z.string(),
  }),
  profileSchema: z.object({
    features: z.record(z.object({
      plans: z.array(z.enum(["free", "pro", "enterprise"])),
      betaOnly: z.boolean().optional(),
      rolloutPercent: z.number().min(0).max(100).optional(),
    })),
  }),
  rules: [
    {
      id: "feature-not-defined",
      when: (input, profile) => !(input.feature in profile.features),
      emit: () => ({ enabled: false, reason: "Feature not configured" }),
      explain: (input) => `Feature "${input.feature}" not in configuration`,
    },
    {
      id: "beta-required",
      when: (input, profile) => {
        const config = profile.features[input.feature];
        return config.betaOnly === true && !input.betaOptIn;
      },
      emit: () => ({ enabled: false, reason: "Beta opt-in required" }),
      explain: (input) => `Feature "${input.feature}" requires beta opt-in`,
    },
    {
      id: "plan-not-allowed",
      when: (input, profile) => {
        const config = profile.features[input.feature];
        return !config.plans.includes(input.userPlan);
      },
      emit: (input) => ({
        enabled: false,
        reason: `Not available on ${input.userPlan} plan`,
      }),
      explain: (input, profile) => {
        const config = profile.features[input.feature];
        return `Plan "${input.userPlan}" not in allowed plans: ${config.plans.join(", ")}`;
      },
    },
    {
      id: "rollout-check",
      when: (input, profile) => {
        const config = profile.features[input.feature];
        if (!config.rolloutPercent || config.rolloutPercent >= 100) return false;
        // Deterministic hash based on userId + feature
        const hash = simpleHash(`${input.userId}:${input.feature}`);
        return hash > config.rolloutPercent;
      },
      emit: () => ({ enabled: false, reason: "Not in rollout group" }),
      explain: (input, profile) => {
        const config = profile.features[input.feature];
        return `User not in ${config.rolloutPercent}% rollout`;
      },
    },
    {
      id: "enabled",
      when: () => true,
      emit: () => ({ enabled: true, reason: "All checks passed" }),
      explain: () => "User has access to feature",
    },
  ],
});

// Simple deterministic hash (0-100)
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}
```

## Profile Configuration

```typescript
const productionProfile = {
  features: {
    "dark-mode": {
      plans: ["free", "pro", "enterprise"],
    },
    "advanced-analytics": {
      plans: ["pro", "enterprise"],
    },
    "custom-branding": {
      plans: ["enterprise"],
    },
    "ai-assistant": {
      plans: ["pro", "enterprise"],
      betaOnly: true,
    },
    "new-dashboard": {
      plans: ["free", "pro", "enterprise"],
      rolloutPercent: 25,  // 25% of users
    },
  },
};

const stagingProfile = {
  features: {
    // All features enabled in staging
    "dark-mode": { plans: ["free", "pro", "enterprise"] },
    "advanced-analytics": { plans: ["free", "pro", "enterprise"] },
    "custom-branding": { plans: ["free", "pro", "enterprise"] },
    "ai-assistant": { plans: ["free", "pro", "enterprise"] },
    "new-dashboard": { plans: ["free", "pro", "enterprise"], rolloutPercent: 100 },
  },
};
```

## Usage

### Backend

```typescript
const engine = new Engine();

function canAccessFeature(user: User, feature: string): boolean {
  const result = engine.run(featureAccess, {
    userId: user.id,
    userPlan: user.plan,
    feature,
    betaOptIn: user.betaOptIn,
  }, {
    profile: process.env.NODE_ENV === "production"
      ? productionProfile
      : stagingProfile
  });

  // Log for debugging
  if (!result.data.enabled) {
    console.log(`Feature "${feature}" disabled for user ${user.id}: ${result.data.reason}`);
  }

  return result.data.enabled;
}

// API endpoint
app.get("/api/features/:feature", (req, res) => {
  const enabled = canAccessFeature(req.user, req.params.feature);
  res.json({ enabled });
});

// Usage in code
if (canAccessFeature(user, "advanced-analytics")) {
  // Show analytics dashboard
}
```

### React Hook

```tsx
import { CriterionProvider, useDecision } from "@criterionx/react";

// Provider setup
function App() {
  return (
    <CriterionProvider
      decisions={[featureAccess]}
      profiles={{ "feature-access": productionProfile }}
    >
      <Dashboard />
    </CriterionProvider>
  );
}

// Custom hook for features
function useFeature(feature: string) {
  const { result, evaluate } = useDecision("feature-access");

  useEffect(() => {
    evaluate({
      userId: currentUser.id,
      userPlan: currentUser.plan,
      feature,
      betaOptIn: currentUser.betaOptIn,
    });
  }, [feature, currentUser]);

  return result?.data?.enabled ?? false;
}

// Usage in components
function Dashboard() {
  const hasAnalytics = useFeature("advanced-analytics");
  const hasAI = useFeature("ai-assistant");

  return (
    <div>
      {hasAnalytics && <AnalyticsPanel />}
      {hasAI && <AIAssistant />}
    </div>
  );
}
```

## Comparison with LaunchDarkly

| Aspect | LaunchDarkly | Criterion |
|--------|--------------|-----------|
| Hosting | Cloud (SaaS) | Self-hosted |
| Pricing | Per-seat + MAU | Free (MIT) |
| UI | Dashboard | Code + optional custom UI |
| Targeting | Built-in | Custom rules |
| Audit | Yes | Yes, via `explain()` |
| Latency | Network call | Local (~0.1ms) |
| Dependencies | SDK + API | Zero external |
| Type safety | Limited | Full TypeScript |

### When LaunchDarkly is Better
- Non-technical team manages flags
- Need built-in A/B testing analytics
- Want managed infrastructure
- Need cross-platform SDKs (mobile, etc.)

### When Criterion is Better
- Compliance requires audit trails
- Complex targeting rules
- Self-hosted requirement
- Already using TypeScript
- Don't want external dependencies

## Advanced: Multiple Flags at Once

```typescript
const bulkFeatureAccess = defineDecision({
  id: "bulk-feature-access",
  version: "1.0.0",
  inputSchema: z.object({
    userId: z.string(),
    userPlan: z.enum(["free", "pro", "enterprise"]),
    features: z.array(z.string()),
    betaOptIn: z.boolean().optional(),
  }),
  outputSchema: z.object({
    features: z.record(z.boolean()),
  }),
  // ... similar logic, returns object of feature -> enabled
});

// Get all flags at once
const flags = engine.run(bulkFeatureAccess, {
  userId: user.id,
  userPlan: user.plan,
  features: ["dark-mode", "analytics", "ai-assistant"],
  betaOptIn: user.betaOptIn,
}, { profile });

// Result: { features: { "dark-mode": true, "analytics": false, ... } }
```

## Testing

```typescript
describe("feature flags", () => {
  const engine = new Engine();

  it("enables feature for allowed plan", () => {
    const result = engine.run(featureAccess, {
      userId: "user-1",
      userPlan: "pro",
      feature: "advanced-analytics",
    }, { profile: productionProfile });

    expect(result.data.enabled).toBe(true);
  });

  it("disables feature for free plan", () => {
    const result = engine.run(featureAccess, {
      userId: "user-2",
      userPlan: "free",
      feature: "advanced-analytics",
    }, { profile: productionProfile });

    expect(result.data.enabled).toBe(false);
    expect(result.data.reason).toBe("Not available on free plan");
  });

  it("requires beta opt-in for beta features", () => {
    const result = engine.run(featureAccess, {
      userId: "user-3",
      userPlan: "pro",
      feature: "ai-assistant",
      betaOptIn: false,
    }, { profile: productionProfile });

    expect(result.data.enabled).toBe(false);
    expect(result.matchedRule).toBe("beta-required");
  });

  it("provides deterministic rollout", () => {
    // Same user always gets same result
    const result1 = engine.run(featureAccess, {
      userId: "consistent-user",
      userPlan: "free",
      feature: "new-dashboard",
    }, { profile: productionProfile });

    const result2 = engine.run(featureAccess, {
      userId: "consistent-user",
      userPlan: "free",
      feature: "new-dashboard",
    }, { profile: productionProfile });

    expect(result1.data.enabled).toBe(result2.data.enabled);
  });
});
```

## Next Steps

- [Pricing & Limits](/examples/pricing-limits) — More complex SaaS rules
- [React Integration](/api/react) — Full React hook documentation
- [Profiles](/guide/profiles) — Managing feature configurations
