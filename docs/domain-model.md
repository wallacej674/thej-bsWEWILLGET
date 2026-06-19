# ApplyTogether domain model

## Core entities

All core entities use UUID primary keys. System timestamps are timezone-aware
and stored in UTC. Application dates are PostgreSQL calendar dates rather than
timestamps.

### User

A user represents a person who can own applications and belong to workspaces.
It has a unique, lowercased email; a required display name; optional Google
subject and avatar URL; activation state; optional last-login timestamp; and
creation and update timestamps. Google subjects are stored for a later
authentication integration, but are not used to authenticate a Milestone 1
request.

An inactive user cannot act as the current user. Applications the inactive user
already owns remain visible to active members of their workspace.

### Workspace

A workspace is the visibility boundary for a group of users and their
applications. It has a required name and creation and update timestamps. The
initial seeded workspace is named `ApplyTogether`.

### Workspace membership

A workspace membership joins one user to one workspace and records a
workspace-level role, `owner` or `member`. It has a nullable `removed_at`
timestamp and creation and update timestamps.

There is at most one membership record for a `(user_id, workspace_id)` pair.
Only a record with `removed_at IS NULL` is active and grants access. Removal is
historical: it does not delete applications, transfer ownership, or permit
rejoining in Milestone 1.

### Job application

A job application belongs permanently to one workspace and one user. Its owner
and workspace are derived from request context at creation and are immutable.
It contains required company name, job title, submitted job-posting URL,
normalized job-posting URL, location, work arrangement, employment type,
application date, status, creation timestamp, update timestamp, and nullable
`deleted_at` timestamp.

Optional information is salary minimum, maximum, currency, period, job
description, and notes. Salary amounts are precise decimals stored as
`NUMERIC(12, 2)`, never floats. A salary range must be non-negative and ordered;
a period is required whenever either salary value is present. Currency defaults
to `USD` and is a three-character uppercase code.

## Relationships and access

```text
User 1 --- * WorkspaceMembership * --- 1 Workspace
User 1 --- * JobApplication * --- 1 Workspace
```

An active membership permits a user to read active applications in its
workspace. It does not confer ownership. Only the `owner_id` of an application
may change its lifecycle, including when that user is also a workspace owner.
All application lookups are scoped to their requested workspace, so knowing an
application UUID cannot cross the workspace boundary.

## Uniqueness and historical rules

- User email is unique after lowercase normalization.
- A non-null Google subject is unique.
- `(user_id, workspace_id)` is unique for memberships, including removed
  memberships.
- `(workspace_id, owner_id, normalized_job_posting_url)` is unique for
  applications, including soft-deleted applications.

The last rule allows Jonathan and Kareem to record the same posting separately,
but prevents either person from creating a second record in the same workspace.
When a matching record is deleted, the owner must restore it instead of making
a replacement record.

## Soft removal and retention

Applications use `deleted_at` for soft deletion. Normal application lists and
single-application retrieval exclude deleted records. The deleted list includes
only records owned by the requesting user, and restoration clears `deleted_at`
without changing any other domain data.

Membership removal uses `removed_at`. Removed users lose workspace access, but
their application history remains in place and visible to active members.
Foreign keys are restrictive; no destructive cascade may erase historical
applications.

## Controlled values

The application uses Python `StrEnum` values, string database columns, and
database `CHECK` constraints rather than PostgreSQL-native enum types.

| Domain field | Values |
| --- | --- |
| Membership role | `owner`, `member` |
| Application status | `applied`, `rejected`, `withdrawn`, `closed` |
| Work arrangement | `remote`, `hybrid`, `onsite`, `unknown` |
| Employment type | `full_time`, `part_time`, `contract`, `internship`, `temporary`, `unknown` |
| Salary period | `hourly`, `monthly`, `yearly` |

Status changes have no transition graph or status-history table in Milestone 1.
