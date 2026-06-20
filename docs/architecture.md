# ApplyTogether architecture

## Current scope

Milestone 1, the FastAPI/PostgreSQL backend foundation, is complete. Milestone
2 integrates a React/TypeScript/Vite browser client with the existing API.
Milestone 3 remains Google OAuth. The application is still a local-development
system with no production deployment or identity provider.

## System boundary

The frontend runs on `http://localhost:5173` and calls the stateless backend at
`http://localhost:8000`. The backend exposes versioned routes under `/api/v1`
and health routes at `/health` and `/health/db`. PostgreSQL is the only
supported database.

Backend CORS configuration explicitly allows the Vite localhost and loopback
origins. The frontend API base URL is supplied through `VITE_API_BASE_URL`;
neither component depends on a development proxy.

## Backend layers

| Layer | Responsibility |
| --- | --- |
| Routes | Parse HTTP input, call dependencies and services, select statuses, and return Pydantic schemas. |
| Dependencies | Provide database sessions, resolve the development user, and enforce active workspace membership. |
| Services | Enforce validation, ownership, duplicate, and lifecycle rules; control transactions. |
| Repositories | Perform workspace-scoped SQLAlchemy queries and persistence without authorization decisions. |
| Schemas/models | Define API contracts and PostgreSQL-backed data integrity. |
| Core/DB | Hold settings, errors, utilities, session setup, migrations, and explicit development seed behavior. |

Services remain the mutation authority. Every application query is scoped to a
workspace, active lists exclude soft-deleted records, and deleted records are
listed only for the requesting owner.

## Frontend boundaries

The frontend has a generic typed API client, feature API functions and response
types, a development identity store, React Router page composition, and
presentation components. `VITE_JONATHAN_USER_ID` and
`VITE_KAREEM_USER_ID` populate the identity gate. The selected UUID is stored
in local storage and read by the API client for the `X-User-Id` header.

The API client:

- normalizes `VITE_API_BASE_URL` and appends `/api/v1`;
- serializes request bodies and query parameters;
- sends the selected development identity;
- handles JSON and 204 responses;
- preserves backend `{ "error": { "code", "message", "details" } }`
  failures as typed `ApiError` instances; and
- reports unreachable-backend and unexpected-response failures consistently.

Feature functions expose typed operations for session discovery, workspaces,
application summaries, listing, creation, detail, update, deletion, deleted
listing, and restoration.

## Routing and authorization

Browser routes cover `/`, `/applications`, `/applications/new`,
`/applications/:applicationId`, `/applications/:applicationId/edit`,
`/deleted`, `/workspace`, `/profile`, and a not-found route.

The UI compares the backend-returned application owner with the current user to
show edit/delete controls and to guard edit pages. This is a usability layer,
not the security boundary. The backend independently enforces active membership
for visibility and immutable application ownership for create/update/delete/
restore. A workspace role never grants permission to mutate another user's
application.

## Validation and errors

Backend Pydantic schemas and service rules are canonical. The frontend maps
structured validation details to field messages when possible, handles known
duplicate/deleted-record errors in the form, and displays page or toast errors
for access, network, and unexpected failures. Client-side owner checks improve
feedback but cannot replace backend enforcement.

## Data and startup

Alembic migrations contain schema only. The explicit, idempotent seed command
creates or updates Jonathan, Kareem, their shared workspace, memberships, and
optional sample applications. Startup never seeds data. See
[frontend-backend-integration.md](frontend-backend-integration.md) for the
exact local sequence.

## Quality gates

Backend CI uses locked `uv` dependencies, Ruff, MyPy, Alembic, Pytest, and
PostgreSQL. Frontend CI uses Node.js 22, `npm ci`, ESLint, TypeScript, Vitest,
and a Vite production build, filtered to frontend and workflow changes.
