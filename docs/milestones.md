# ApplyTogether milestones

## Milestone 1 — complete: backend foundation

Milestone 1 delivered FastAPI, PostgreSQL, Alembic migrations, typed
configuration, development/test identity, workspace discovery, application
CRUD, shared active visibility, owner-only mutations, soft deletion and
restoration, filtering/sorting/pagination, stable error envelopes, explicit
seed data, PostgreSQL-backed tests, and backend CI.

## Milestone 2 — integrated: frontend and backend

Milestone 2 integrates the React/TypeScript/Vite frontend with the Milestone 1
API. It includes:

- npm-based locked frontend installs and Node.js 22 CI;
- environment-configured API and seeded development identities;
- session and workspace discovery through the backend;
- a typed API client and feature-level API functions;
- routed dashboard, application, deleted, workspace, and profile views;
- create, view, edit, soft-delete, and restore flows;
- shared workspace visibility with owner-only mutation controls;
- filtering, sorting, search, pagination, summaries, and structured errors;
- automated lint, typecheck, unit test, and build validation; and
- documented manual integration smoke steps.

This milestone is integrated for local development. It does not claim
production authentication, deployment, workspace administration, or automated
browser end-to-end coverage.

## Milestone 3 — planned: Google OAuth

Milestone 3 replaces the development-only seeded UUID selector and
`X-User-Id` header with Google OAuth and production session handling. The
backend's resolved-current-user dependency remains the replacement boundary so
route and service ownership rules do not need redesign.

## Later roadmap

Possible later work includes invitations and workspace administration,
accountability goals, richer analytics, interview tracking, operational
deployment, and job-posting monitoring. These are not current implementation
commitments.

No milestone may blur the distinction between workspace membership
(visibility) and application ownership (mutation authority) without an
explicit product and architecture decision.
