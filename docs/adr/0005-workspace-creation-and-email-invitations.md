# ADR 0005: Users create workspaces and owners invite by email

## Status

Accepted.

## Context

ApplyTogether users need to participate in more than one workspace and create
new collaboration spaces without database seeding. Workspace owners also need a
way to invite guests before production authentication and outbound email
delivery are available.

## Decision

- Any active user may create a workspace and becomes its first owner.
- A user may belong to multiple workspaces and selects one active workspace in
  the frontend.
- Only workspace owners may invite guests.
- Invitations target a normalized lowercase email and always grant the
  `member` role.
- If the email already belongs to an active ApplyTogether user, membership is
  created immediately and the invitation is marked accepted.
- If no account exists, the invitation remains pending. Workspace discovery
  automatically claims pending invitations when a user with the matching email
  later exists.
- Pending invitations are visible to workspace owners. This milestone records
  invitations but does not send external email.

## Consequences

Workspace creation and membership are no longer tied to the development seed.
The invitation model is ready for a later email/token acceptance layer without
changing the membership boundary. Invitation email uniqueness is scoped to one
workspace to prevent repeated pending invitations.
