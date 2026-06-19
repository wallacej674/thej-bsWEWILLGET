from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.settings import get_settings


def utc_now() -> datetime:
    return datetime.now(UTC)


def application_today() -> date:
    return datetime.now(ZoneInfo(get_settings().app_timezone)).date()
