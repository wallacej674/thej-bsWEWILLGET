import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection
from sqlalchemy.orm import Session, sessionmaker

from alembic import command

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DEV_IDENTITY_HEADER_ENABLED", "true")
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://applytogether_test:applytogether_test@127.0.0.1:5433/applytogether_test",
)

from app.api.dependencies.current_user import get_db
from app.core.enums import MembershipRole
from app.db.session import get_engine
from app.main import app
from app.models.membership import WorkspaceMembership
from app.models.user import User
from app.models.workspace import Workspace

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session", autouse=True)
def migrated_test_database() -> Generator[None, None, None]:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(config, "head")
    yield


@pytest.fixture
def database_connection() -> Generator[Connection, None, None]:
    connection = get_engine().connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        transaction.rollback()
        connection.close()


@pytest.fixture
def database_session(database_connection: Connection) -> Generator[Session, None, None]:
    testing_session_factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = testing_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def api_client(database_connection: Connection) -> Generator[TestClient, None, None]:
    testing_session_factory = sessionmaker(
        bind=database_connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    def override_get_db() -> Generator[Session, None, None]:
        session = testing_session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def shared_workspace(database_session: Session) -> Workspace:
    workspace = Workspace(name="ApplyTogether")
    database_session.add(workspace)
    database_session.flush()
    return workspace


@pytest.fixture
def active_member(database_session: Session, shared_workspace: Workspace) -> User:
    user = User(email="jonathan@example.test", display_name="Jonathan")
    database_session.add(user)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
        )
    )
    database_session.flush()
    return user


@pytest.fixture
def second_active_member(
    database_session: Session, shared_workspace: Workspace
) -> User:
    user = User(email="kareem@example.test", display_name="Kareem")
    database_session.add(user)
    database_session.flush()
    database_session.add(
        WorkspaceMembership(
            workspace_id=shared_workspace.id,
            user_id=user.id,
            role=MembershipRole.OWNER,
        )
    )
    database_session.flush()
    return user
