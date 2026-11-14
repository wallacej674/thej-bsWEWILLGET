from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LoginThrottleBucket(Base):
    """Failed sign-in attempts against one email from one source.

    A source is a recognised device, an IP address, or "untrusted" (every
    attempt without a recognised device, counted together as a backstop).
    Digests are keyed hashes, so the typed email and the IP aren't stored.
    """

    __tablename__ = "login_throttle_buckets"
    __table_args__ = (
        UniqueConstraint(
            "email_digest", "source_digest", name="uq_login_throttle_buckets_key"
        ),
        CheckConstraint(
            "scope IN ('device', 'ip', 'untrusted')",
            name="ck_login_throttle_buckets_scope",
        ),
        CheckConstraint(
            "failures >= 0 AND lock_count >= 0",
            name="ck_login_throttle_buckets_counts_nonnegative",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    source_digest: Mapped[str] = mapped_column(String(64), nullable=False)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)
    failures: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    window_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    last_failure_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), index=True
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lock_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
