# Changelog

All notable changes to Criterion are documented here.

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
