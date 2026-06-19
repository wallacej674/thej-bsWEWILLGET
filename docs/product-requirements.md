# ApplyTogether product requirements

## Purpose

ApplyTogether is a shared job-application accountability product. Its first
workspace is for Jonathan and Kareem: each records the jobs they have applied
to, and both can see the active applications in their shared workspace. The
product is designed to support more users and workspaces later without changing
the core ownership model.

Milestone 1 is a backend-only foundation. FastAPI's generated OpenAPI schema is
the detailed endpoint reference; this document records the product contract
behind that API.

## Initial users and shared workspace

The development seed data provides two active users, Jonathan and Kareem, in a
workspace named `ApplyTogether`. Both have the workspace role `owner`.

Workspace membership grants visibility, not control of another person's
application. Every active workspace member can view every active application in
that workspace. Each application has exactly one owner, and only that owner can
update, soft-delete, or restore it. A workspace owner has no exception to that
rule.

## Milestone 1 capabilities

- Health checks for the API process and PostgreSQL connectivity.
- Development/test identity resolution from a seeded-user UUID header.
- Discovery of the current user and that user's active workspaces.
- Creation, listing, retrieval, partial update, soft deletion, deleted-item
  discovery, and restoration of job applications within a workspace.
- Shared visibility of active applications for active workspace members.
- Search by company name or job title; owner, status, work-arrangement, and
  employment-type filters; allowlisted sorting; and page-based pagination.
- Validation of application dates, controlled values, salary data, and job
  posting URLs.
- Duplicate prevention for the same owner, workspace, and normalized job
  posting URL, including soft-deleted records.
- Consistent machine-readable API error responses.
- Development/test-only idempotent seed data, with optional fictional sample
  applications for manual testing.

## Job-application expectations

An application records a company name, job title, job-posting URL, location,
work arrangement, employment type, application date, and status. The API
preserves the submitted URL and also derives a normalized comparison value for
duplicate detection. Application dates are calendar dates; an omitted create
date defaults to the current date in the configured application timezone.

Applications remain historical records. Soft-deleted applications are hidden
from normal list and retrieval operations, but remain available for their owner
to list and restore. An application is not permanently deleted or automatically
transferred when its owner becomes inactive or leaves a workspace.

## Explicit non-goals

Milestone 1 does not include a frontend, Google OAuth, password authentication,
invitations, workspace or membership management, role management, individual
or shared goals, dashboard summaries, charts, analytics, interview or
recruiter tracking, offers, status history, company management, geographic
models, posting-availability checks, external URL requests, permanent
deletion, cloud provisioning, deployment automation, or production container
packaging.

## Future direction

Potential later work includes a frontend dashboard, Google OAuth, workspace
invitations and administration, individual weekly application goals, summaries,
production deployment, and posting-availability monitoring. Those areas need
their own product and technical decisions before implementation; they are not
promises of the current API.
