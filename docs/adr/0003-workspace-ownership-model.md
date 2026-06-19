# ADR 0003: Workspace roles and application ownership are separate

## Status

Accepted for Milestone 1.

## Context

ApplyTogether is collaborative: active members need visibility into the shared
workspace, while each person retains control over the lifecycle of the
applications they recorded. Jonathan and Kareem are both seeded as workspace
owners, so using the workspace role as blanket edit authority would let either
modify the other's records.

The model also needs to preserve historical applications when a user becomes
inactive or a membership is removed.

## Decision

Use two independent concepts:

- an active `WorkspaceMembership` grants visibility into a workspace and holds
  a workspace role (`owner` or `member`);
- a `JobApplication.owner_id` is immutable and is the sole authority for
  updating, soft-deleting, and restoring that application.

All application requests require an active membership in the path workspace.
All queries are additionally scoped by that workspace. Application ownership is
then checked for every mutating operation, including requests made by a
workspace owner.

Membership removal is represented by `removed_at`; application removal uses
`deleted_at`. Neither operation deletes or transfers historical application
data.

## Alternatives considered

### Workspace owners can edit all workspace applications

Rejected because it conflicts with the product's personal-accountability
expectation and makes both initial owners able to modify one another's records.

### Role-only authorization

Rejected because roles describe workspace administration potential, not the
creator's ownership of a particular application.

### Delete applications when a user is removed

Rejected because it destroys shared history and conflicts with the requirement
to retain applications after membership removal or user deactivation.

## Consequences

Authorization has two explicit checks—membership for access and ownership for
mutation—rather than one overloaded role check. The API can safely show shared
active records while protecting each user's edits. Future workspace-management
features may grant owners additional administrative powers, but they do not
change application ownership without an explicit product decision.
