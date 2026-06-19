# ApplyTogether milestones

## Milestone 1 — backend foundation and shared applications

Milestone 1 establishes the backend contracts for a future shared
job-application dashboard. Its scope is FastAPI, PostgreSQL, Alembic schema
migrations, typed environment configuration, development/test identity,
workspace discovery, and job-application CRUD with soft deletion and
restoration.

It includes the ownership model, shared active-application visibility,
search/filter/sort/pagination contracts, validation, consistent errors,
idempotent development seed data, PostgreSQL-backed tests, and quality
automation. It excludes frontend work, OAuth, invitations, workspace
administration, goals, analytics, interview tracking, and deployment.

## Future roadmap

The following are possible later milestones, not approved implementation
commitments. Their order and detailed scope need separate product and technical
decisions.

1. **Frontend dashboard.** A client for shared application visibility and the
   existing backend contracts.
2. **Production authentication.** Google OAuth and a replacement for the
   development identity dependency.
3. **Workspace administration.** Invitations, membership changes, and
   workspace settings built on the existing membership model.
4. **Individual accountability goals.** Weekly application-goal rules and the
   UI/API needed to make them useful.
5. **Dashboard summaries.** Carefully defined aggregate views or analytics.
6. **Operational deployment.** Provider-specific production hosting, database
   provisioning, secrets management, and deployment automation.
7. **Posting monitoring.** A separately designed job-posting availability
   capability, including its external-request and scheduling constraints.

No future milestone may weaken the Milestone 1 distinction between workspace
membership (visibility) and application ownership (mutation authority) without
an explicit redesign.
