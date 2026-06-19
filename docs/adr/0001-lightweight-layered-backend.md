# ADR 0001: Lightweight layered backend

## Status

Accepted for Milestone 1.

## Context

ApplyTogether needs a small backend that is easy to understand while enforcing
shared-workspace visibility, per-application ownership, duplicate handling,
and atomic database writes. The initial authentication method is temporary,
and the project must remain able to add more users and workspaces later.

Putting CRUD, authorization, and SQLAlchemy work directly in FastAPI routes
would be fast to start but would couple HTTP concerns to policy and make future
authentication replacement riskier.

## Decision

Use a lightweight layered backend:

- routes parse HTTP, invoke dependencies and services, and return schemas;
- dependencies supply sessions, identity, and active membership context;
- services own business decisions and transaction boundaries;
- repositories own PostgreSQL/SQLAlchemy queries and persistence without
  authorization or commits;
- models, schemas, and core utilities provide shared constraints and contracts.

The architecture deliberately avoids a larger enterprise framework, command
bus, generic repository abstraction, or premature domain-event system.

## Alternatives considered

### Route-centric CRUD

Rejected because it mixes transport, policy, and persistence logic. Ownership
and workspace rules would be duplicated across endpoints and more difficult to
test independently.

### Full clean/onion architecture

Rejected for this milestone because its additional abstractions would exceed
the problem size and reduce beginner readability without a current need.

### Generic repository framework

Rejected because the product needs explicit, workspace-scoped query behavior;
generic CRUD interfaces would hide important constraints without reducing much
code.

## Consequences

Routes stay short, services are the single place for lifecycle decisions, and
repositories can be tested as persistence-oriented modules. The structure adds
some files and dependency wiring, but protects the later OAuth replacement and
keeps database operations consistently scoped and transactional.
