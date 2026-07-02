"""Seed a large workspace for validating 100+ member scale.

Generates a workspace with many members and applications using bulk inserts so
that 100–200 members (and a ~1k smoke run) populate quickly. Used by the manual
CLI and by the scale smoke test. Development/test only.
"""

import argparse
from datetime import date, timedelta
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    MembershipRole,
    WorkArrangement,
)
from app.core.settings import get_settings
from app.core.time import application_today
from app.db.session import get_session_factory
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace

_STATUSES = list(ApplicationStatus)
_ARRANGEMENTS = list(WorkArrangement)
_EMPLOYMENT = list(EmploymentType)


def seed_large_workspace(
    session: Session,
    *,
    member_count: int,
    apps_per_member: int,
    workspace_name: str | None = None,
    today: date | None = None,
) -> tuple[UUID, UUID]:
    """Create a workspace with ``member_count`` members and applications.

    Returns ``(workspace_id, owner_id)``. Applications are spread across the
    trailing ten weeks (deterministically, by index) so the over-time chart and
    this-week totals are populated. The first member is the workspace owner.
    """
    if member_count < 1:
        raise ValueError("member_count must be at least 1")
    today = today or application_today()
    workspace = Workspace(name=workspace_name or f"Scale Test {uuid4().hex[:8]}")
    session.add(workspace)
    session.flush()

    user_ids: list[UUID] = []
    user_rows = []
    membership_rows = []
    for index in range(member_count):
        user_id = uuid4()
        user_ids.append(user_id)
        user_rows.append(
            {
                "id": user_id,
                "email": f"scale-{uuid4().hex}@example.test",
                "display_name": f"Member {index + 1:04d}",
                "is_active": True,
                "failed_login_attempts": 0,
            }
        )
        membership_rows.append(
            {
                "id": uuid4(),
                "workspace_id": workspace.id,
                "user_id": user_id,
                "role": MembershipRole.OWNER if index == 0 else MembershipRole.MEMBER,
            }
        )
    session.bulk_insert_mappings(User, user_rows)
    session.bulk_insert_mappings(WorkspaceMembership, membership_rows)

    application_rows = []
    counter = 0
    for member_index, user_id in enumerate(user_ids):
        for app_index in range(apps_per_member):
            application_date = today - timedelta(weeks=(counter % 10))
            url = (
                f"https://jobs.example.test/scale/{workspace.id}/{user_id}/{app_index}"
            )
            application_rows.append(
                {
                    "id": uuid4(),
                    "workspace_id": workspace.id,
                    "owner_id": user_id,
                    "company_name": f"Company {member_index + 1:04d}-{app_index}",
                    "job_title": f"Role {app_index}",
                    "job_posting_url": url,
                    "normalized_job_posting_url": url,
                    "location": "Remote",
                    "work_arrangement": _ARRANGEMENTS[counter % len(_ARRANGEMENTS)],
                    "employment_type": _EMPLOYMENT[counter % len(_EMPLOYMENT)],
                    "application_date": application_date,
                    "status": _STATUSES[counter % len(_STATUSES)],
                }
            )
            counter += 1
    if application_rows:
        session.bulk_insert_mappings(JobApplication, application_rows)
    session.commit()
    return workspace.id, user_ids[0]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed a large ApplyTogether workspace for scale validation."
    )
    parser.add_argument("--members", type=int, default=150)
    parser.add_argument("--apps-per-member", type=int, default=3)
    parser.add_argument("--name", type=str, default=None)
    args = parser.parse_args()

    settings = get_settings()
    if settings.environment not in {"development", "test"}:
        raise RuntimeError(
            "The scale seed command is only permitted in development or test."
        )

    with get_session_factory()() as session:
        workspace_id, owner_id = seed_large_workspace(
            session,
            member_count=args.members,
            apps_per_member=args.apps_per_member,
            workspace_name=args.name,
        )
    print(f"Workspace UUID: {workspace_id}")
    print(f"Owner user UUID: {owner_id}")
    print(f"Members: {args.members}, applications per member: {args.apps_per_member}")


if __name__ == "__main__":
    main()
