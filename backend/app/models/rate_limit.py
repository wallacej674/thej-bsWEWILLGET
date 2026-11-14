from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RateLimitCounter(Base):
    """Requests counted against one rate-limit key in one fixed window."""

    __tablename__ = "rate_limit_counters"
    __table_args__ = (
        CheckConstraint("hits > 0", name="ck_rate_limit_counters_hits_positive"),
    )

    key_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), primary_key=True, index=True
    )
    hits: Mapped[int] = mapped_column(Integer, nullable=False)
