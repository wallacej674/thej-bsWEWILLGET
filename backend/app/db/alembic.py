from alembic.config import Config

from app.core.settings import get_settings


def configure_database_url(config: Config) -> None:
    """Migrate as the schema owner when MIGRATION_DATABASE_URL is set."""
    settings = get_settings()
    url = settings.migration_database_url or settings.database_url
    config.set_main_option("sqlalchemy.url", str(url))
