from alembic.config import Config

from app.core.settings import get_settings


def configure_database_url(config: Config) -> None:
    config.set_main_option("sqlalchemy.url", str(get_settings().database_url))
