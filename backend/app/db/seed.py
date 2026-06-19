"""Create the local ApplyTogether development workspace without startup seeding."""

import argparse
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import (
    ApplicationStatus,
    EmploymentType,
    MembershipRole,
    WorkArrangement,
)
from app.core.settings import get_settings
from app.core.time import application_today
from app.core.url_normalization import normalize_job_posting_url
from app.db.session import get_session_factory
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace


def _get_or_create_user(session: Session, email: str, display_name: str) -> User:
    normalized_email = email.strip().lower()
    user = session.scalar(select(User).where(User.email == normalized_email))
    if user is None:
        user = User(email=normalized_email, display_name=display_name.strip())
        session.add(user)
        session.flush()
    else:
        user.display_name = display_name.strip()
        user.is_active = True
    return user


def _get_or_create_workspace(session: Session) -> Workspace:
    workspace = session.scalar(
        select(Workspace).where(Workspace.name == "ApplyTogether")
    )
    if workspace is None:
        workspace = Workspace(name="ApplyTogether")
        session.add(workspace)
        session.flush()
    return workspace


def _ensure_owner(session: Session, workspace: Workspace, user: User) -> None:
    membership = session.scalar(
        select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == workspace.id,
            WorkspaceMembership.user_id == user.id,
        )
    )
    if membership is None:
        session.add(
            WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=user.id,
                role=MembershipRole.OWNER,
            )
        )
    else:
        membership.role = MembershipRole.OWNER
        membership.removed_at = None


def _ensure_sample_application(
    session: Session, workspace: Workspace, owner: User
) -> None:
    url = f"https://jobs.example.test/{owner.display_name.lower()}-sample"
    normalized_url = normalize_job_posting_url(url)
    existing = session.scalar(
        select(JobApplication).where(
            JobApplication.workspace_id == workspace.id,
            JobApplication.owner_id == owner.id,
            JobApplication.normalized_job_posting_url == normalized_url,
        )
    )
    if existing is None:
        session.add(
            JobApplication(
                workspace_id=workspace.id,
                owner_id=owner.id,
                company_name="Fictional Systems",
                job_title=f"Sample Role for {owner.display_name}",
                job_posting_url=url,
                normalized_job_posting_url=normalized_url,
                location="Remote",
                work_arrangement=WorkArrangement.REMOTE,
                employment_type=EmploymentType.FULL_TIME,
                application_date=application_today(),
                status=ApplicationStatus.APPLIED,
            )
        )


def seed(with_sample_applications: bool = False) -> tuple[UUID, UUID, UUID]:
    settings = get_settings()
    if settings.environment not in {"development", "test"}:
        raise RuntimeError("The seed command is only permitted in development or test.")
    with get_session_factory()() as session:
        jonathan = _get_or_create_user(
            session, settings.seed_jonathan_email, settings.seed_jonathan_display_name
        )
        kareem = _get_or_create_user(
            session, settings.seed_kareem_email, settings.seed_kareem_display_name
        )
        workspace = _get_or_create_workspace(session)
        _ensure_owner(session, workspace, jonathan)
        _ensure_owner(session, workspace, kareem)
        if with_sample_applications:
            _ensure_sample_application(session, workspace, jonathan)
            _ensure_sample_application(session, workspace, kareem)
        session.commit()
        return jonathan.id, kareem.id, workspace.id


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed the ApplyTogether development data."
    )
    parser.add_argument("--with-sample-applications", action="store_true")
    args = parser.parse_args()
    jonathan_id, kareem_id, workspace_id = seed(args.with_sample_applications)
    print(f"Jonathan user UUID: {jonathan_id}")
    print(f"Kareem user UUID: {kareem_id}")
    print(f"ApplyTogether workspace UUID: {workspace_id}")


if __name__ == "__main__":
    main()
