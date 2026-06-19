# ADR 0002: Development-only identity header

## Status

Accepted for Milestone 1.

## Context

Milestone 1 needs authenticated-user and ownership behavior before Google OAuth
is designed or implemented. The initial seeded users, Jonathan and Kareem, need
a simple deterministic way to make local and test requests. A request body
cannot be trusted to select an application owner.

## Decision

Use a reusable `get_current_user` dependency that reads
`X-User-Id: <seeded-user-uuid>` only when `ENVIRONMENT` is `development` or
`test` and `DEV_IDENTITY_HEADER_ENABLED` is enabled. The dependency validates
the UUID, resolves it to a known active user, and returns unified 401 errors for
missing, malformed, unknown, or inactive identities.

Startup must fail if the development identity switch is enabled in any other
environment. Routes do not parse the header directly; they receive the resolved
current user. Health checks remain unauthenticated.

## Alternatives considered

### Implement Google OAuth now

Rejected because OAuth is explicitly outside Milestone 1 and would expand the
scope into provider configuration, callback handling, and production concerns.

### Trust `owner_id` in application payloads

Rejected because it allows client-selected ownership and breaks the ownership
guarantee.

### Unauthenticated development API

Rejected because it cannot exercise the real membership and owner-only
authorization contracts.

## Consequences

Local and integration-test requests can exercise identity and authorization
deterministically. The mechanism must never be exposed as production
authentication, and settings validation prevents accidental use outside its
limited environments. Since routes and services depend on a resolved user, a
future OAuth dependency can replace the header without rewriting business
logic.
