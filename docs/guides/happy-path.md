# Happy Path: Using Criterion Correctly

The official way to model, implement, and integrate decisions with Criterion.

---

## Step 0: Is This a Decision?

Before writing any code, ask: **Is this actually a decision?**

### It IS a Decision If:

- The logic can be expressed as: "Given X, determine Y"
- The same inputs must always produce the same output
- You need to explain WHY a result was reached
- The rules might change based on configuration (profiles)
- Multiple stakeholders care about the logic (compliance, product, engineering)

### It is NOT a Decision If:

- It requires fetching data to evaluate
- It has side effects (send email, update database)
- It depends on time, randomness, or external state
- It's a simple one-liner that never changes
- It's orchestration logic (do A, then B, then C)

### Examples

| Scenario | Decision? | Why |
|----------|-----------|-----|
| "Can user X access resource Y?" | ✅ Yes | Deterministic, needs explanation |
| "Send welcome email to new user" | ❌ No | Side effect, not a decision |
| "Calculate discount for order" | ✅ Yes | Deterministic, rules vary by profile |
| "Fetch user from database" | ❌ No | I/O, not logic |
| "Is this transaction fraudulent?" | ✅ Yes | Classification with explanation |
| "Retry failed request 3 times" | ❌ No | Orchestration, not decision |

---

## Step 1: Name the Decision

A good decision name is:

- **A question**: What are you answering?
- **Specific**: Not "validate-user" but "can-user-publish-content"
- **Domain-focused**: Uses business language, not technical

### Pattern

```
can-{actor}-{action}-{resource}
check-{metric}-{constraint}
determine-{classification}
calculate-{value}
```

### Examples

| Bad | Good | Why |
|-----|------|-----|
| `validate` | `can-user-edit-document` | Specific question |
| `check-stuff` | `check-api-quota-exceeded` | Clear constraint |
| `process-order` | `determine-order-risk-level` | Classification, not process |
| `user-logic` | `calculate-user-discount` | Specific output |

---

## Step 2: Identify the Pattern

Use the pattern selection guide:

| Question | Pattern |
|----------|---------|
| Is it a numeric comparison? | **Threshold** |
| Is it yes/no permission? | **Boolean Gate** |
| Does it vary by plan/role? | **Tier-Based** |
| Is it usage vs limit? | **Quota** |
| Is it a status transition? | **State Machine** |
| Are there multiple weighted factors? | **Composite** |

Most decisions fit one primary pattern. Some combine two.

See [patterns.md](../architecture/patterns.md) for full documentation.

---

## Step 3: Design the Schemas

### Input Schema: What Facts Do You Need?

List ONLY the facts needed to evaluate the decision. Nothing more.

```typescript
// BAD: Too much data
inputSchema: z.object({
  user: z.object({ /* entire user object */ }),
  order: z.object({ /* entire order object */ }),
})

// GOOD: Just the facts needed
inputSchema: z.object({
  userRole: z.enum(["admin", "editor", "viewer"]),
  orderTotal: z.number().positive(),
  isFirstOrder: z.boolean(),
})
```

**Rule**: Every input field MUST be used in at least one rule.

### Profile Schema: What Can Vary by Configuration?

Profiles contain thresholds, limits, and feature flags that change behavior without changing code.

```typescript
profileSchema: z.object({
  // Thresholds
  highValueThreshold: z.number(),

  // Limits
  maxItemsPerOrder: z.number(),

  // Feature flags
  allowGuestCheckout: z.boolean(),

  // Tier-specific config
  discounts: z.object({
    firstOrder: z.number(),
    bulk: z.number(),
  }),
})
```

**Rule**: Profiles are for configuration, not data. User tier is input, tier limits are profile.

### Output Schema: What Does the Caller Need?

Include everything the caller needs to act on the decision:

```typescript
outputSchema: z.object({
  // The decision
  allowed: z.boolean(),

  // Context for the caller
  reason: z.string(),

  // Actionable info
  upgradeRequired: z.boolean(),
  suggestedPlan: z.string().optional(),
})
```

**Rule**: Output must be actionable. Don't just say "no", say why and what to do.

---

## Step 4: Write the Rules

### Rule Order Matters

Rules are evaluated top-to-bottom. First match wins.

```typescript
rules: [
  // 1. Explicit denials first (blockers)
  { id: "blocked-user", when: (ctx) => ctx.isBlocked, ... },

  // 2. Special cases
  { id: "admin-override", when: (ctx) => ctx.role === "admin", ... },

  // 3. Normal business logic (most specific to least)
  { id: "premium-user", when: (ctx) => ctx.plan === "premium", ... },
  { id: "standard-user", when: (ctx) => ctx.plan === "standard", ... },

  // 4. Catch-all (for classification decisions)
  { id: "default", when: () => true, ... },
]
```

### Every Rule Needs Three Functions

```typescript
{
  id: "rule-name",

  // WHEN: Boolean condition
  when: (ctx, profile) => ctx.amount > profile.threshold,

  // EMIT: Output value
  emit: (ctx, profile) => ({
    allowed: true,
    reason: "...",
  }),

  // EXPLAIN: Human-readable explanation with actual values
  explain: (ctx, profile) =>
    `Amount ${ctx.amount} exceeds threshold ${profile.threshold}`,
}
```

### Explanation Guidelines

| Bad | Good |
|-----|------|
| `"Rule matched"` | `"User role admin has full access"` |
| `"Denied"` | `"Free plan limited to 3 projects, user has 3"` |
| `"OK"` | `"Order total $150 qualifies for 10% bulk discount"` |

**Rule**: Explanations MUST include the actual values that triggered the rule.

---

## Step 5: Test the Decision

### Test Structure

```typescript
describe("can-create-project", () => {
  const profile = { limits: { free: 3, pro: 10, enterprise: -1 } };

  // Test each rule explicitly
  describe("rules", () => {
    it("enterprise users have unlimited projects", () => {
      const result = engine.run(
        decision,
        { userPlan: "enterprise", currentProjects: 100 },
        { profile }
      );
      expect(result.status).toBe("OK");
      expect(result.data?.allowed).toBe(true);
    });

    it("free users blocked at limit", () => {
      const result = engine.run(
        decision,
        { userPlan: "free", currentProjects: 3 },
        { profile }
      );
      expect(result.status).toBe("OK");
      expect(result.data?.allowed).toBe(false);
      expect(result.meta.explanation).toContain("3");
    });
  });

  // Test edge cases
  describe("edge cases", () => {
    it("handles zero projects", () => { ... });
    it("handles exactly at limit", () => { ... });
    it("handles one below limit", () => { ... });
  });

  // Test validation
  describe("validation", () => {
    it("rejects negative project count", () => {
      const result = engine.run(
        decision,
        { userPlan: "free", currentProjects: -1 },
        { profile }
      );
      expect(result.status).toBe("INVALID_INPUT");
    });
  });

  // Test determinism
  describe("determinism", () => {
    it("same input produces same output", () => {
      const input = { userPlan: "pro", currentProjects: 5 };
      const r1 = engine.run(decision, input, { profile });
      const r2 = engine.run(decision, input, { profile });
      expect(r1.data).toEqual(r2.data);
      expect(r1.meta.matchedRule).toBe(r2.meta.matchedRule);
    });
  });
});
```

### Test Coverage Checklist

- [ ] Each rule has at least one test
- [ ] Edge cases (at limit, one below, one above)
- [ ] Invalid inputs rejected
- [ ] Invalid profiles rejected
- [ ] Explanations contain actual values
- [ ] Determinism verified

---

## Step 6: Integrate

### The Integration Pattern

```
[Your Code] → gather data → [Engine] → act on result → [Your Code]
     │                          │                           │
     │    IMPURE (fetch/IO)     │      PURE (decision)      │   IMPURE (effects)
     │                          │                           │
     ▼                          ▼                           ▼
  Database              engine.run(...)              Send email
  API calls                                          Update DB
  File reads                                         Log event
```

### Implementation

```typescript
// 1. GATHER DATA (impure - before engine)
async function handleCreateProject(userId: string): Promise<Response> {
  // Fetch all data needed for the decision
  const user = await db.users.findById(userId);
  const projectCount = await db.projects.countByUser(userId);
  const profile = await loadProfile(user.region);

  // 2. RUN DECISION (pure - the engine)
  const result = engine.run(
    canCreateProject,
    {
      userPlan: user.plan,
      currentProjects: projectCount,
    },
    { profile }
  );

  // 3. ACT ON RESULT (impure - after engine)
  if (result.status !== "OK") {
    logger.error("Decision failed", { result });
    return errorResponse(500, "Internal error");
  }

  if (!result.data.allowed) {
    logger.info("Project creation denied", {
      userId,
      reason: result.meta.explanation,
    });
    return errorResponse(403, result.data.reason, {
      upgradeUrl: result.data.upgradeRequired ? "/pricing" : undefined,
    });
  }

  // Decision allowed - proceed with action
  const project = await db.projects.create({ userId, ... });

  logger.info("Project created", {
    userId,
    projectId: project.id,
    decisionTrace: result.meta,
  });

  return successResponse(201, project);
}
```

### Logging the Decision

Always log the full decision metadata for audit:

```typescript
logger.info("Decision executed", {
  decisionId: result.meta.decisionId,
  decisionVersion: result.meta.decisionVersion,
  status: result.status,
  matchedRule: result.meta.matchedRule,
  explanation: result.meta.explanation,
  evaluatedAt: result.meta.evaluatedAt,
  // Include context for debugging
  input: { userPlan, currentProjects },
  profileId: profile.id,
});
```

---

## Step 7: Profile Management

### Where Profiles Live

Profiles are external to the engine. Common approaches:

```typescript
// Option 1: Environment-based
const profile = profiles[process.env.PROFILE_ENV || "default"];

// Option 2: Database-driven
const profile = await db.profiles.findByRegion(user.region);

// Option 3: Feature flag service
const profile = await featureFlags.getProfile(user.segment);
```

### Profile Versioning

Track profile changes for audit:

```typescript
const profile = {
  id: "us-west-standard",
  version: "2024-01-15",
  limits: { ... },
  thresholds: { ... },
};

// Log which profile version was used
logger.info("Decision used profile", {
  profileId: profile.id,
  profileVersion: profile.version,
});
```

---

## Common Mistakes

### 1. Fetching Inside Rules

```typescript
// WRONG
when: async (ctx) => {
  const user = await db.users.find(ctx.userId); // NO!
  return user.plan === "pro";
}

// RIGHT: Fetch before, pass as input
const user = await db.users.find(userId);
engine.run(decision, { userPlan: user.plan }, { profile });
```

### 2. Side Effects in Emit

```typescript
// WRONG
emit: (ctx) => {
  sendEmail(ctx.userId, "You were approved!"); // NO!
  return { approved: true };
}

// RIGHT: Return result, act after
const result = engine.run(decision, ctx, { profile });
if (result.data?.approved) {
  sendEmail(userId, "You were approved!");
}
```

### 3. Using Time Directly

```typescript
// WRONG
when: (ctx) => {
  const hour = new Date().getHours(); // NO!
  return hour >= 9 && hour < 17;
}

// RIGHT: Inject time as context
when: (ctx) => ctx.currentHour >= 9 && ctx.currentHour < 17

// Caller provides time
engine.run(decision, { currentHour: new Date().getHours(), ... }, { profile });
```

### 4. Useless Explanations

```typescript
// WRONG
explain: () => "Approved"

// RIGHT
explain: (ctx, p) =>
  `User ${ctx.userId} with plan ${ctx.plan} can create project ` +
  `(${ctx.currentProjects}/${p.limits[ctx.plan]} used)`
```

### 5. Missing Catch-All

```typescript
// WRONG: What if score is 20?
rules: [
  { id: "high", when: (ctx) => ctx.score >= 80, ... },
  { id: "medium", when: (ctx) => ctx.score >= 50, ... },
  // Missing low case!
]

// RIGHT: Always have catch-all for classification
rules: [
  { id: "high", when: (ctx) => ctx.score >= 80, ... },
  { id: "medium", when: (ctx) => ctx.score >= 50, ... },
  { id: "low", when: () => true, ... }, // Catch-all
]
```

---

## Checklist: Before Shipping

- [ ] Decision name is a clear question
- [ ] Pattern identified and followed
- [ ] All input fields used in at least one rule
- [ ] Profile contains only configuration, not data
- [ ] Rules ordered correctly (blockers → special cases → normal → catch-all)
- [ ] Explanations include actual values
- [ ] Tests cover all rules
- [ ] Tests verify determinism
- [ ] Integration logs full decision metadata
- [ ] No side effects in rules
- [ ] No data fetching in rules
- [ ] No time/random in rules

---

## Quick Reference

```typescript
// 1. Define
const myDecision = defineDecision({
  id: "can-do-thing",
  version: "1.0.0",
  inputSchema: z.object({ ... }),
  profileSchema: z.object({ ... }),
  outputSchema: z.object({ allowed: z.boolean(), reason: z.string() }),
  rules: [
    {
      id: "rule-name",
      when: (ctx, profile) => /* boolean */,
      emit: (ctx, profile) => /* output */,
      explain: (ctx, profile) => /* string with values */,
    },
    // ... more rules
    { id: "default", when: () => true, ... }, // catch-all
  ],
});

// 2. Run
const result = engine.run(myDecision, input, { profile });

// 3. Handle
if (result.status === "OK" && result.data.allowed) {
  // proceed
} else {
  // deny with result.meta.explanation
}
```
