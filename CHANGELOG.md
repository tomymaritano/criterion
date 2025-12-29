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

## [Unreleased]

### Planned

- Additional examples
- Performance benchmarks
- More comprehensive test coverage
