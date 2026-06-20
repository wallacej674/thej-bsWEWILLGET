# ADR 0004: Workspace owners administer membership and moderate applications

## Status

Accepted. Supersedes the deletion and restoration portions of ADR 0003.

## Context

ApplyTogether needs meaningful workspace-level roles. General members should
collaborate through a shared application list without gaining authority over
records authored by other people. Owners additionally manage members and the
workspace. ADR 0006 delegates application moderation to admins without
delegating workspace ownership.

Application authorship still matters: moderation must not allow an owner to
rewrite another person's application as if they created it.

## Decision

- Active members may add applications and read every active application in the
  workspace.
- Application authors may edit, soft-delete, and restore applications they
  deleted themselves.
- Workspace owners and admins may soft-delete any application in the
  workspace.
- The Deleted tab is personal to the user who performed the deletion. Only that
  user can see, restore, or permanently erase the deleted record.
- Workspace owners may assign the `admin` or `member` role and remove active
  non-owner memberships. Removing or reassigning another owner is intentionally
  excluded until ownership-transfer workflows exist.
- Workspace owners may soft-delete a workspace. Deleted workspaces disappear
  from discovery and reject all workspace-scoped access while retaining
  historical data.
- Every application deletion records `deleted_by_user_id` so the system can
  distinguish author deletion from owner moderation.
- Deleted records may be permanently erased through an explicit selection
  workflow. Selecting all is scoped to records deleted by the requesting user.

## Consequences

Workspace ownership grants governance and moderation, while admins receive only
moderation authority. Neither role grants authorship: users still cannot edit
another person's application. Workspace and application deletion remain
reversible at the data layer, and restrictive foreign keys continue to preserve
historical records.

Permanent deletion is the deliberate exception to historical retention and is
irreversible. Workspace owner status does not expose another owner's Deleted
tab.
