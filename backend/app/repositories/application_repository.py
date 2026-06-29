from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import (
    ColumnElement,
    Select,
    and_,
    asc,
    case,
    desc,
    func,
    or_,
    select,
    union,
)
from sqlalchemy.orm import Session, aliased

from app.core.enums import ApplicationStatus, EmploymentType, WorkArrangement
from app.models.application import JobApplication
from app.models.membership import WorkspaceMembership
from app.models.user import User

# Sort keys accepted by the team-accountability endpoint, mapped per-call to the
# aggregate column they order by. Kept here so the route/service can validate
# input against a single source of truth.
TEAM_ACCOUNTABILITY_SORTS = ("active", "this_week", "rejected", "last_applied", "name")


class ApplicationRepository:
    def summarize_totals(
        self,
        session: Session,
        workspace_id: UUID,
        user_id: UUID,
        week_start: date,
        next_week_start: date,
    ) -> tuple[int, int, int, int]:
        """Return (total_active, current_week, recently_updated, deleted).

        Constant cost regardless of member or application count: two aggregate
        queries, no per-row materialization.
        """
        edited = JobApplication.updated_at >= JobApplication.created_at + timedelta(
            seconds=1
        )
        in_week = and_(
            JobApplication.application_date >= week_start,
            JobApplication.application_date < next_week_start,
        )
        total_active, current_week, recently_updated = session.execute(
            select(
                func.count(JobApplication.id),
                func.count(case((in_week, JobApplication.id))),
                func.count(case((edited, JobApplication.id))),
            ).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            )
        ).one()
        deleted = session.scalar(
            select(func.count())
            .select_from(JobApplication)
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_not(None),
                JobApplication.deleted_by_user_id == user_id,
            )
        )
        return (
            int(total_active or 0),
            int(current_week or 0),
            int(recently_updated or 0),
            int(deleted or 0),
        )

    def summarize_status_counts(
        self, session: Session, workspace_id: UUID
    ) -> dict[ApplicationStatus, int]:
        rows = session.execute(
            select(JobApplication.status, func.count(JobApplication.id))
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            )
            .group_by(JobApplication.status)
        ).tuples()
        counts = {status: 0 for status in ApplicationStatus}
        for status, count in rows:
            counts[status] = int(count)
        return counts

    def summarize_work_arrangement_counts(
        self, session: Session, workspace_id: UUID
    ) -> dict[WorkArrangement, int]:
        rows = session.execute(
            select(JobApplication.work_arrangement, func.count(JobApplication.id))
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            )
            .group_by(JobApplication.work_arrangement)
        ).tuples()
        counts = {arrangement: 0 for arrangement in WorkArrangement}
        for arrangement, count in rows:
            counts[arrangement] = int(count)
        return counts

    def applications_over_time(
        self,
        session: Session,
        workspace_id: UUID,
        window_start: date,
        window_end: date,
    ) -> dict[date, int]:
        """Daily active-application counts within [window_start, window_end).

        Bounded by the number of distinct application dates in the window (at
        most one row per day); the service buckets these into weekly totals.
        """
        rows = session.execute(
            select(JobApplication.application_date, func.count(JobApplication.id))
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
                JobApplication.application_date >= window_start,
                JobApplication.application_date < window_end,
            )
            .group_by(JobApplication.application_date)
        ).tuples()
        return {day: int(count) for day, count in rows}

    def top_applicants(
        self, session: Session, workspace_id: UUID, limit: int
    ) -> list[tuple[User, int]]:
        total = func.count(JobApplication.id).label("active_total")
        statement = (
            select(User, total)
            .join(User, User.id == JobApplication.owner_id)
            .where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            )
            .group_by(User.id)
            .order_by(desc(total), User.display_name, User.id)
            .limit(limit)
        )
        return [
            (owner, int(count)) for owner, count in session.execute(statement).tuples()
        ]

    def list_recent_activity(
        self, session: Session, workspace_id: UUID, limit: int
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
            .limit(limit)
        )
        return list(session.execute(statement).tuples())

    def team_accountability(
        self,
        session: Session,
        workspace_id: UUID,
        *,
        week_start: date,
        next_week_start: date,
        sort: str,
        order: str,
        page: int,
        page_size: int,
    ) -> tuple[list[tuple[User, int, int, int, date | None]], int]:
        """Per-owner accountability rows via a single GROUP BY (constant cost).

        The owner universe is the union of active members and owners of active
        applications, matching workspace visibility. Aggregates are computed in
        one grouped query; pagination and sorting happen in SQL so the response
        is bounded regardless of member count.
        """
        owner_ids = union(
            select(WorkspaceMembership.user_id.label("user_id")).where(
                WorkspaceMembership.workspace_id == workspace_id,
                WorkspaceMembership.removed_at.is_(None),
            ),
            select(JobApplication.owner_id.label("user_id")).where(
                JobApplication.workspace_id == workspace_id,
                JobApplication.deleted_at.is_(None),
            ),
        ).subquery()
        active_join = and_(
            JobApplication.owner_id == User.id,
            JobApplication.workspace_id == workspace_id,
            JobApplication.deleted_at.is_(None),
        )
        active_total = func.count(JobApplication.id).label("active_total")
        this_week_total = func.count(
            case(
                (
                    and_(
                        JobApplication.application_date >= week_start,
                        JobApplication.application_date < next_week_start,
                    ),
                    JobApplication.id,
                )
            )
        ).label("this_week_total")
        rejected_total = func.count(
            case(
                (JobApplication.status == ApplicationStatus.REJECTED, JobApplication.id)
            )
        ).label("rejected_total")
        last_applied = func.max(JobApplication.application_date).label("last_applied")

        statement = (
            select(User, active_total, this_week_total, rejected_total, last_applied)
            .select_from(owner_ids)
            .join(User, User.id == owner_ids.c.user_id)
            .outerjoin(JobApplication, active_join)
            .group_by(User.id)
        )

        sort_columns: dict[str, ColumnElement[Any]] = {
            "active": active_total,
            "this_week": this_week_total,
            "rejected": rejected_total,
            "last_applied": last_applied,
        }
        if sort == "name":
            name_order = (
                asc(User.display_name) if order == "asc" else desc(User.display_name)
            )
            statement = statement.order_by(name_order, User.id)
        else:
            column = sort_columns[sort]
            primary = asc(column) if order == "asc" else desc(column)
            statement = statement.order_by(
                primary.nulls_last(), User.display_name, User.id
            )

        statement = statement.offset((page - 1) * page_size).limit(page_size)
        rows: list[tuple[User, int, int, int, date | None]] = [
            (owner, int(active), int(this_week), int(rejected), last)
            for owner, active, this_week, rejected, last in session.execute(
                statement
            ).tuples()
        ]
        total = session.scalar(select(func.count()).select_from(owner_ids))
        return rows, int(total or 0)

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
