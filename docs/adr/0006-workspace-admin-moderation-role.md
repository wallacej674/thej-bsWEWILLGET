# ADR 0006: Workspace admins have moderation-only authority

## Status

Accepted.

## Context

Workspace owners need to delegate application moderation without delegating
ownership of the workspace. The delegated role must be able to remove
applications that do not belong in the workspace while leaving membership,
invitations, role assignment, and workspace deletion under owner control.

## Decision

- Add `admin` as a workspace membership role between `owner` and `member`.
- Owners may promote a member to admin or return an admin to member.
- Owners cannot assign or transfer the owner role through this control.
- Admins may soft-delete any active application in the workspace.
- Admins may not invite or remove members, assign roles, or delete the
  workspace.
- Admins still may edit only applications they authored.
- Applications deleted by an admin appear only in that admin's personal
  Deleted tab.

## Consequences

Application moderation is delegable without broadening workspace governance.
Authorization continues to distinguish application authorship, moderation
authority, and workspace ownership rather than treating them as one permission.
