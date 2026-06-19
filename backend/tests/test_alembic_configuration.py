from alembic.config import Config

from app.core.settings import get_settings
from app.db.alembic import configure_database_url


def test_alembic_uses_database_url_from_application_settings(monkeypatch) -> None:
    database_url = (
        "postgresql+psycopg://ci_test_user:ci_test_password@127.0.0.1:5432/"
        "applytogether_test"
    )
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")

        configure_database_url(config)

        assert config.get_main_option("sqlalchemy.url") == database_url
    finally:
        get_settings.cache_clear()
