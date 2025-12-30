# Changelog

All notable changes to Criterion are documented here.

## [0.3.4] - 2024-12-30

### Added

#### New Packages
- **@criterionx/react** — React hooks for decision evaluation
  - `CriterionProvider` context for engine and profiles
  - `useDecision()` hook with loading states and error handling
  - `useCriterion()`, `useEngine()`, `useProfileRegistry()` utilities

- **@criterionx/express** — Express and Fastify middleware
  - `createDecisionMiddleware()` for single decision endpoints
  - `createDecisionRouter()` for multiple decisions
  - `criterionPlugin` for Fastify integration

- **@criterionx/trpc** — tRPC integration with full type safety
  - `createDecisionProcedure()` for type-safe procedures
  - `createDecisionRouter()` for multiple decisions
  - `createDecisionCaller()` for server-side evaluation

- **@criterionx/opentelemetry** — Observability instrumentation
  - `createTracedEngine()` for distributed tracing
  - `createMetricsRecorder()` for Prometheus-style metrics
  - Span attributes for decision ID, version, matched rule

- **@criterionx/generators** — Code generation from specs
  - `parseDecisionSpec()` for runtime parsing of declarative specs
  - `generateDecisionCode()` for TypeScript code generation
  - Support for all comparison operators and expressions

#### Server Enhancements
- **Rate Limiting** — Configurable rate limiting with custom store support
  - In-memory store included, Redis-compatible interface
  - Per-route or global configuration
- **Request Logging** — Structured logging for all requests

### Documentation
- Added API reference for all new packages
- Added integration examples (Next.js, Express REST API)
- Updated navigation with Integrations and Tools sections

## [0.3.0] - 2024-12-29

### Added
- **@criterionx/server** — HTTP server for decisions with auto-generated docs
  - `createServer()` for exposing decisions as REST endpoints
  - Interactive `/docs` UI (Swagger-like)
  - JSON Schema export via `/decisions/:id/schema`
  - Built on [Hono](https://hono.dev/) for edge compatibility
- **Monorepo structure** — pnpm workspaces with `packages/core` and `packages/server`
- **Server documentation** — Guide and API reference for @criterionx/server

### Changed
- Migrated from npm to pnpm
- TypeScript config refactored to shared base

### Fixed
- Falsy input validation (0, false, "" now accepted as valid inputs)
- CI workflow order for monorepo builds

## [0.2.0] - 2024-12-29

### Added
- **Interactive Playground** — Try Criterion in browser via StackBlitz
- **Migration Guide** — Step-by-step guide to convert if/else spaghetti to Criterion decisions
- **Performance Benchmarks** — Documented ~1M ops/sec for simple decisions
- **Real-world Examples** — KYC risk assessment, healthcare triage, e-commerce pricing
- **Architecture Documentation** — ADRs, manifesto, invariants, integration patterns
- **PR & Issue Templates** — Standardized contribution workflow
- **Contributing Guide** — Conventional commits, code style, PR process

### Changed
- Improved PEP handling in KYC example (added fallback rules)
- Enhanced documentation structure with VitePress sidebar improvements

### Fixed
- Repository rename from `criterion` to `criterionx` (all URLs updated)

## [0.1.2] - 2024-12-29

### Changed
- Renamed package to `@criterionx/core`

### Added
- npm provenance attestation for supply chain security

## [0.1.1] - 2024-12-29

### Added
- Initial public release
- Core `Engine` class with `run()` and `explain()` methods
- `defineDecision()` helper for type-safe decision definitions
- `createRule()` helper for type-safe rule definitions
- `createProfileRegistry()` for managing named profiles
- Full Zod integration for input, output, and profile validation
- Complete audit trail with rule evaluation trace
- Human-readable explanations via `explain()` method

### Features
- Pure, deterministic decision evaluation
- Profile-driven parameterization
- First-match rule evaluation
- Comprehensive result metadata
