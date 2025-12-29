# Roadmap

This document outlines the vision and planned evolution of Criterion.

## Philosophy

Criterion is a **micro-engine** — "a knife, not a Swiss Army knife."

**Scaling means:**
- Better documentation and real-world examples
- Companion packages (ecosystem)
- Developer tooling
- Community and adoption
- Framework integrations

**Scaling does NOT mean:**
- Adding features to the core
- Turning it into a framework
- Adding plugins or extensibility

The core will remain small, pure, and focused.

---

## Phases

### Phase 1: Foundation (v0.1.x - v0.2.x) ✅
*Stabilize the core and documentation*

- [x] More real-world examples (e-commerce, healthcare, fintech)
- [x] Migration guide from if/else spaghetti code
- [x] Performance benchmarks
- [ ] 100% test coverage
- [x] Interactive playground (CodeSandbox/StackBlitz)

### Phase 2: Developer Experience (v0.3.x - v0.5.x)
*Tools for productivity*

- [ ] `@criterionx/cli` — CLI for scaffolding decisions
- [ ] `@criterionx/testing` — Testing utilities (property-based, fuzzing)
- [ ] `@criterionx/devtools` — Debug viewer for traces
- [ ] VSCode extension — Syntax highlighting, snippets, validation
- [ ] JSON Schema export for decisions

### Phase 3: Ecosystem (v0.6.x - v0.9.x)
*Integrations without polluting the core*

- [ ] `@criterionx/react` — Hooks for React apps
- [ ] `@criterionx/express` — Middleware for Express/Fastify
- [ ] `@criterionx/trpc` — tRPC integration
- [ ] `@criterionx/opentelemetry` — Observability helpers
- [ ] `@criterionx/generators` — Generate decisions from specs

### Phase 4: Enterprise Ready (v1.0.0+)
*Production at scale*

- [ ] Decision versioning & migration tools
- [ ] A/B testing utilities
- [ ] Audit log formatters (compliance)
- [ ] Performance profiler
- [ ] Decision complexity analyzer

---

## Scalability

### Technical Limits (what the core handles)

| Aspect | Limit |
|--------|-------|
| Rules per decision | Thousands (O(n) evaluation, O(1) rules) |
| Decisions in system | Unlimited (independent) |
| Context size | Limited by JS memory |
| Profiles | Unlimited (registry or inline) |

### Architectural (outside the core)

| Aspect | Solution |
|--------|----------|
| Multiple decisions | Orchestrate in host system |
| Persistence | External database |
| Caching | External Redis/Memcached |
| Async data | Fetch before calling engine |
| Distributed | Stateless = easy horizontal scaling |

---

## Use Cases by Scale

### Startup (1-10 decisions)
- Pricing rules
- Feature flags with logic
- User eligibility

### Scale-up (10-100 decisions)
- Fraud detection
- Compliance automation
- Dynamic pricing
- Risk assessment

### Enterprise (100+ decisions)
- Underwriting automation
- Claims processing
- Regulatory compliance
- Multi-market rules

---

## Contributing

Want to help shape Criterion's future? See [CONTRIBUTING.md](CONTRIBUTING.md).

Ideas and feedback are welcome in [GitHub Discussions](https://github.com/tomymaritano/criterionx/discussions).
