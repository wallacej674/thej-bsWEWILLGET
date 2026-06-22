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
- Invitations remain pending whether or not the email already belongs to an
  active ApplyTogether user.
- A signed-in user sees pending invitations addressed to their normalized
  signup email in the in-app invitation inbox and explicitly accepts or
  declines each invitation.
- Accepting creates or restores member access. Declining removes the
  invitation from both the recipient inbox and the owner's pending list.
- Pending invitations are visible to workspace owners. This milestone records
  invitations but does not send external email.

## Consequences

Workspace creation and membership are no longer tied to the development seed.
Invitation email uniqueness remains scoped to one workspace. The invitation
inbox exposes the inviter's display name without exposing their email address.
