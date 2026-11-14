"""SEC-12: least-privilege roles, a separate migration URL, and timeouts."""

from uuid import uuid4

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.commands.create_db_roles import apply_roles
from app.core.settings import get_settings
from app.db.alembic import configure_database_url
from app.db.session import get_engine


@pytest.fixture
def roles(database_connection):
    """Create throwaway roles inside the test transaction (rolled back after)."""
    suffix = uuid4().hex[:8]
    migrator, app_role = f"test_migrator_{suffix}", f"test_app_{suffix}"
    apply_roles(database_connection, migrator=migrator, app_role=app_role)
    return database_connection, migrator, app_role


def _denied(connection, statement: str) -> bool:
    savepoint = connection.begin_nested()
    try:
        connection.execute(text(statement))
    except ProgrammingError as error:
        savepoint.rollback()
        return "permission denied" in str(error) or "must be owner" in str(error)
    savepoint.rollback()
    return False


def test_the_app_role_can_use_data_but_not_change_the_schema(roles) -> None:
    connection, _migrator, app_role = roles
    connection.execute(text(f'SET LOCAL ROLE "{app_role}"'))

    connection.execute(text("SELECT count(*) FROM users"))
    # RLS policy functions remain executable after provisioning the app role
    # on a database that was migrated before that role existed.
    connection.execute(text("SELECT count(*) FROM job_applications"))
    assert (
        connection.scalar(
            text("SELECT public.applytogether_active_member_count(gen_random_uuid())")
        )
        == 0
    )
    assert _denied(connection, "DROP TABLE users")
    assert _denied(connection, "ALTER TABLE users ADD COLUMN sneaky text")
    assert _denied(connection, "CREATE TABLE public.sneaky (id int)")
    assert _denied(connection, "UPDATE alembic_version SET version_num = version_num")


def test_tables_the_migrator_creates_are_usable_by_the_app(roles) -> None:
    connection, migrator, app_role = roles
    connection.execute(text(f'SET LOCAL ROLE "{migrator}"'))
    connection.execute(text("CREATE TABLE public.roles_probe (id int)"))

    connection.execute(text(f'SET LOCAL ROLE "{app_role}"'))
    connection.execute(text("INSERT INTO public.roles_probe VALUES (1)"))
    assert connection.execute(text("SELECT count(*) FROM roles_probe")).scalar() == 1


def test_running_twice_is_safe(roles) -> None:
    connection, migrator, app_role = roles
    apply_roles(connection, migrator=migrator, app_role=app_role)


def test_alembic_prefers_the_migration_url(monkeypatch: pytest.MonkeyPatch) -> None:
    migrator_url = "postgresql+psycopg://migrator:pw@127.0.0.1:5432/applytogether"
    monkeypatch.setenv("MIGRATION_DATABASE_URL", migrator_url)
    get_settings.cache_clear()
    try:
        config = Config("alembic.ini")
        configure_database_url(config)
        assert config.get_main_option("sqlalchemy.url") == migrator_url
    finally:
        get_settings.cache_clear()


def test_api_connections_carry_server_side_timeouts() -> None:
    with get_engine().connect() as connection:
        assert connection.execute(text("SHOW statement_timeout")).scalar() == "5s"
        assert (
            connection.execute(
                text("SHOW idle_in_transaction_session_timeout")
            ).scalar()
            == "10s"
        )
