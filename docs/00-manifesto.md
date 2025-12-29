# Manifesto

Criterion exists because business logic tends to become:

- scattered across services/controllers/UI
- implicit and hard to audit
- hard to reproduce historically
- impossible to explain reliably

The most expensive bugs are often **semantic**:
the system does something "valid" technically, but "wrong" economically or logically.

Criterion draws a hard boundary:

- **Data collection** happens outside the engine.
- **Decisions** happen inside the engine.
- **Presentation** happens after the engine.

A good engine knows nothing about the world.
It knows how to think when the world is described to it.

Criterion is intentionally strict:
- contracts are mandatory
- side effects are forbidden
- explainability is required

This is how systems scale without losing trust.
