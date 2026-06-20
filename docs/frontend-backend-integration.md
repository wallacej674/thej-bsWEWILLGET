# Frontend-backend integration

## Local contract

The Vite frontend uses npm and runs on port 5173. The FastAPI backend runs on
port 8000 and PostgreSQL runs through `compose.yaml` on host port 5434. The frontend calls the
backend directly; local CORS must allow the exact browser origin.

Backend `backend/.env`:

```dotenv
ENVIRONMENT=development
DEV_IDENTITY_HEADER_ENABLED=true
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

Frontend `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_JONATHAN_USER_ID=<Jonathan UUID printed by the seed command>
VITE_KAREEM_USER_ID=<Kareem UUID printed by the seed command>
```

Vite environment changes require restarting the frontend development server.

## Start from a clean checkout

From the repository root:

```powershell
docker compose up -d db
cd backend
Copy-Item .env.example .env
uv sync --locked
uv run alembic upgrade head
uv run python -m app.db.seed --with-sample-applications
uv run uvicorn app.main:app --reload
```

Copy the two UUIDs printed by the seed command. In a second terminal:

```powershell
cd frontend
Copy-Item .env.example .env.local
```

Set both UUID values, then:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. If the UI reports a network error, verify the
backend is running, `VITE_API_BASE_URL` has no `/api/v1` suffix, and the
browser's exact origin is in `CORS_ORIGINS`.

## Identity and request flow

1. The identity gate reads the two seeded UUID variables.
2. Selecting Jonathan or Kareem stores only that configured UUID in local
   storage.
3. The API client sends it as `X-User-Id`.
4. The backend resolves the active user and returns `/users/me`.
5. The frontend discovers workspaces and uses the first active workspace.
6. Subsequent calls use workspace-scoped `/api/v1` routes.

The selected identity is never accepted as an application owner in request
payloads. Creation assigns the backend-resolved current user. Membership grants
visibility; only `application.owner.id` grants edit, delete, or restore
authority.

## Typed client, routing, and errors

The generic client handles base URL normalization, query serialization, JSON
bodies, 204 responses, development identity headers, and backend error
envelopes. Feature API functions add TypeScript request/response contracts for
session, workspace, summary, list, detail, create, update, delete, and restore
operations.

React Router exposes:

- `/` dashboard
- `/applications` active list
- `/applications/new` create form
- `/applications/:applicationId` detail
- `/applications/:applicationId/edit` owner edit form
- `/deleted` current owner's deleted records
- `/workspace` workspace information
- `/profile` identity information

The frontend hides or blocks owner-only actions for other users. The backend
still performs every authorization check. Structured validation details become
inline field errors where possible; network and access failures appear as
retryable page states or toasts.

## Automated validation

From `frontend/`:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Frontend CI runs the same sequence with Node.js 22 and `npm ci`.

For the backend, start `db-test` and run the existing quality gate:

```powershell
docker compose up -d db-test
cd backend
uv run ruff check .
uv run ruff format --check .
uv run mypy app
uv run python -m pytest
```

## Manual smoke checklist

These checks require both servers and correctly seeded UUIDs. They are manual;
the repository does not currently contain browser end-to-end automation.

1. Open the frontend with local storage cleared. Confirm the identity gate
   offers Jonathan and Kareem.
2. Select Jonathan. Confirm the app loads the seeded workspace and active
   applications without a CORS or network error.
3. Create an application. Confirm it appears in the list and its detail page
   identifies Jonathan as owner.
4. Edit the new application and confirm the saved values reload from the API.
5. Switch to Kareem. Confirm Jonathan's active application remains visible but
   edit and delete controls are unavailable; direct navigation to its edit URL
   must not permit a successful mutation.
6. Create a Kareem-owned application, delete it, and confirm it disappears
   from the active list and appears on Kareem's Deleted page.
7. Switch to Jonathan. Confirm Kareem's deleted application is absent from
   Jonathan's Deleted page.
8. Switch back to Kareem, restore the application, and confirm it returns to
   the active list.
9. Submit invalid form values and confirm useful field or form errors are
   shown without losing the backend message.
10. Stop the backend and retry a page load. Confirm the frontend reports that
    the API cannot be reached rather than silently showing empty data.

## Known limitations

- Seeded identity selection and `X-User-Id` are development-only.
- Google OAuth is Milestone 3.
- Only the first discovered workspace is selected.
- Workspace invitations, membership management, goals, analytics, interview
  tracking, deployment, and production session handling are not implemented.
- Manual smoke testing is required for full browser/API integration.
