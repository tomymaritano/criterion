# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2024-12-29

### Added

- Core engine implementation (`Engine.run()`, `Engine.explain()`)
- Type definitions (`Decision`, `Rule`, `Context`, `Profile`, `Result`)
- Profile registry for external profile management
- Zod-based input/output/profile validation
- 18 unit tests covering all core functionality

### Documentation

- Manifesto (`docs/00-manifesto.md`)
- Core concepts (`docs/01-core-concepts.md`)
- Invariants (`docs/02-invariants.md`)
- API surface (`docs/03-api-surface.md`)
- Decision profiles (`docs/04-decision-profiles.md`)
- Integration patterns (`docs/05-integration-patterns.md`)
- Versioning rules (`docs/06-versioning.md`)
- Anti-patterns (`docs/07-anti-patterns.md`)
- Out of scope (`docs/08-out-of-scope.md`)

### Examples

- Hello Decision (simplest example)
- Currency Exposure Risk (finance, with profiles)
- User Tier Eligibility (non-finance)

## [0.3.2] - 2024-12-30

### Added

#### @criterionx/server
- **Structured error responses** with `code`, `message`, `requestId`, `timestamp`
- **Health check endpoint** `/health` with status, version, uptime, and checks
- New error codes: `DECISION_NOT_FOUND`, `INVALID_JSON`, `MISSING_INPUT`, `MISSING_PROFILE`, `EVALUATION_ERROR`
- Exported types: `ErrorCode`, `ErrorResponse`, `HealthStatus`, `HealthResponse`

## [0.3.1] - 2024-12-29

### Added

#### @criterionx/server
- HTTP server with OpenAPI specification generation
- Swagger UI and ReDoc documentation endpoints
- Prometheus metrics middleware
- Middleware hooks (beforeEvaluate, afterEvaluate, onError)
- CORS support

#### @criterionx/cli
- `criterion validate` - Validate all decisions in a project
- `criterion list` - List all decisions with ID, version, and rule count
- JSON output support (`--json` flag)

#### @criterionx/testing
- Property-based testing with `fast-check`
- Decision fuzzing utilities
- Dead rule detection
- Coverage analysis

#### @criterionx/devtools
- Trace collector for debugging decisions
- HTML report generation
- Evaluation timeline visualization

#### VSCode Extension
- Syntax highlighting for `.criterion.ts` files
- Snippets for decision and rule creation
- Hover documentation for Criterion keywords
- Real-time validation diagnostics
- `criterion.newDecision` command

### Changed

- Aligned all package versions to 0.3.0
- Standardized test scripts across all packages
- Improved documentation examples

### Fixed

- Documentation incorrectly showed `engine.registerProfile()` method that doesn't exist
- Corrected examples to use `createProfileRegistry()` pattern
- Fixed VSCode extension validation logic

### Documentation

- Rewrote profile registry documentation with correct API usage
- Added complete currency risk example with registry pattern
- Improved API reference documentation

## [0.2.0] - 2024-12-29

### Added

- @criterionx/server package
- @criterionx/testing package
- @criterionx/devtools package
- @criterionx/cli package
- VSCode extension (criterionx-vscode)

## [Unreleased]

### Planned

- CLI `criterion deploy` command
- Remote profile loading
- OpenTelemetry integration
