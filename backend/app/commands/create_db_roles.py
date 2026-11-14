"""Set up least-privilege database roles (SEC-12).

Creates two login roles in the target database:

- a *migrator* that owns the schema and is the only role Alembic uses;
- an *app* role with SELECT/INSERT/UPDATE/DELETE on the tables and no DDL,
  which is the role the running API connects as.

Run once per database as its owner or a superuser, then point
MIGRATION_DATABASE_URL at the migrator and DATABASE_URL at the app role:

    DATABASE_ADMIN_URL=postgresql+psycopg://postgres:...@host/applytogether \\
    MIGRATOR_DB_PASSWORD=... APP_DB_PASSWORD=... \\
    python -m app.commands.create_db_roles

Safe to run again: existing roles keep working and get their passwords
reset only when a new one is supplied.
"""

from __future__ import annotations

import argparse
import os

from psycopg import sql
from sqlalchemy import Connection, ScalarResult, create_engine, text

DEFAULT_MIGRATOR = "applytogether_migrator"
DEFAULT_APP = "applytogether_app"
APP_TABLE_PRIVILEGES = "SELECT, INSERT, UPDATE, DELETE"
RLS_FUNCTIONS = (
    ("applytogether_workspace_actor", ""),
    ("applytogether_workspace_role", "uuid"),
    ("applytogether_invitee", "text"),
    ("applytogether_can_join", "uuid"),
    ("applytogether_active_member_count", "uuid"),
)


def _role_exists(connection: Connection, role: str) -> bool:
    return (
        connection.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = :role"), {"role": role}
        ).scalar()
        is not None
    )


def _run(connection: Connection, statement: sql.Composable) -> None:
    raw = connection.connection.dbapi_connection
    connection.exec_driver_sql(statement.as_string(raw))  # type: ignore[arg-type]


def apply_roles(
    connection: Connection,
    *,
    migrator: str = DEFAULT_MIGRATOR,
    app_role: str = DEFAULT_APP,
    migrator_password: str | None = None,
    app_password: str | None = None,
) -> None:
    """Create or update both roles and their grants on the current database."""
    for role, password in ((migrator, migrator_password), (app_role, app_password)):
        if not _role_exists(connection, role):
            statement = sql.SQL("CREATE ROLE {} LOGIN").format(sql.Identifier(role))
            if password:
                statement = sql.SQL("{} PASSWORD {}").format(
                    statement, sql.Literal(password)
                )
            _run(connection, statement)
        elif password:
            _run(
                connection,
                sql.SQL("ALTER ROLE {} WITH LOGIN PASSWORD {}").format(
                    sql.Identifier(role), sql.Literal(password)
                ),
            )

    database: str = connection.execute(text("SELECT current_database()")).scalar_one()
    m, a = sql.Identifier(migrator), sql.Identifier(app_role)
    statements: list[sql.Composable] = [
        sql.SQL("GRANT CONNECT ON DATABASE {} TO {}, {}").format(
            sql.Identifier(database), m, a
        ),
        sql.SQL("REVOKE CREATE ON SCHEMA public FROM PUBLIC"),
        sql.SQL("GRANT USAGE, CREATE ON SCHEMA public TO {}").format(m),
        sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(a),
    ]
    tables: ScalarResult[str] = connection.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    ).scalars()
    statements += [
        sql.SQL("ALTER TABLE public.{} OWNER TO {}").format(sql.Identifier(table), m)
        for table in tables
    ]
    statements += [
        sql.SQL(
            "GRANT " + APP_TABLE_PRIVILEGES + " ON ALL TABLES IN SCHEMA public TO {}"
        ).format(a),
        sql.SQL("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {}").format(
            a
        ),
        sql.SQL(
            "ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA public "
            "GRANT " + APP_TABLE_PRIVILEGES + " ON TABLES TO {}"
        ).format(m, a),
        sql.SQL(
            "ALTER DEFAULT PRIVILEGES FOR ROLE {} IN SCHEMA public "
            "GRANT USAGE, SELECT ON SEQUENCES TO {}"
        ).format(m, a),
    ]
    for grant in statements:
        _run(connection, grant)
    # When roles are provisioned after the RLS migration, the definer
    # functions must follow the tables to the new owner.
    for name, arguments in RLS_FUNCTIONS:
        if connection.scalar(
            text("SELECT to_regprocedure(:signature) IS NOT NULL"),
            {"signature": f"public.{name}({arguments})"},
        ):
            function = sql.SQL("public.{}({})").format(
                sql.Identifier(name), sql.SQL(arguments)
            )
            _run(
                connection, sql.SQL("ALTER FUNCTION {} OWNER TO {}").format(function, m)
            )
            _run(
                connection,
                sql.SQL("GRANT EXECUTE ON FUNCTION {} TO {}").format(function, a),
            )
    # Only migrations may move the schema version.
    if connection.execute(
        text("SELECT to_regclass('public.alembic_version')")
    ).scalar():
        _run(
            connection,
            sql.SQL(
                "REVOKE INSERT, UPDATE, DELETE ON public.alembic_version FROM {}"
            ).format(a),
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--migrator", default=DEFAULT_MIGRATOR)
    parser.add_argument("--app-role", default=DEFAULT_APP)
    args = parser.parse_args()
    admin_url = os.environ.get("DATABASE_ADMIN_URL")
    if not admin_url:
        raise SystemExit("Set DATABASE_ADMIN_URL to an owner or superuser connection.")
    engine = create_engine(admin_url)
    with engine.begin() as connection:
        apply_roles(
            connection,
            migrator=args.migrator,
            app_role=args.app_role,
            migrator_password=os.environ.get("MIGRATOR_DB_PASSWORD"),
            app_password=os.environ.get("APP_DB_PASSWORD"),
        )
    print(f"Roles {args.migrator} and {args.app_role} are set up.")


if __name__ == "__main__":
    main()
