# Pricing & Limits with Criterion

Implement SaaS tier limits, usage quotas, and paywall decisions with full auditability.

## The Problem

Every SaaS needs to answer questions like:
- Can this user create more projects?
- What's their API rate limit?
- Should we show an upgrade prompt?
- Can they access this premium feature?

These rules are often scattered across the codebase and hard to maintain.

## Solution: Centralized Limit Decisions

### Usage Limit Decision

```typescript
import { defineDecision, Engine } from "@criterionx/core";
import { z } from "zod";

const usageLimitDecision = defineDecision({
  id: "usage-limit",
  version: "1.0.0",
  inputSchema: z.object({
    resource: z.enum(["projects", "team_members", "api_calls", "storage_gb", "alerts"]),
    currentUsage: z.number().int().min(0),
    requestedAmount: z.number().int().min(1).default(1),
    plan: z.enum(["free", "starter", "pro", "enterprise"]),
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    remaining: z.number(),
    limit: z.number(),
    upgradeRequired: z.boolean(),
    suggestedPlan: z.enum(["starter", "pro", "enterprise"]).optional(),
    message: z.string(),
  }),
  profileSchema: z.object({
    limits: z.object({
      free: z.record(z.number()),
      starter: z.record(z.number()),
      pro: z.record(z.number()),
      enterprise: z.record(z.number()),
    }),
  }),
  rules: [
    {
      id: "enterprise-unlimited",
      when: (input) => input.plan === "enterprise",
      emit: (input, profile) => {
        const limit = profile.limits.enterprise[input.resource] ?? Infinity;
        return {
          allowed: true,
          remaining: limit === Infinity ? Infinity : limit - input.currentUsage,
          limit,
          upgradeRequired: false,
          message: "Enterprise plan - unlimited access",
        };
      },
      explain: () => "Enterprise plan has unlimited access",
    },
    {
      id: "within-limit",
      when: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource] ?? 0;
        return input.currentUsage + input.requestedAmount <= limit;
      },
      emit: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        return {
          allowed: true,
          remaining: limit - input.currentUsage - input.requestedAmount,
          limit,
          upgradeRequired: false,
          message: `${limit - input.currentUsage - input.requestedAmount} ${input.resource} remaining`,
        };
      },
      explain: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        return `Usage ${input.currentUsage} + ${input.requestedAmount} <= limit ${limit}`;
      },
    },
    {
      id: "approaching-limit",
      when: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource] ?? 0;
        const usage = input.currentUsage + input.requestedAmount;
        return usage > limit * 0.8 && usage <= limit;
      },
      emit: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        const nextPlan = getNextPlan(input.plan);
        return {
          allowed: true,
          remaining: limit - input.currentUsage - input.requestedAmount,
          limit,
          upgradeRequired: false,
          suggestedPlan: nextPlan,
          message: `Approaching limit. Consider upgrading to ${nextPlan}.`,
        };
      },
      explain: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        return `Usage at ${Math.round((input.currentUsage / limit) * 100)}% of limit`;
      },
    },
    {
      id: "over-limit",
      when: () => true,
      emit: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        const nextPlan = getNextPlan(input.plan);
        return {
          allowed: false,
          remaining: 0,
          limit,
          upgradeRequired: true,
          suggestedPlan: nextPlan,
          message: `${input.resource} limit reached. Upgrade to ${nextPlan} for more.`,
        };
      },
      explain: (input, profile) => {
        const limit = profile.limits[input.plan][input.resource];
        return `Requested ${input.currentUsage + input.requestedAmount} exceeds limit ${limit}`;
      },
    },
  ],
});

function getNextPlan(current: string): "starter" | "pro" | "enterprise" {
  const upgrades: Record<string, "starter" | "pro" | "enterprise"> = {
    free: "starter",
    starter: "pro",
    pro: "enterprise",
    enterprise: "enterprise",
  };
  return upgrades[current];
}
```

### Profile Configuration

```typescript
const pricingProfile = {
  limits: {
    free: {
      projects: 3,
      team_members: 1,
      api_calls: 1000,      // per month
      storage_gb: 1,
      alerts: 5,
    },
    starter: {
      projects: 10,
      team_members: 5,
      api_calls: 10000,
      storage_gb: 10,
      alerts: 25,
    },
    pro: {
      projects: 50,
      team_members: 25,
      api_calls: 100000,
      storage_gb: 100,
      alerts: 100,
    },
    enterprise: {
      projects: Infinity,
      team_members: Infinity,
      api_calls: Infinity,
      storage_gb: Infinity,
      alerts: Infinity,
    },
  },
};
```

## Usage Examples

### Check Before Creating Resource

```typescript
const engine = new Engine();

async function createProject(userId: string, projectData: ProjectData) {
  const user = await getUser(userId);
  const projectCount = await countUserProjects(userId);

  const result = engine.run(usageLimitDecision, {
    resource: "projects",
    currentUsage: projectCount,
    requestedAmount: 1,
    plan: user.plan,
  }, { profile: pricingProfile });

  if (!result.data.allowed) {
    throw new UpgradeRequiredError(result.data.message, {
      suggestedPlan: result.data.suggestedPlan,
      currentLimit: result.data.limit,
    });
  }

  // Proceed with creation
  return await db.projects.create(projectData);
}
```

### API Rate Limiting

```typescript
import { createServer } from "@criterionx/server";

// Decision for API rate limits
const apiRateLimitDecision = defineDecision({
  id: "api-rate-limit",
  version: "1.0.0",
  inputSchema: z.object({
    plan: z.enum(["free", "starter", "pro", "enterprise"]),
  }),
  outputSchema: z.object({
    requestsPerMinute: z.number(),
    requestsPerDay: z.number(),
    burstLimit: z.number(),
  }),
  profileSchema: z.object({
    rateLimits: z.record(z.object({
      perMinute: z.number(),
      perDay: z.number(),
      burst: z.number(),
    })),
  }),
  rules: [
    {
      id: "get-limits",
      when: () => true,
      emit: (input, profile) => {
        const limits = profile.rateLimits[input.plan];
        return {
          requestsPerMinute: limits.perMinute,
          requestsPerDay: limits.perDay,
          burstLimit: limits.burst,
        };
      },
      explain: (input) => `Rate limits for ${input.plan} plan`,
    },
  ],
});

// Use in middleware
async function rateLimitMiddleware(req, res, next) {
  const user = req.user;
  const result = engine.run(apiRateLimitDecision, {
    plan: user.plan,
  }, { profile: rateLimitProfile });

  // Apply the limits
  req.rateLimit = {
    max: result.data.requestsPerMinute,
    windowMs: 60000,
  };
  next();
}
```

### React Component

```tsx
import { useDecision } from "@criterionx/react";

function UsageDisplay({ resource }: { resource: string }) {
  const [usage, setUsage] = useState<number>(0);
  const { result, evaluate, isLoading } = useDecision("usage-limit");

  useEffect(() => {
    // Fetch current usage
    fetchUsage(resource).then(setUsage);
  }, [resource]);

  useEffect(() => {
    if (usage !== undefined) {
      evaluate({
        resource,
        currentUsage: usage,
        requestedAmount: 0,  // Just checking status
        plan: currentUser.plan,
      });
    }
  }, [resource, usage]);

  if (isLoading || !result) return <Skeleton />;

  const { remaining, limit, upgradeRequired, suggestedPlan } = result.data;
  const usagePercent = ((limit - remaining) / limit) * 100;

  return (
    <div>
      <ProgressBar value={usagePercent} />
      <span>{limit - remaining} / {limit} {resource}</span>

      {upgradeRequired && (
        <UpgradeBanner plan={suggestedPlan} />
      )}

      {usagePercent > 80 && !upgradeRequired && (
        <WarningBanner>
          You're approaching your {resource} limit.
          <UpgradeLink plan={suggestedPlan} />
        </WarningBanner>
      )}
    </div>
  );
}
```

### Dashboard Overview

```tsx
function PlanOverview() {
  const resources = ["projects", "team_members", "api_calls", "storage_gb"];

  return (
    <div className="grid grid-cols-2 gap-4">
      {resources.map((resource) => (
        <UsageCard key={resource} resource={resource} />
      ))}
    </div>
  );
}

function UsageCard({ resource }: { resource: string }) {
  const { result, evaluate } = useDecision("usage-limit");

  // ... fetch and evaluate

  return (
    <Card>
      <CardHeader>
        <Icon name={resource} />
        <span>{formatResourceName(resource)}</span>
      </CardHeader>
      <CardBody>
        <CircularProgress value={usagePercent} />
        <span>{remaining} remaining</span>
      </CardBody>
      {result?.data.suggestedPlan && (
        <CardFooter>
          <UpgradeButton plan={result.data.suggestedPlan} />
        </CardFooter>
      )}
    </Card>
  );
}
```

## Express API

```typescript
import { createDecisionRouter } from "@criterionx/express";

const router = createDecisionRouter({
  decisions: [usageLimitDecision, apiRateLimitDecision],
  profiles: {
    "usage-limit": pricingProfile,
    "api-rate-limit": rateLimitProfile,
  },
});

app.use("/api/limits", router);

// Endpoints:
// POST /api/limits/usage-limit
// POST /api/limits/api-rate-limit
```

## Testing

```typescript
describe("usage limits", () => {
  const engine = new Engine();

  describe("project limits", () => {
    it("allows creation within limit", () => {
      const result = engine.run(usageLimitDecision, {
        resource: "projects",
        currentUsage: 2,
        requestedAmount: 1,
        plan: "free",
      }, { profile: pricingProfile });

      expect(result.data.allowed).toBe(true);
      expect(result.data.remaining).toBe(0); // 3 - 2 - 1 = 0
    });

    it("blocks creation over limit", () => {
      const result = engine.run(usageLimitDecision, {
        resource: "projects",
        currentUsage: 3,
        requestedAmount: 1,
        plan: "free",
      }, { profile: pricingProfile });

      expect(result.data.allowed).toBe(false);
      expect(result.data.upgradeRequired).toBe(true);
      expect(result.data.suggestedPlan).toBe("starter");
    });

    it("warns when approaching limit", () => {
      const result = engine.run(usageLimitDecision, {
        resource: "projects",
        currentUsage: 8,  // 80% of starter's 10
        requestedAmount: 1,
        plan: "starter",
      }, { profile: pricingProfile });

      expect(result.data.allowed).toBe(true);
      expect(result.data.suggestedPlan).toBe("pro");
      expect(result.matchedRule).toBe("approaching-limit");
    });

    it("grants unlimited to enterprise", () => {
      const result = engine.run(usageLimitDecision, {
        resource: "projects",
        currentUsage: 1000,
        requestedAmount: 100,
        plan: "enterprise",
      }, { profile: pricingProfile });

      expect(result.data.allowed).toBe(true);
      expect(result.matchedRule).toBe("enterprise-unlimited");
    });
  });
});
```

## Audit Trail

Every limit check is explainable:

```typescript
const result = engine.run(usageLimitDecision, {
  resource: "projects",
  currentUsage: 3,
  requestedAmount: 1,
  plan: "free",
}, { profile: pricingProfile });

console.log(engine.explain(result));
// Decision: usage-limit v1.0.0
// Status: OK
// Matched: over-limit
// Reason: Requested 4 exceeds limit 3
```

Log these for support debugging:
```typescript
logger.info("Limit check", {
  userId: user.id,
  resource: "projects",
  result: result.data,
  explanation: engine.explain(result),
});
```

## Next Steps

- [Feature Flags](/examples/feature-flags) — Simpler boolean toggles
- [Express Integration](/api/express) — Full middleware docs
- [Profiles](/guide/profiles) — Per-tenant pricing tiers
