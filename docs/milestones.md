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

## Milestone 3 — Secure Email/Password Authentication and Session Management

Milestone 3 replaces the normal development-only seeded UUID selector and
`X-User-Id` header flow with email/password login, Argon2id password hashes,
AuthX access and rotating refresh cookies, CSRF protection, and persisted
session revocation. Google account linking remains a future enhancement.

## Milestone 4 — Tracker to assistant

Milestone 4 turns ApplyTogether from passive record-keeping into an active
job-search assistant. The three capabilities below build on existing data and
respect the membership/ownership boundary: stage changes are owner-only
mutations, all reads stay workspace-scoped, and soft-delete semantics are
preserved.

Prerequisite: finish the in-progress warm-theme UI migration (Dashboard charts
and stat icons, the application detail view, and the development `IdentityGate`)
so the interface is visually consistent before new surfaces are added.

- Interview pipeline: a per-application stage (for example Applied, Screening,
  Interview, Offer, Rejected, Withdrawn) with both a board (Kanban) view and the
  existing list view. Stage transitions are owner-only mutations, remain visible
  to the workspace, and coexist with the current status and soft-delete model.
- Follow-up reminders and deadline nudges: scheduled, idempotent background jobs
  that surface in-app and by email (reusing the existing SMTP integration),
  derived from application dates and stages, and bounded by quiet windows and
  resend cooldowns.
- Funnel analytics and accountability goals: response, interview, and offer
  rates, time-to-response, and weekly velocity against per-member goals.
  Aggregation is read-only and workspace-scoped, extending the existing summary
  and dashboard charts.

Out of scope for this milestone: AI generation, calendar integration, and email
ingestion (tracked under the later roadmap).

## Milestone 5 — Production-ready

Milestone 5 hardens the integrated application for real users and operational
deployment, closing the gaps Milestone 2 explicitly disclaimed.

- Browser end-to-end coverage (Playwright) in CI for the core flows:
  authentication, application create/view/edit/soft-delete/restore, workspace
  switching, and pipeline transitions.
- Continuous delivery: migrations applied on deploy, environment promotion, and
  health-gated releases (the `/health` and `/health/db` routes already exist).
- Observability: structured logging, error tracking, and request tracing.
- Security hardening: enforce `Secure`/`HttpOnly`/`SameSite` cookies in
  production, add security headers and auth-endpoint rate limiting, manage
  secrets outside source control, and guarantee the development identity bypass
  is disabled outside development and test.
- Accessibility: keyboard-operable menus (including the workspace switcher's
  footer action), plus color-contrast and screen-reader passes.

## Milestone 6 — Scale to large workspaces (100+ members)

Milestone 6 makes a single workspace comfortably support 100+ members (designed
for the low hundreds now, on foundations that extend to thousands later). The
binding constraint today is the dashboard's per-member request fan-out
(`~2 + 2 × members` requests per load); the fixes below move all per-member work
to bounded, server-side, paginated queries.

Design principles (so thousands needs no rework): all per-member data is
server-side paginated and sorted (never "return all owners"); the summary
payload is bounded regardless of member count (totals + top-N, not per-owner
arrays); charts show aggregates plus top-N, never one series or row per member.

- Backend: a paginated, sortable `team-accountability` endpoint returning
  per-owner active / this-week / rejected / last-applied via `GROUP BY`; trim the
  summary endpoint to bounded data (totals, status and arrangement counts,
  applications-over-time as workspace totals per week, and a top-applicants
  list); add composite indexes on `(workspace_id, owner_id, status)`,
  `(workspace_id, application_date)`, and `(workspace_id, updated_at)`.
- Backend: paginate and search members and invitations; expose a member count;
  cap list `page_size` (for example `le=100`); add a configurable hard member
  cap (default ~500 now, raised later).
- Frontend: remove the dashboard per-member fan-out (read everything from the
  enriched summary, ~1 request); drive the accountability table from the
  paginated endpoint; aggregate the over-time chart to a workspace total and
  show top-N applicants with a "view all"; add member search and pagination to
  the Workspace page.
- Validation: a seed path for 100–200 members (and a 1k smoke test) asserting the
  dashboard issues ~1–2 requests, pagination works, and analytics stay readable.

Future work for true thousands (enabled by, not blocking, the above): list
virtualization, a cached or materialized summary, and cursor pagination.

## Later roadmap

Possible later work, not yet committed, includes: an AI assistant suite
(cover-letter generation and resume-to-posting match and skill-gap analysis,
building on the existing resume tailoring); a one-click "save this job" browser
extension (building on the existing job-posting autofill); Gmail ingestion to
auto-update application status; Google Calendar and ICS interview scheduling;
deeper collaboration (notes, mentions, and coach/mentor read-only views); and
ranked full-text search over applications and notes.

No milestone may blur the distinction between workspace membership
(visibility) and application ownership (mutation authority) without an
explicit product and architecture decision.
