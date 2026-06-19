# ApplyTogether

ApplyTogether is a shared job-application accountability workspace. Milestone 1
provides a FastAPI and PostgreSQL backend for Jonathan and Kareem; it includes
shared visibility, owner-only application changes, soft deletion, restoration,
and searchable paginated application records. It does not include a frontend,
OAuth, newsletters, invitations, goals, analytics, or deployment.

## Prerequisites

- Docker Desktop with Docker Compose
- Python 3.12
- [uv](https://docs.astral.sh/uv/)

## Local setup

Start a development PostgreSQL instance (the separate `db-test` service is
used by the test suite):

```powershell
docker compose up -d db
```

Configure and install the backend:

```powershell
cd backend
Copy-Item .env.example .env
uv sync --locked
uv run alembic upgrade head
```

Seed the two owner accounts and shared workspace. This command is available
only when `ENVIRONMENT` is `development` or `test`; startup never seeds data.

```powershell
uv run python -m app.db.seed
uv run python -m app.db.seed --with-sample-applications
```

Start the API:

```powershell
uv run uvicorn app.main:app --reload
```

OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

## Development identity

Milestone 1 uses a development-only `X-User-Id` header. Copy a seeded UUID
from the seed command output and pass it on authenticated requests:

```powershell
$headers = @{ "X-User-Id" = "<seeded-user-uuid>" }
Invoke-RestMethod http://127.0.0.1:8000/api/v1/users/me -Headers $headers
Invoke-RestMethod http://127.0.0.1:8000/api/v1/workspaces -Headers $headers
```

The app fails startup if `DEV_IDENTITY_HEADER_ENABLED=true` outside
development or test. Production authentication is deliberately not part of
this milestone.

## Database and quality commands

From `backend/`:

```powershell
uv run alembic upgrade head
uv run alembic downgrade -1
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run pytest
```

Tests require PostgreSQL, not SQLite. Start the isolated test database first:

```powershell
docker compose up -d db-test
```

Install pre-commit hooks from the repository root:

```powershell
uv tool run pre-commit install
```

The GitHub Actions workflow runs the locked dependency install, Ruff, MyPy,
Alembic migrations, and the complete PostgreSQL-backed test suite.
