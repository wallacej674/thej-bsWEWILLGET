# ApplyTogether Milestone 1 Design

## Purpose and scope

ApplyTogether Milestone 1 provides a backend-only shared job-application
workspace for Jonathan and Kareem. It records applications, makes active
applications visible to every active workspace member, and enforces that only
the application owner can change its lifecycle. The design intentionally
excludes a frontend, OAuth, invitations, goals, analytics, interview tracking,
and cloud deployment.

The existing repository is a greenfield repository. Its former README mentions
newsletters; newsletters are not part of this milestone and the README will be
replaced during implementation.

## Technology and repository layout

The root repository will contain a PostgreSQL-only `compose.yaml`, shared
documentation, pre-commit configuration, and one backend CI workflow. The
Python 3.12 backend will be managed by `uv` in `backend/` and will include
`pyproject.toml`, `uv.lock`, `.env.example`, Alembic configuration, application
code, and PostgreSQL-backed tests.

`backend/app/` has these responsibilities:

- `api/routes`: HTTP parsing, dependencies, response models, and status codes.
- `api/dependencies`: database sessions, development identity, and active
  workspace membership.
- `core`: typed settings, enums, time and URL utilities, structured errors,
  exception handlers, and logging configuration.
- `db`: engine/session configuration and an explicit, development/test-only
  seed module.
- `models`: SQLAlchemy mappings and database constraints.
- `repositories`: query construction and persistence without authorization or
  commits.
- `schemas`: Pydantic v2 request and response contracts.
- `services`: business validation, ownership and state decisions, duplicate
  handling, and transaction control.

Routes therefore do not read `X-User-Id`, execute substantial ORM queries, or
commit transactions. A future OAuth current-user dependency can replace the
development identity dependency without changing routes or services.

## Data model and integrity

`User`, `Workspace`, `WorkspaceMembership`, and `JobApplication` use UUID
primary keys. Timestamps are timezone-aware and stored in UTC. Application
dates are PostgreSQL calendar dates; the default date is determined in the
configured `APP_TIMEZONE`.

Membership keeps a single record per `(user_id, workspace_id)` and represents
removal with `removed_at`. Only records where `removed_at IS NULL` grant
access. Roles (`owner` and `member`) represent workspace-level roles but do not
grant authority over an application owned by another user.

Applications retain their original owner and workspace permanently. They use a
nullable `deleted_at` for soft removal. A unique constraint on `(workspace_id,
owner_id, normalized_job_posting_url)` includes deleted applications, so the
same user cannot create a second record for a deleted posting instead of
restoring it. Database constraints enforce controlled string values and valid
salary storage (`NUMERIC(12, 2)`, non-negative amounts, ordered range, and
salary-period consistency). Practical composite indexes support active
membership checks and application list/filter queries.

Alembic contains schema only, with upgrade and safe downgrade paths. Foreign
keys use restrictive behavior; no cascade can erase historical applications.

## Request flow and authorization

1. A request opens one synchronous SQLAlchemy session through a dependency.
2. Non-health endpoints resolve the development user from `X-User-Id`. The
   header is enabled only in `development` and `test`; malformed, unknown, or
   inactive identities return a unified 401 error.
3. Workspace routes validate active membership for the path workspace UUID.
   A valid user without membership receives 403.
4. A route calls a service with the known current user and workspace context.
5. The service asks repositories for rows already scoped to that workspace,
   applies ownership/state/duplicate rules, commits an atomic successful unit
   of work, and maps expected failures to stable errors.
6. The route returns an explicit Pydantic response contract.

Every application query includes the requested workspace identifier. Active
lists and retrieval exclude soft-deleted rows. The deleted list returns only
the current user’s soft-deleted rows. Updates, deletion, and restoration first
verify application ownership even if the requester is a workspace owner.

## API and validation behavior

The versioned API defaults to `/api/v1`; `/health` and `/health/db` are
unauthenticated. The API includes current-user and accessible-workspace
discovery as well as create, active-list, retrieve, partial-update,
soft-delete, deleted-list, and restore application operations.

Application payloads never accept `owner_id` or `workspace_id`. Required text
is trimmed and bounded; email is lowercased. URL normalization preserves the
submitted URL and produces a deterministic comparison URL by requiring HTTP(S),
lowercasing the host, dropping fragments, removing only documented tracking
parameters, retaining unknown query parameters, and normalizing unnecessary
trailing slashes. Salary values use `Decimal`; update validates the final
merged state and can clear salary fields.

List operations use PostgreSQL `ILIKE` for case-insensitive company/title
substring search, filters defined by the product contract, a finite sort-field
allowlist, and page-based metadata in the response body. Whitespace-only
search is ignored and page size is limited to 100.

All expected errors use `{ "error": { "code", "message", "details" } }`.
FastAPI/Pydantic validation failures preserve field details inside that wrapper;
database failures are not exposed. Duplicate active and deleted applications
produce distinct 409 codes.

## Seed and operational design

Central Pydantic Settings requires `DATABASE_URL` and carries the environment,
API prefix, CORS origins, log level, timezone, development identity setting,
and seed identities. Startup rejects development identity in non-development,
non-test environments. Configuration is entirely environment based and no
startup operation seeds data.

`python -m app.db.seed` is allowed only in development and test. It idempotently
creates or updates Jonathan, Kareem, the ApplyTogether workspace, and their
active owner memberships, then prints their UUIDs. Its optional sample-data
flag adds fictional, idempotent applications for manual testing.

## Test-first implementation and verification

Implementation follows TDD vertical slices against PostgreSQL. The test
harness applies migrations to the test database and isolates each test in an
outer transaction. Sessions join that transaction with savepoints, allowing
service-level commits to be observed during a test while the outer transaction
is rolled back afterward.

The first tracer validates an authenticated, active-membership public API path
against the migrated database. Each later observable behavior is added as one
failing test followed by the minimum implementation: health/config, identity,
workspace discovery, creation and validation, shared visibility and queries,
ownership mutations, deletion/restoration, and error handling. Unit tests cover
normalization and time helpers; service tests cover business rules; API tests
cover the documented public contract; and migration smoke tests cover clean
upgrades. Tests do not use SQLite or mock persistence internals.

The final suite is `pytest`, `ruff check .`, `ruff format --check .`, and
`mypy app`; CI runs the same checks using PostgreSQL and `uv sync --locked`.

## Alternatives considered

- A route-centric CRUD module was rejected because it would mix HTTP,
  authorization, and persistence concerns and would make a later authentication
  replacement risky.
- PostgreSQL-native enum types were rejected in favor of `StrEnum` values,
  string columns, and check constraints, as required for clearer migrations and
  compatibility.
- SQLite or mocked persistence tests were rejected because PostgreSQL-specific
  `ILIKE`, constraints, migrations, and transaction semantics are acceptance
  requirements.

## Assumptions

- Local development PostgreSQL is available through Docker Compose; externally
  managed PostgreSQL uses the same `DATABASE_URL` contract.
- The repository directory name remains unchanged; product naming is applied to
  the application and documentation rather than renaming the user’s checkout.
- The documented conservative tracking-parameter allowlist is part of the URL
  utility and will not remove unknown parameters that could identify a posting.
