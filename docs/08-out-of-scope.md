# Out of Scope (v1)

What Criterion **will not** include in v1.

This is intentional. Criterion is a micro-engine with strict boundaries.

---

## 1. Visual Rule Builder

**Not included:** Drag-and-drop UI for building decisions.

**Why:** UI is a layer on top of Criterion, not part of it.
Build your own UI that generates Criterion decisions.

---

## 2. Database Integration

**Not included:** Built-in DB connections, ORM, or data fetching.

**Why:** Criterion is pure. Data fetching is the host system's job.

```ts
// Host system fetches data
const user = await db.users.findById(userId);
const context = { userId, balance: user.balance };

// Criterion evaluates
engine.run(decision, context, { profile });
```

---

## 3. Workflow Orchestration

**Not included:** Multi-step workflows, state machines, or process orchestration.

**Why:** Criterion makes single decisions. Orchestration is a different concern.

Use Criterion inside your workflow engine, not as your workflow engine.

---

## 4. ML/AI Inference

**Not included:** Machine learning models, predictions, or AI-based decisions.

**Why:** Criterion is rule-based and deterministic.
ML outputs are probabilistic and non-deterministic.

You can use ML to build context, then let Criterion decide:

```ts
const riskScore = await mlModel.predict(features);
const context = { riskScore };
engine.run(decision, context, { profile });
```

---

## 5. Plugin System

**Not included:** Third-party plugins, extensions, or middleware.

**Why:** The core must remain small and stable.
Plugins add complexity and maintenance burden.

If you need extensibility, compose decisions in your code.

---

## 6. Remote Profile Fetching

**Not included:** Fetching profiles from URLs, APIs, or remote storage.

**Why:** IO in the engine breaks purity.

Use ProfileRegistry and load profiles externally:

```ts
const profiles = await fetchProfilesFromAPI();
const registry = createProfileRegistry();
profiles.forEach(p => registry.register(p.id, p));
engine.run(decision, context, { profile: "my-profile" }, registry);
```

---

## 7. Decision Chaining

**Not included:** Automatic chaining of decisions or dependency resolution.

**Why:** Chaining creates implicit dependencies and complexity.

Chain decisions explicitly in your code:

```ts
const eligibilityResult = engine.run(eligibilityDecision, context, opts);
if (eligibilityResult.data?.eligible) {
  const pricingResult = engine.run(pricingDecision, context, opts);
}
```

---

## 8. Caching

**Not included:** Built-in result caching or memoization.

**Why:** Caching belongs to the infrastructure layer.

Implement caching in your host system if needed.

---

## 9. Logging / Telemetry

**Not included:** Built-in logging, metrics, or tracing integration.

**Why:** Observability is infrastructure, not engine logic.

Use the Result.meta for your own logging:

```ts
const result = engine.run(decision, context, opts);
logger.info({
  decision: result.meta.decisionId,
  matched: result.meta.matchedRule,
  trace: result.meta.evaluatedRules,
});
```

---

## 10. Hot Reloading

**Not included:** Runtime decision updates without restart.

**Why:** Decisions should be versioned and deployed, not mutated at runtime.

Deploy new decision versions through your normal release process.

---

## 11. Access Control

**Not included:** Permission checks, role-based access, or authentication.

**Why:** Security is a host system concern.

Check permissions before calling Criterion, not inside it.

---

## 12. Internationalization

**Not included:** Multi-language explanations or localized outputs.

**Why:** I18n is a presentation layer concern.

Use explanation keys and translate in your UI:

```ts
emit: () => ({ reason: "RISK_HIGH" }),
// UI translates "RISK_HIGH" → "Alto riesgo"
```

---

## Summary

| Feature | In v1? | Why Not |
|---------|--------|---------|
| Visual builder | ❌ | Build on top, not inside |
| Database | ❌ | Purity: no IO |
| Workflows | ❌ | Different concern |
| ML/AI | ❌ | Determinism |
| Plugins | ❌ | Keep core small |
| Remote profiles | ❌ | No IO in engine |
| Decision chaining | ❌ | Explicit > implicit |
| Caching | ❌ | Infrastructure layer |
| Logging | ❌ | Infrastructure layer |
| Hot reload | ❌ | Version and deploy |
| Access control | ❌ | Host system concern |
| I18n | ❌ | Presentation layer |

---

## Philosophy

> Criterion is a knife, not a Swiss Army knife.

One thing, done well.
