# ApplyTogether

ApplyTogether is a shared job-application accountability workspace for Jonathan
and Kareem. Milestone 1, the FastAPI/PostgreSQL foundation, is complete.
Milestone 2 integrates the React/Vite frontend with that API for shared
visibility, owner-only changes, soft deletion, restoration, filtering, and
pagination. Milestone 3 replaces the normal development identity flow with
secure email/password authentication. Google login remains a future enhancement
that can link to the existing `users` records.

## Production security headers

The API sends HSTS, disables MIME sniffing and framing, and sends
`Cache-Control: no-store` for authenticated and user-data responses.
`frontend/vercel.json` sets the browser policy for the SPA. The production
frontend uses `VITE_API_BASE_URL=/api` so all browser API calls stay on the
same origin. Use those response headers on other static hosts and add an
explicit `connect-src` origin if the browser calls a separately hosted API.

## AI quota

Résumé tailoring reserves one request against per-user and per-workspace UTC
daily quotas and a global UTC monthly ceiling before contacting the provider.
Set `AI_TAILOR_MONTHLY_REQUEST_LIMIT` from the monthly budget and the
configured model's worst-case cost per request. Set it to zero to pause
tailoring. Each request admitted to the tailoring provider counts, including
requests the provider adapter rejects before sending and upstream failures.

## Database row security

Run migrations as the table owner and configure the API to connect as a
separate DML-only role with no `BYPASSRLS`. The migration grants its five
`applytogether_*` policy functions to the existing `applytogether_app` role.
If you provision that role later or use a different runtime role, grant it
`EXECUTE` on those five functions. A superuser or table owner
bypasses these policies. Use the privileged connection for seed and migration
commands. The API binds verified user identity to each transaction. Application
owners can export or anonymize their own records through the account endpoints.

## Verification email deployment

Configure the backend `TURNSTILE_SECRET_KEY` and the frontend
`VITE_TURNSTILE_SITE_KEY` for the public signup hostname. Use the same
hostname in `FRONTEND_BASE_URL`. The server checks the signup action and
hostname before creating a registration. Signup and resend share hourly
request budgets by client IP and delivery budgets by recipient domain. Configure
forwarded-address trust at the API server for known ingress proxies only. Session
prefixes and signup limits both use the resulting client address.

Before enabling production signup, check that SPF authorizes the SMTP provider,
DKIM signatures pass, and the sending domain aligns with the From address under
DMARC. Inspect a test delivery's authentication results.

## Authentication

The backend uses AuthX 1.7 for short-lived access JWTs, longer-lived rotating
refresh JWTs, HTTP-only cookies, and CSRF claims. pwdlib 0.3 with Argon2id
hashes local passwords; plaintext passwords are never stored. Server-side
`authentication_sessions` records hold the active-session, expiration,
revocation, and hashed refresh-token identifier state needed for logout,
rotation, and password-change revocation.

New accounts are created through `/signup` and remain in
`pending_registrations` until the email owner follows a one-time verification
link. Only the token digest is stored. Verification creates the user, claims
matching workspace invitations, or creates the requested fallback workspace.

Verification email is sent by the backend through Google SMTP. Configure
`SMTP_USERNAME`, `SMTP_APP_PASSWORD`, `SMTP_FROM_EMAIL`, and
`FRONTEND_BASE_URL` in `backend/.env`. Use the Google app password generated
for the sending account, not its normal account password. Keep these values
server-side and never expose them through a `VITE_` variable or other frontend
configuration. A missing development email configuration produces a retryable
delivery error while preserving the pending registration.

Set `AUTH_JWT_SECRET_KEY` to a long random value in `backend/.env`; do not add
it to Git or frontend configuration. Assign an initial password only through
the interactive administrative command (the password is never accepted as a
command-line argument):

```powershell
cd backend
python -m app.commands.set_password --email jonathan@example.test
```

The frontend sends credentialed requests and never reads JWTs. Unsafe access
requests use `X-CSRF-Token`; refresh uses `X-Refresh-CSRF-Token`. The
development `X-User-Id` fallback is disabled by default and can only be enabled
in development or test with an explicit backend setting and frontend flag.

## Prerequisites

- Docker Desktop with Docker Compose
- Python 3.12
- [uv](https://docs.astral.sh/uv/)
- Node.js 22.22 or newer in the 22.x release line
- npm (the frontend package manager)

## Run the integrated application

For the usual local development flow, use two VS Code terminals from the
repository root so backend and frontend logs stay visible.

Terminal 1:

```powershell
.\dev-backend.ps1
```

Terminal 2:

```powershell
.\dev-frontend.ps1
```

The backend script starts PostgreSQL, runs `uv sync --locked`, applies
migrations, checks that port 8000 is not already occupied, and starts Uvicorn.
The frontend script runs `npm ci`, points Vite at `http://localhost:8000`, and
starts Vite.

Start PostgreSQL from the repository root. The project database uses host port
5434 to avoid colliding with locally installed PostgreSQL services:

```powershell
docker compose up -d db
```

Configure, migrate, and seed the backend:

```powershell
cd backend
Copy-Item .env.example .env
uv sync --locked
uv run alembic upgrade head
uv run python -m app.db.seed --with-sample-applications
uv run uvicorn app.main:app --reload
```

The seed command prints the Jonathan and Kareem UUIDs.

To validate large-workspace behaviour (Milestone 6), seed a workspace with many
members and applications. It prints the new workspace and owner UUIDs:

```powershell
uv run python -m app.db.seed_scale --members 150 --apps-per-member 3
```

In a second terminal, configure and start the frontend:

```powershell
cd frontend
Copy-Item .env.example .env.local
```

Set the seeded UUID values in `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_JONATHAN_USER_ID=<Jonathan UUID printed by the seed command>
VITE_KAREEM_USER_ID=<Kareem UUID printed by the seed command>
```

Then install locked npm dependencies and run Vite:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. The backend permits that origin through
`CORS_ORIGINS` in `backend/.env`; the example also permits
`http://127.0.0.1:5173`. API documentation is at
`http://127.0.0.1:8000/docs`.

## Development identity

The Milestone 2 frontend is not production authentication. It lets the user
choose one of the configured seeded identities, stores that selection in local
storage, and sends its UUID as `X-User-Id` on API requests. The backend resolves
the user and workspace; request bodies never choose application ownership.
`DEV_IDENTITY_HEADER_ENABLED=true` is valid only in development or test, and
the header is honoured only for requests from the same machine.

## Production database

The API should not connect as the database owner. Create two roles once per
database, as its owner or a superuser:

```powershell
$env:DATABASE_ADMIN_URL = "postgresql+psycopg://postgres:...@db-host/applytogether"
$env:MIGRATOR_DB_PASSWORD = "..."
$env:APP_DB_PASSWORD = "..."
uv run python -m app.commands.create_db_roles
```

- `applytogether_migrator` owns the schema. Point `MIGRATION_DATABASE_URL` at
  it; Alembic uses it when set.
- `applytogether_app` can only read and write rows. Point `DATABASE_URL` at it.
  It cannot create, alter or drop tables, or change `alembic_version`.

Both URLs need `?sslmode=verify-full` in production, and the API refuses to
start without it. Every API connection sets `statement_timeout` (5 seconds) and
`idle_in_transaction_session_timeout` (10 seconds); tune them with
`DB_STATEMENT_TIMEOUT_MS` and `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS`.

Before going live, also check:

- **Backups.** Daily encrypted backups plus point-in-time recovery (WAL
  archiving, or the provider's PITR) with at least 7 days' retention.
- **Restore drill.** Restore a backup to a scratch database at least once a
  quarter and run `python -m alembic current` against it.
- **Network.** Only the API's hosts may reach the database port.
- **Retention.** Schedule `python -m app.commands.purge` to run daily with
  `MIGRATION_DATABASE_URL` so it can purge across workspaces. It
  deletes expired sessions, stale pending registrations (which hold password
  hashes), and old throttle and rate-limit rows. Soft-deleted applications are
  only erased if `PURGE_DELETED_APPLICATIONS_AFTER_DAYS` is set.

## Validation

Frontend, from `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Backend, from `backend/`:

```powershell
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run python -m pytest
```

Backend tests require the isolated PostgreSQL service:

```powershell
docker compose up -d db-test
```

See [frontend/README.md](frontend/README.md) for frontend details and
[docs/frontend-backend-integration.md](docs/frontend-backend-integration.md)
for the integration contract and manual smoke checklist.
