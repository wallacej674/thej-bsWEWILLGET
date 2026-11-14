from datetime import date

from sqlalchemy import Date, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AiQuotaBucket(Base):
    __tablename__ = "ai_quota_buckets"

    scope: Mapped[str] = mapped_column(String(16), primary_key=True)
    subject: Mapped[str] = mapped_column(String(36), primary_key=True)
    window_start: Mapped[date] = mapped_column(Date, primary_key=True)
    used: Mapped[int]
