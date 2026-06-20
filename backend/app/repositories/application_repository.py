from datetime import date
from uuid import UUID

from sqlalchemy import Select, and_, asc, desc, func, or_, select, union
from sqlalchemy.orm import Session, aliased

from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User


class ApplicationRepository:
    def list_active_for_dashboard(
        self, session: Session, workspace_id: UUID
    ) -> list[tuple[JobApplication, User]]:
        statement: Select[tuple[JobApplication, User]] = (
            select(JobApplication, User)
            .join(User, User.id == JobApplication.owner_id)
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            )
            .order_by(
                desc(JobApplication.updated_at),
                desc(JobApplication.created_at),
                JobApplication.id,
            )
        )
        return list(session.execute(statement).tuples())

    def summarize_active(
        self,
        session: Session,
        workspace_id: UUID,
        month_start: date,
        next_month_start: date,
    ) -> tuple[list[tuple[User, int]], int]:
        summary_owner_ids = union(
            select(WorkspaceMembership.user_id.label("user_id")).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None),
            ),
            select(JobApplication.owner_id.label("user_id")).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            ),
        ).subquery()
        active_application_join = and_(
            JobApplication.owner_id == User.id,
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_(None),
        )
        owner_statement = (
            select(User, func.count(JobApplication.id))
            .select_from(summary_owner_ids)
            .join(User, User.id == summary_owner_ids.c.user_id)
            .outerjoin(JobApplication, active_application_join)
            .group_by(User.id)
            .order_by(User.display_name, User.id)
        )
        owner_rows = [
            (owner, int(owner_total))
            for owner, owner_total in session.execute(owner_statement).tuples()
        ]
        current_month = session.scalar(
            select(func.count(JobApplication.id)).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
                JobApplication.application_date >= month_start,
                JobApplication.application_date < next_month_start,
            )
        )
        return owner_rows, current_month or 0

    def find_by_normalized_url(
        self,
        session: Session,
        workspace_id: UUID,
        owner_id: UUID,
        normalized_url: str,
    ) -> JobApplication | None:
        statement = select(JobApplication).where(
            JobApplication.workspace_id == workspace_id,
            JobApplication.owner_id == owner_id,
            JobApplication.normalized_job_posting_url == normalized_url,
        )
        return session.scalar(statement)

    def add(self, session: Session, application: JobApplication) -> None:
        session.add(application)

    def get_in_workspace(
        self, session: Session, workspace_id: UUID, application_id: UUID
    ) -> JobApplication | None:
        return session.scalar(
            select(JobApplication).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.id == application_id,
            )
        )

    def list_deleted(
        self,
        session: Session,
        workspace_id: UUID,
        user_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[JobApplication, User, User]], int]:
        filters = [
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_not(None),
            JobApplication.deleted_by_user_id == user_id,
        ]
        owner = aliased(User)
        deleter = aliased(User)
        statement: Select[tuple[JobApplication, User, User]] = (
            select(JobApplication, owner, deleter)
            .join(owner, owner.id == JobApplication.owner_id)
            .join(deleter, deleter.id == JobApplication.deleted_by_user_id)
            .where(*filters)
            .order_by(desc(JobApplication.deleted_at), JobApplication.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count()).select_from(JobApplication).where(*filters)
        )
        return list(session.execute(statement).tuples()), total or 0

    def list_deleted_for_permanent_deletion(
        self,
        session: Session,
        workspace_id: UUID,
        *,
        application_ids: list[UUID] | None = None,
        eligible_user_id: UUID | None = None,
    ) -> list[JobApplication]:
        filters = [
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_not(None),
        ]
        if application_ids is not None:
            filters.append(JobApplication.id.in_(application_ids))
        if eligible_user_id is not None:
            filters.extend(
                [
                    JobApplication.owner_id == eligible_user_id,
                    JobApplication.deleted_by_user_id == eligible_user_id,
                ]
            )
        return list(session.scalars(select(JobApplication).where(*filters)))

    def list_active(
        self,
        session: Session,
        workspace_id: UUID,
        *,
        search: str | None,
        owner_id: UUID | None,
        status: ApplicationStatus | None,
        work_arrangement: WorkArrangement | None,
        employment_type: EmploymentType | None,
        sort_by: str,
        sort_order: str,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[JobApplication, User]], int]:
        filters = [
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_(None),
        ]
        if search:
            pattern = f"%{search}%"
            filters.append(
                or_(
                    JobApplication.company_name.ilike(pattern),
                    JobApplication.job_title.ilike(pattern),
                )
            )
        if owner_id is not None:
            filters.append(JobApplication.owner_id == owner_id)
        if status is not None:
            filters.append(JobApplication.status == status)
        if work_arrangement is not None:
            filters.append(JobApplication.work_arrangement == work_arrangement)
        if employment_type is not None:
            filters.append(JobApplication.employment_type == employment_type)

        sort_column = {
            "application_date": JobApplication.application_date,
            "created_at": JobApplication.created_at,
            "updated_at": JobApplication.updated_at,
            "company_name": JobApplication.company_name,
            "job_title": JobApplication.job_title,
        }[sort_by]
        ordering = asc(sort_column) if sort_order == "asc" else desc(sort_column)
        statement: Select[tuple[JobApplication, User]] = (
            select(JobApplication, User)
            .join(User, User.id == JobApplication.owner_id)
            .where(*filters)
            .order_by(ordering, JobApplication.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        total = session.scalar(
            select(func.count()).select_from(JobApplication).where(*filters)
        )
        return list(session.execute(statement).tuples()), total or 0
