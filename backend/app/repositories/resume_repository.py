from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.resume import UserResume


class ResumeRepository:
    def get_for_user(self, session: Session, user_id: UUID) -> UserResume | None:
        return session.scalar(select(UserResume).where(UserResume.user_id == user_id))
