# Decision Patterns

Formal taxonomy of decision patterns in Criterion.

Each pattern is a reusable shape for modeling a category of decisions.

---

## Pattern 1: Threshold

### Definition

Compare a numeric value against one or more boundaries to classify or permit.

```
if value >= threshold → action A
else → action B
```

### When to Use

- Amount limits (transaction size, file size)
- Score-based classification (credit score, risk score)
- Time-based cutoffs (account age, session duration)
- Quantity checks (item count, request count)

### Schema Shape

```typescript
input: {
  value: number          // The value to compare
  // ... other context
}

profile: {
  threshold: number      // The boundary (or multiple thresholds)
}

output: {
  classification: string // Which side of threshold
  // or
  allowed: boolean
}
```

### Rule Structure

Rules ordered from highest threshold to lowest, with catch-all last:

```typescript
rules: [
  {
    id: "above-high",
    when: (ctx, p) => ctx.value >= p.highThreshold,
    emit: () => ({ level: "high" }),
    explain: (ctx, p) => `${ctx.value} >= high threshold ${p.highThreshold}`
  },
  {
    id: "above-medium",
    when: (ctx, p) => ctx.value >= p.mediumThreshold,
    emit: () => ({ level: "medium" }),
    explain: (ctx, p) => `${ctx.value} >= medium threshold ${p.mediumThreshold}`
  },
  {
    id: "below-all",
    when: () => true,
    emit: () => ({ level: "low" }),
    explain: (ctx, p) => `${ctx.value} < medium threshold ${p.mediumThreshold}`
  }
]
```

### Example: Transaction Amount Check

```typescript
const transactionLimit = defineDecision({
  id: "transaction-limit",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number().positive(),
    currency: z.string()
  }),
  profileSchema: z.object({
    maxAmount: z.number().positive(),
    warningThreshold: z.number().positive()
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    warning: z.boolean(),
    reason: z.string()
  }),
  rules: [
    {
      id: "exceeds-max",
      when: (ctx, p) => ctx.amount > p.maxAmount,
      emit: () => ({ allowed: false, warning: false }),
      explain: (ctx, p) => `Amount ${ctx.amount} exceeds maximum ${p.maxAmount}`
    },
    {
      id: "above-warning",
      when: (ctx, p) => ctx.amount > p.warningThreshold,
      emit: () => ({ allowed: true, warning: true }),
      explain: (ctx, p) => `Amount ${ctx.amount} above warning threshold ${p.warningThreshold}`
    },
    {
      id: "normal",
      when: () => true,
      emit: () => ({ allowed: true, warning: false }),
      explain: (ctx) => `Amount ${ctx.amount} within normal limits`
    }
  ]
});
```

### Decisions Using This Pattern

- check-api-quota
- can-upload-file
- assess-transaction-risk (partial)
- calculate-discount (bulk threshold)

---

## Pattern 2: Boolean Gate

### Definition

Evaluate a condition to produce a yes/no decision.

```
if condition → allowed: true
else → allowed: false
```

### When to Use

- Permission checks (can user X do Y?)
- Feature flags (is feature enabled?)
- Eligibility (does user qualify?)
- Simple on/off decisions

### Schema Shape

```typescript
input: {
  // All facts needed to evaluate condition
}

profile: {
  // Flags, settings that control the gate
}

output: {
  allowed: boolean
  reason: string
}
```

### Rule Structure

Typically has explicit allow rules and a default deny (or vice versa):

```typescript
rules: [
  // Explicit allows (order by specificity)
  {
    id: "owner-always-allowed",
    when: (ctx) => ctx.isOwner,
    emit: () => ({ allowed: true }),
    explain: () => "Resource owner always has access"
  },
  {
    id: "admin-allowed",
    when: (ctx) => ctx.role === "admin",
    emit: () => ({ allowed: true }),
    explain: () => "Admins have full access"
  },
  // Default deny
  {
    id: "default-deny",
    when: () => true,
    emit: () => ({ allowed: false }),
    explain: (ctx) => `Role ${ctx.role} does not have access`
  }
]
```

### Example: Can Edit Resource

```typescript
const canEditResource = defineDecision({
  id: "can-edit-resource",
  version: "1.0.0",
  inputSchema: z.object({
    userId: z.string(),
    resourceId: z.string(),
    userRole: z.enum(["admin", "editor", "viewer"]),
    isOwner: z.boolean(),
    resourceLocked: z.boolean()
  }),
  profileSchema: z.object({
    allowEditLocked: z.boolean()
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    reason: z.string()
  }),
  rules: [
    {
      id: "locked-blocked",
      when: (ctx, p) => ctx.resourceLocked && !p.allowEditLocked,
      emit: () => ({ allowed: false }),
      explain: () => "Resource is locked and editing locked resources is disabled"
    },
    {
      id: "owner-allowed",
      when: (ctx) => ctx.isOwner,
      emit: () => ({ allowed: true }),
      explain: () => "Resource owner can always edit"
    },
    {
      id: "admin-allowed",
      when: (ctx) => ctx.userRole === "admin",
      emit: () => ({ allowed: true }),
      explain: () => "Admins can edit all resources"
    },
    {
      id: "editor-allowed",
      when: (ctx) => ctx.userRole === "editor",
      emit: () => ({ allowed: true }),
      explain: () => "Editors can edit resources"
    },
    {
      id: "viewer-denied",
      when: () => true,
      emit: () => ({ allowed: false }),
      explain: (ctx) => `Role ${ctx.userRole} cannot edit resources`
    }
  ]
});
```

### Decisions Using This Pattern

- can-view-dashboard
- can-edit-resource
- can-invite-users
- can-access-feature
- can-publish-content

---

## Pattern 3: Tier-Based

### Definition

Map a user's tier/plan to specific limits, permissions, or behaviors.

```
tier → { limits, features, permissions }
```

### When to Use

- SaaS plan differentiation
- Role-based permissions
- Subscription levels
- Customer segmentation

### Schema Shape

```typescript
input: {
  tier: "free" | "starter" | "pro" | "enterprise"
  // ... action being attempted
}

profile: {
  tierConfig: Record<Tier, {
    limits: { ... }
    features: string[]
    permissions: string[]
  }>
}

output: {
  allowed: boolean
  limit: number
  availableFeatures: string[]
}
```

### Rule Structure

One rule per tier, ordered from highest to lowest (most permissive first):

```typescript
rules: [
  {
    id: "enterprise",
    when: (ctx) => ctx.tier === "enterprise",
    emit: (ctx, p) => ({
      maxProjects: p.tierConfig.enterprise.maxProjects,
      features: p.tierConfig.enterprise.features
    }),
    explain: () => "Enterprise tier: unlimited access"
  },
  {
    id: "pro",
    when: (ctx) => ctx.tier === "pro",
    emit: (ctx, p) => ({
      maxProjects: p.tierConfig.pro.maxProjects,
      features: p.tierConfig.pro.features
    }),
    explain: (ctx, p) => `Pro tier: ${p.tierConfig.pro.maxProjects} projects`
  },
  // ... starter, free
]
```

### Example: Project Limit by Plan

```typescript
const projectLimit = defineDecision({
  id: "project-limit",
  version: "1.0.0",
  inputSchema: z.object({
    userPlan: z.enum(["free", "starter", "pro", "enterprise"]),
    currentProjectCount: z.number().int().nonnegative()
  }),
  profileSchema: z.object({
    limits: z.object({
      free: z.number().int(),
      starter: z.number().int(),
      pro: z.number().int(),
      enterprise: z.number().int() // -1 = unlimited
    })
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    reason: z.string(),
    maxAllowed: z.number(),
    remaining: z.number()
  }),
  rules: [
    {
      id: "enterprise-unlimited",
      when: (ctx, p) => ctx.userPlan === "enterprise" && p.limits.enterprise === -1,
      emit: (ctx) => ({
        allowed: true,
        maxAllowed: -1,
        remaining: -1
      }),
      explain: () => "Enterprise plan has unlimited projects"
    },
    {
      id: "within-limit",
      when: (ctx, p) => ctx.currentProjectCount < p.limits[ctx.userPlan],
      emit: (ctx, p) => ({
        allowed: true,
        maxAllowed: p.limits[ctx.userPlan],
        remaining: p.limits[ctx.userPlan] - ctx.currentProjectCount
      }),
      explain: (ctx, p) =>
        `${ctx.currentProjectCount}/${p.limits[ctx.userPlan]} projects used on ${ctx.userPlan} plan`
    },
    {
      id: "at-limit",
      when: () => true,
      emit: (ctx, p) => ({
        allowed: false,
        maxAllowed: p.limits[ctx.userPlan],
        remaining: 0
      }),
      explain: (ctx, p) =>
        `Reached ${p.limits[ctx.userPlan]} project limit on ${ctx.userPlan} plan`
    }
  ]
});
```

### Decisions Using This Pattern

- can-create-project
- check-api-quota
- can-use-premium-feature
- determine-pricing-tier

---

## Pattern 4: Quota

### Definition

Track usage against a limit and return remaining capacity.

```
if usage < limit → { allowed: true, remaining: limit - usage }
else → { allowed: false, remaining: 0, retryAfter: ... }
```

### When to Use

- API rate limiting
- Storage quotas
- Action limits (invites, exports)
- Time-windowed constraints

### Schema Shape

```typescript
input: {
  currentUsage: number
  requestedAmount: number  // how much this action will consume
  windowStart?: string     // for time-based quotas
}

profile: {
  limit: number
  windowDuration?: number  // seconds
  overage: {
    allowed: boolean
    multiplier: number     // cost multiplier for overage
  }
}

output: {
  allowed: boolean
  remaining: number
  retryAfter: number | null  // seconds until quota resets
  reason: string
}
```

### Rule Structure

```typescript
rules: [
  {
    id: "within-quota",
    when: (ctx, p) => ctx.currentUsage + ctx.requestedAmount <= p.limit,
    emit: (ctx, p) => ({
      allowed: true,
      remaining: p.limit - ctx.currentUsage - ctx.requestedAmount,
      retryAfter: null
    }),
    explain: (ctx, p) =>
      `Usage ${ctx.currentUsage + ctx.requestedAmount}/${p.limit} within quota`
  },
  {
    id: "overage-allowed",
    when: (ctx, p) => p.overage.allowed,
    emit: (ctx, p) => ({
      allowed: true,
      remaining: 0,
      retryAfter: null,
      overageCost: ctx.requestedAmount * p.overage.multiplier
    }),
    explain: (ctx, p) =>
      `Quota exceeded but overage allowed at ${p.overage.multiplier}x rate`
  },
  {
    id: "quota-exceeded",
    when: () => true,
    emit: (ctx, p) => ({
      allowed: false,
      remaining: 0,
      retryAfter: calculateRetryAfter(ctx.windowStart, p.windowDuration)
    }),
    explain: (ctx, p) =>
      `Quota ${p.limit} exceeded, current usage: ${ctx.currentUsage}`
  }
]
```

### Example: API Rate Limit

```typescript
const apiRateLimit = defineDecision({
  id: "api-rate-limit",
  version: "1.0.0",
  inputSchema: z.object({
    callsInWindow: z.number().int().nonnegative(),
    windowStartTime: z.string(),
    currentTime: z.string(),
    userTier: z.enum(["free", "paid", "enterprise"])
  }),
  profileSchema: z.object({
    windowSeconds: z.number().int().positive(),
    limits: z.object({
      free: z.number().int(),
      paid: z.number().int(),
      enterprise: z.number().int()
    })
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    remaining: z.number(),
    retryAfter: z.number().nullable(),
    reason: z.string()
  }),
  rules: [
    {
      id: "within-limit",
      when: (ctx, p) => ctx.callsInWindow < p.limits[ctx.userTier],
      emit: (ctx, p) => ({
        allowed: true,
        remaining: p.limits[ctx.userTier] - ctx.callsInWindow - 1,
        retryAfter: null
      }),
      explain: (ctx, p) =>
        `${ctx.callsInWindow + 1}/${p.limits[ctx.userTier]} calls used`
    },
    {
      id: "limit-exceeded",
      when: () => true,
      emit: (ctx, p) => {
        const windowStart = new Date(ctx.windowStartTime).getTime();
        const now = new Date(ctx.currentTime).getTime();
        const elapsed = (now - windowStart) / 1000;
        const retryAfter = Math.max(0, p.windowSeconds - elapsed);
        return {
          allowed: false,
          remaining: 0,
          retryAfter: Math.ceil(retryAfter)
        };
      },
      explain: (ctx, p) =>
        `Rate limit ${p.limits[ctx.userTier]} exceeded for ${ctx.userTier} tier`
    }
  ]
});
```

### Decisions Using This Pattern

- check-api-quota
- check-rate-limit
- can-upload-file (storage quota)
- can-invite-users (invite quota)

---

## Pattern 5: State Machine

### Definition

Validate state transitions based on current state, requested state, and permissions.

```
if transition(current → requested) is valid for role → allowed
else → blocked with reason
```

### When to Use

- Workflow status changes
- Document lifecycle
- Order processing
- Approval flows

### Schema Shape

```typescript
input: {
  currentState: string
  requestedState: string
  actorRole: string
  // ... additional context
}

profile: {
  transitions: Record<string, string[]>  // state → allowed next states
  rolePermissions: Record<string, string[]>  // role → allowed transitions
}

output: {
  allowed: boolean
  reason: string
  validTransitions: string[]  // what states ARE available
}
```

### Rule Structure

```typescript
rules: [
  {
    id: "same-state",
    when: (ctx) => ctx.currentState === ctx.requestedState,
    emit: () => ({ allowed: true }),
    explain: (ctx) => `Already in state ${ctx.currentState}`
  },
  {
    id: "invalid-transition",
    when: (ctx, p) => !p.transitions[ctx.currentState]?.includes(ctx.requestedState),
    emit: (ctx, p) => ({
      allowed: false,
      validTransitions: p.transitions[ctx.currentState] || []
    }),
    explain: (ctx, p) =>
      `Cannot transition from ${ctx.currentState} to ${ctx.requestedState}. ` +
      `Valid: ${p.transitions[ctx.currentState]?.join(", ") || "none"}`
  },
  {
    id: "role-not-permitted",
    when: (ctx, p) => {
      const transitionKey = `${ctx.currentState}→${ctx.requestedState}`;
      return !p.rolePermissions[ctx.actorRole]?.includes(transitionKey);
    },
    emit: (ctx, p) => ({
      allowed: false,
      validTransitions: p.transitions[ctx.currentState] || []
    }),
    explain: (ctx) =>
      `Role ${ctx.actorRole} cannot perform ${ctx.currentState}→${ctx.requestedState}`
  },
  {
    id: "transition-allowed",
    when: () => true,
    emit: () => ({ allowed: true }),
    explain: (ctx) => `Transition ${ctx.currentState}→${ctx.requestedState} permitted`
  }
]
```

### Example: Document Status

```typescript
const documentStatus = defineDecision({
  id: "document-status-change",
  version: "1.0.0",
  inputSchema: z.object({
    currentStatus: z.enum(["draft", "review", "approved", "published", "archived"]),
    requestedStatus: z.enum(["draft", "review", "approved", "published", "archived"]),
    userRole: z.enum(["author", "reviewer", "admin"])
  }),
  profileSchema: z.object({
    transitions: z.record(z.array(z.string())),
    rolePermissions: z.record(z.array(z.string()))
  }),
  outputSchema: z.object({
    allowed: z.boolean(),
    reason: z.string(),
    validNextStates: z.array(z.string())
  }),
  rules: [
    {
      id: "same-status",
      when: (ctx) => ctx.currentStatus === ctx.requestedStatus,
      emit: (ctx, p) => ({
        allowed: true,
        validNextStates: p.transitions[ctx.currentStatus] || []
      }),
      explain: (ctx) => `Document already in ${ctx.currentStatus} status`
    },
    {
      id: "invalid-transition",
      when: (ctx, p) =>
        !p.transitions[ctx.currentStatus]?.includes(ctx.requestedStatus),
      emit: (ctx, p) => ({
        allowed: false,
        validNextStates: p.transitions[ctx.currentStatus] || []
      }),
      explain: (ctx, p) =>
        `Cannot move from ${ctx.currentStatus} to ${ctx.requestedStatus}. ` +
        `Valid transitions: ${p.transitions[ctx.currentStatus]?.join(", ")}`
    },
    {
      id: "role-blocked",
      when: (ctx, p) => {
        const transition = `${ctx.currentStatus}→${ctx.requestedStatus}`;
        return !p.rolePermissions[ctx.userRole]?.includes(transition);
      },
      emit: (ctx, p) => ({
        allowed: false,
        validNextStates: p.transitions[ctx.currentStatus] || []
      }),
      explain: (ctx) =>
        `Role ${ctx.userRole} cannot transition from ${ctx.currentStatus} to ${ctx.requestedStatus}`
    },
    {
      id: "allowed",
      when: () => true,
      emit: (ctx, p) => ({
        allowed: true,
        validNextStates: p.transitions[ctx.requestedStatus] || []
      }),
      explain: (ctx) =>
        `Transition ${ctx.currentStatus}→${ctx.requestedStatus} approved`
    }
  ]
});
```

### Profile Example

```typescript
const workflowProfile = {
  transitions: {
    draft: ["review"],
    review: ["draft", "approved"],
    approved: ["published", "review"],
    published: ["archived"],
    archived: []  // terminal state
  },
  rolePermissions: {
    author: ["draft→review"],
    reviewer: ["review→draft", "review→approved"],
    admin: [
      "draft→review", "review→draft", "review→approved",
      "approved→published", "approved→review", "published→archived"
    ]
  }
};
```

### Decisions Using This Pattern

- can-change-status
- check-onboarding-complete
- determine-next-action

---

## Pattern 6: Composite

### Definition

Evaluate multiple factors to produce a score or weighted decision.

```
factors[] → weighted evaluation → classification + action
```

### When to Use

- Risk assessment
- Fraud detection
- Credit scoring
- Complex eligibility
- Multi-factor decisions

### Schema Shape

```typescript
input: {
  factors: {
    factor1: number | boolean | string
    factor2: number | boolean | string
    // ... many factors
  }
}

profile: {
  weights: Record<string, number>
  thresholds: {
    high: number
    medium: number
  }
  rules: {
    // factor-specific rules
  }
}

output: {
  score: number
  level: "low" | "medium" | "high" | "critical"
  flags: string[]
  action: string
  reason: string
}
```

### Rule Structure

Composite patterns typically use a scoring function, then threshold rules:

```typescript
// Helper: Calculate composite score (pure function)
function calculateRiskScore(ctx: Input, profile: Profile): number {
  let score = 0;

  // Factor contributions
  if (ctx.isNewAccount) score += profile.weights.newAccount;
  if (ctx.amountAboveAverage) score += profile.weights.highAmount;
  if (ctx.countryMismatch) score += profile.weights.countryMismatch;
  if (ctx.unusualTime) score += profile.weights.unusualTime;

  return Math.min(100, score);
}

rules: [
  {
    id: "critical-risk",
    when: (ctx, p) => calculateRiskScore(ctx, p) >= p.thresholds.critical,
    emit: (ctx, p) => ({
      score: calculateRiskScore(ctx, p),
      level: "critical",
      action: "block"
    }),
    explain: (ctx, p) =>
      `Risk score ${calculateRiskScore(ctx, p)} >= critical threshold ${p.thresholds.critical}`
  },
  {
    id: "high-risk",
    when: (ctx, p) => calculateRiskScore(ctx, p) >= p.thresholds.high,
    emit: (ctx, p) => ({
      score: calculateRiskScore(ctx, p),
      level: "high",
      action: "review"
    }),
    explain: (ctx, p) =>
      `Risk score ${calculateRiskScore(ctx, p)} >= high threshold ${p.thresholds.high}`
  },
  // ... medium, low
]
```

### Example: Transaction Risk

```typescript
// Pure scoring function - no side effects
function computeRiskScore(
  ctx: TransactionInput,
  profile: RiskProfile
): { score: number; flags: string[] } {
  let score = 0;
  const flags: string[] = [];

  // Amount factor
  if (ctx.amount > profile.highAmountThreshold) {
    score += profile.weights.highAmount;
    flags.push("high-amount");
  }

  // New account factor
  if (ctx.accountAgeDays < profile.newAccountDays) {
    score += profile.weights.newAccount;
    flags.push("new-account");
  }

  // Country mismatch
  if (ctx.ipCountry !== ctx.billingCountry) {
    score += profile.weights.countryMismatch;
    flags.push("country-mismatch");
  }

  // New payment method
  if (ctx.isNewPaymentMethod) {
    score += profile.weights.newPaymentMethod;
    flags.push("new-payment-method");
  }

  // Unusual hour
  if (ctx.hourOfDay < 6 || ctx.hourOfDay > 22) {
    score += profile.weights.unusualHour;
    flags.push("unusual-hour");
  }

  return { score: Math.min(100, score), flags };
}

const transactionRisk = defineDecision({
  id: "transaction-risk",
  version: "1.0.0",
  inputSchema: z.object({
    amount: z.number().positive(),
    accountAgeDays: z.number().int().nonnegative(),
    ipCountry: z.string(),
    billingCountry: z.string(),
    isNewPaymentMethod: z.boolean(),
    hourOfDay: z.number().int().min(0).max(23)
  }),
  profileSchema: z.object({
    weights: z.object({
      highAmount: z.number(),
      newAccount: z.number(),
      countryMismatch: z.number(),
      newPaymentMethod: z.number(),
      unusualHour: z.number()
    }),
    thresholds: z.object({
      critical: z.number(),
      high: z.number(),
      medium: z.number()
    }),
    highAmountThreshold: z.number(),
    newAccountDays: z.number()
  }),
  outputSchema: z.object({
    score: z.number(),
    level: z.enum(["low", "medium", "high", "critical"]),
    flags: z.array(z.string()),
    action: z.enum(["allow", "review", "challenge", "block"]),
    reason: z.string()
  }),
  rules: [
    {
      id: "critical",
      when: (ctx, p) => computeRiskScore(ctx, p).score >= p.thresholds.critical,
      emit: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return { score, flags, level: "critical", action: "block" };
      },
      explain: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return `Risk score ${score} (critical). Flags: ${flags.join(", ")}`;
      }
    },
    {
      id: "high",
      when: (ctx, p) => computeRiskScore(ctx, p).score >= p.thresholds.high,
      emit: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return { score, flags, level: "high", action: "review" };
      },
      explain: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return `Risk score ${score} (high). Flags: ${flags.join(", ")}`;
      }
    },
    {
      id: "medium",
      when: (ctx, p) => computeRiskScore(ctx, p).score >= p.thresholds.medium,
      emit: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return { score, flags, level: "medium", action: "challenge" };
      },
      explain: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return `Risk score ${score} (medium). Flags: ${flags.join(", ")}`;
      }
    },
    {
      id: "low",
      when: () => true,
      emit: (ctx, p) => {
        const { score, flags } = computeRiskScore(ctx, p);
        return { score, flags, level: "low", action: "allow" };
      },
      explain: (ctx, p) => {
        const { score } = computeRiskScore(ctx, p);
        return `Risk score ${score} (low). Transaction allowed.`;
      }
    }
  ]
});
```

### Key Principle: Pure Scoring Function

The scoring function MUST be pure:
- No side effects
- Same inputs → same output
- Can be tested independently

```typescript
// Test the scoring function directly
it("calculates risk correctly", () => {
  const ctx = { amount: 5000, accountAgeDays: 3, ... };
  const profile = { weights: { ... }, thresholds: { ... } };

  const result = computeRiskScore(ctx, profile);

  expect(result.score).toBe(45);
  expect(result.flags).toContain("new-account");
});
```

### Decisions Using This Pattern

- assess-transaction-risk
- flag-or-block
- compliance-check
- require-verification

---

## Pattern Selection Guide

| Question | Pattern |
|----------|---------|
| Is it a numeric comparison? | **Threshold** |
| Is it yes/no permission? | **Boolean Gate** |
| Does it vary by plan/role? | **Tier-Based** |
| Is it usage vs limit? | **Quota** |
| Is it a status transition? | **State Machine** |
| Are there multiple weighted factors? | **Composite** |

### Pattern Combinations

Many real decisions combine patterns:

| Decision | Primary | Secondary |
|----------|---------|-----------|
| can-upload-file | Quota | Threshold (size) |
| check-api-quota | Quota | Tier-Based |
| assess-transaction-risk | Composite | Threshold |
| can-publish-content | Boolean Gate | State Machine |

---

## Next Steps

1. Implement one reference decision per pattern
2. Create test fixtures for each pattern
3. Document common mistakes per pattern
