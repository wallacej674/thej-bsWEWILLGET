from uuid import UUID

from sqlalchemy import String, cast, delete, func, literal, select, update
from sqlalchemy.orm import Session

from app.core.enums import MembershipRole
from app.core.errors import AppError
from app.core.passwords import dummy_verify, verify_and_upgrade
from app.core.time import utc_now
from app.db.row_security import allow_account_data
from app.models.ai_analysis import ApplicationAiAnalysis
from app.models.ai_quota import AiQuotaBucket
from app.models.application import JobApplication
from app.models.auth_session import AuthenticationSession
from app.models.invitation import WorkspaceInvitation
from app.models.membership import WorkspaceMembership
from app.models.pending_registration import PendingRegistration
from app.models.resume import UserResume
from app.models.user import User
from app.models.workspace import Workspace
from app.schemas.user import AccountExport


def lock_active_user(session: Session, user_id: UUID) -> User:
    user = session.scalar(
        select(User)
        .where(User.id == user_id, User.is_active)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if user is None:
        raise AppError(401, "authentication_required", "Authentication is required.")
    return user


def export_account(session: Session, user: User) -> AccountExport:
    allow_account_data(session)
    # Export table fields from the owner's records, with no nested profiles.
    applications = session.scalars(
        select(JobApplication)
        .where(JobApplication.owner_id == user.id)
        .order_by(JobApplication.created_at, JobApplication.id)
    )
    resume = session.scalar(select(UserResume).where(UserResume.user_id == user.id))
    analyses = session.scalars(
        select(ApplicationAiAnalysis)
        .where(ApplicationAiAnalysis.user_id == user.id)
        .order_by(ApplicationAiAnalysis.created_at, ApplicationAiAnalysis.id)
    )
    return AccountExport(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        applications=[
            {
                "id": row.id,
                "workspace_id": row.workspace_id,
                "company_name": row.company_name,
                "job_title": row.job_title,
                "job_posting_url": row.job_posting_url,
                "location": row.location,
                "work_arrangement": row.work_arrangement,
                "employment_type": row.employment_type,
                "application_date": row.application_date,
                "status": row.status,
                "salary_min": row.salary_min,
                "salary_max": row.salary_max,
                "salary_currency": row.salary_currency,
                "salary_period": row.salary_period,
                "job_description": row.job_description,
                "notes": row.notes,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
                "deleted_at": row.deleted_at,
            }
            for row in applications
        ],
        resume=(
            {
                "filename": resume.original_filename,
                "text": resume.extracted_text,
                "parser_status": resume.parser_status,
                "parser_warnings": resume.parser_warnings,
                "updated_at": resume.updated_at,
            }
            if resume
            else None
        ),
        analyses=[
            {
                "id": row.id,
                "workspace_id": row.workspace_id,
                "application_id": row.application_id,
                "result": row.result,
                "created_at": row.created_at,
                "updated_at": row.updated_at,
            }
            for row in analyses
        ],
    )


def delete_account(session: Session, user_id: UUID, password: str) -> None:
    user = lock_active_user(session, user_id)
    if user.password_hash is None:
        dummy_verify(password)
    if (
        user.password_hash is None
        or not verify_and_upgrade(password, user.password_hash)[0]
    ):
        raise AppError(
            400, "current_password_invalid", "The current password is incorrect."
        )

    allow_account_data(session)
    # Serialize account deletion for co-owners. At READ COMMITTED the owner
    # check below sees any co-owner's deletion that released these locks.
    owned_workspaces = session.scalars(
        select(Workspace.id)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(
            WorkspaceMembership.user_id == user_id,
            WorkspaceMembership.role == MembershipRole.OWNER,
            WorkspaceMembership.removed_at.is_(None),
            Workspace.deleted_at.is_(None),
        )
        .order_by(Workspace.id)
        .with_for_update(of=Workspace)
    ).all()
    for workspace_id in owned_workspaces:
        co_owner = session.scalar(
            select(WorkspaceMembership.id)
            .join(User, User.id == WorkspaceMembership.user_id)
            .where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.user_id != user_id,
                WorkspaceMembership.role == MembershipRole.OWNER,
                WorkspaceMembership.removed_at.is_(None),
                User.is_active,
            )
            .limit(1)
        )
        if co_owner is None:
            raise AppError(
                409,
                "account_sole_workspace_owner",
                "Delete workspaces where you are the sole owner before deleting your account.",
                {"workspace_id": str(workspace_id)},
            )

    session.execute(
        delete(AuthenticationSession).where(AuthenticationSession.user_id == user_id)
    )
    session.execute(delete(UserResume).where(UserResume.user_id == user_id))
    session.execute(
        delete(ApplicationAiAnalysis).where(ApplicationAiAnalysis.user_id == user_id)
    )
    session.execute(
        delete(AiQuotaBucket).where(
            AiQuotaBucket.scope == "user", AiQuotaBucket.subject == str(user_id)
        )
    )
    session.execute(
        delete(PendingRegistration).where(PendingRegistration.email == user.email)
    )
    session.execute(
        delete(WorkspaceInvitation).where(
            func.lower(WorkspaceInvitation.email) == user.email
        )
    )
    session.execute(
        update(WorkspaceInvitation)
        .where(
            WorkspaceInvitation.invited_by_user_id == user_id,
            WorkspaceInvitation.accepted_at.is_(None),
            WorkspaceInvitation.declined_at.is_(None),
        )
        .values(declined_at=utc_now())
    )
    session.execute(
        update(WorkspaceMembership)
        .where(WorkspaceMembership.user_id == user_id)
        .values(
            removed_at=func.coalesce(WorkspaceMembership.removed_at, utc_now()),
            weekly_goal=None,
        )
    )
    # Retain team status history while replacing personal text and tracked URLs.
    session.execute(
        update(JobApplication)
        .where(JobApplication.owner_id == user_id)
        .values(
            notes=None,
            job_description=None,
            job_posting_url=literal("https://deleted.invalid/")
            + cast(JobApplication.id, String),
            normalized_job_posting_url=literal("https://deleted.invalid/")
            + cast(JobApplication.id, String),
        )
    )
    user.email = f"{user_id.hex}@deleted.invalid"
    user.display_name = "Deleted account"
    user.avatar_url = None
    user.google_subject = None
    user.password_hash = None
    user.password_changed_at = None
    user.last_login_at = None
    user.is_active = False
    session.commit()
