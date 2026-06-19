# ApplyTogether architecture

## Scope and design goal

Milestone 1 is a stateless, backend-only FastAPI service with PostgreSQL. The
design is deliberately small enough for a beginner-readable codebase while
keeping authentication, business rules, and persistence independently
replaceable.

The API is versioned under the configured prefix, normally `/api/v1`. Public
health endpoints live at `/health` and `/health/db`. PostgreSQL is the only
supported database; SQLite is not a compatibility target because the product
relies on PostgreSQL constraints, `ILIKE`, migrations, and transaction
semantics.

## Layer boundaries

| Layer | Responsibility |
| --- | --- |
| Routes | Parse HTTP input, call dependencies and services, choose HTTP status codes, and return explicit Pydantic schemas. |
| Dependencies | Provide synchronous database sessions, resolve the development current user, and verify active workspace membership. |
| Services | Enforce business validation, ownership, duplicate and state rules; control transactions and map expected failures. |
| Repositories | Build SQLAlchemy queries and persistence operations scoped to known identifiers; they may flush but do not authorize or commit. |
| Schemas | Validate requests, serialize responses, and express field-level and cross-field contracts. |
| Models | Define SQLAlchemy mappings, foreign keys, indexes, unique constraints, and check constraints. |
| Core | Hold typed settings, enums, shared errors and handlers, timezone and URL utilities, and logging configuration. |
| DB | Configure the engine/session lifecycle and contain the explicit development/test seed command. |

Routes neither parse `X-User-Id` nor hold substantial ORM queries. Repositories
do not decide whether an actor may access or change a record. Services, not
routes or repositories, commit a successful unit of work and roll back failed
ones.

## Request flow

1. A request receives one synchronous SQLAlchemy session from a dependency.
2. Except for health checks, `get_current_user` resolves `X-User-Id` only in
   `development` or `test`, and requires a known active user.
3. Workspace routes verify active membership for the path workspace UUID. A
   valid user without an active membership receives a 403 response.
4. The route gives the service the resolved user and workspace context.
5. The service uses workspace-scoped repository operations, applies ownership,
   validation, duplicate, and lifecycle rules, then commits atomically.
6. The route returns an explicit response model. Expected failures use the
   shared `{ "error": { "code", "message", "details" } }` envelope.

Every application query includes the requested workspace identifier. Active
lists and retrieval exclude soft-deleted applications. The deleted list is also
scoped to the requesting owner.

## Data integrity and transactions

SQLAlchemy uses synchronous PostgreSQL connections. UUID primary keys,
restrictive foreign keys, unique constraints, controlled-value checks, salary
checks, and targeted composite indexes are enforced in the database through
Alembic schema migrations. Migrations contain schema only; they never seed
personal or sample records.

Services may perform multi-step work such as duplicate detection followed by
record creation. That work is atomic: repositories can flush for generated
values, while the service commits only after all rules succeed. Database
uniqueness failures are translated into stable duplicate errors rather than
leaking SQL details.

## Configuration and operations

Central Pydantic Settings reads all configuration from environment variables.
The configuration includes the PostgreSQL URL, environment, API prefix,
application timezone, CORS origins, log level, development-identity switch,
and development seed identities. `DATABASE_URL` is required, and the service
does not rely on persistent local files.

System timestamps are UTC. The configured `APP_TIMEZONE` determines the
default application calendar date. Startup rejects an enabled development
identity header outside `development` or `test`.

The seed command is explicit and only allowed in development/test. It is
idempotent and creates or updates Jonathan, Kareem, their workspace, and active
owner memberships. Startup never seeds data. Docker Compose starts PostgreSQL
only; FastAPI runs directly on the host and may also connect to externally
managed PostgreSQL.

## Authentication replacement boundary

Milestone 1 uses a development-only dependency that turns `X-User-Id` into an
active `User`. The route and service receive a resolved current user rather
than an authentication header. A future Google OAuth dependency can therefore
replace this dependency without requiring route or service rewrites. The header
is not an accepted production authentication mechanism.

## Testing and quality approach

Implementation follows TDD vertical slices against PostgreSQL: one observable
behavior is made red, the minimum end-to-end implementation makes it green,
then the next behavior is added. Tests exercise public contracts rather than
mocked persistence internals.

The test harness migrates a PostgreSQL test database and gives every test an
outer transaction. Sessions use savepoints so service-level commits are visible
within a test but the outer transaction can roll all state back afterward.
Tests cover deterministic utilities, core business rules, API contracts, and a
clean-migration smoke path. The quality gate is Pytest, Ruff linting, Ruff
format checking, and MyPy; the backend CI workflow runs those checks against
PostgreSQL with locked `uv` dependencies.

## Cloud-readiness principles

The service remains provider-neutral: stateless request handling,
environment-based configuration, clean session lifecycle, UTC timestamps,
structured logging, unauthenticated health checks, and an externally
configurable PostgreSQL connection. Milestone 1 intentionally contains no
cloud infrastructure, deployment workflow, provider SDK, or production image.
