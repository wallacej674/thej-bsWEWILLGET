from datetime import date, timedelta
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.settings import get_settings
from app.core.time import utc_now
from app.models.ai_quota import AiQuotaBucket


def reserve_ai_request(session: Session, user_id: UUID, workspace_id: UUID) -> None:
    settings = get_settings()
    today = utc_now().date()
    month = today.replace(day=1)
    next_day = today + timedelta(days=1)
    next_month = (month + timedelta(days=32)).replace(day=1)

    # Reserve all counters atomically. Commit before calling the provider so
    # failed or interrupted billable requests still count and hold no locks.
    with session.begin_nested():
        for scope, subject, start, limit, end in (
            (
                "user",
                str(user_id),
                today,
                settings.ai_tailor_daily_user_limit,
                next_day,
            ),
            (
                "workspace",
                str(workspace_id),
                today,
                settings.ai_tailor_daily_workspace_limit,
                next_day,
            ),
            ("global", "", month, settings.ai_tailor_monthly_request_limit, next_month),
        ):
            if limit == 0 or not _increment(session, scope, subject, start, limit):
                raise AppError(
                    429,
                    "ai_quota_exceeded",
                    "The résumé tailoring quota has been reached. Try again after it resets.",
                    {"scope": scope, "reset_at": f"{end.isoformat()}T00:00:00Z"},
                )
    session.commit()


def _increment(
    session: Session, scope: str, subject: str, start: date, limit: int
) -> bool:
    statement = insert(AiQuotaBucket).values(
        scope=scope, subject=subject, window_start=start, used=1
    )
    statement = statement.on_conflict_do_update(
        index_elements=[
            AiQuotaBucket.scope,
            AiQuotaBucket.subject,
            AiQuotaBucket.window_start,
        ],
        set_={"used": AiQuotaBucket.used + 1},
        where=AiQuotaBucket.used < limit,
    )
    return session.scalar(statement.returning(AiQuotaBucket.used)) is not None
