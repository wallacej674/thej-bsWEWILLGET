# ApplyTogether frontend

The Milestone 2 frontend is a React, TypeScript, Vite application integrated
with the ApplyTogether FastAPI backend. npm is the package manager; use the
committed `package-lock.json` and `npm ci`.

## Configure and run

First migrate, seed, and start the backend as described in the repository
README. Copy the frontend environment example:

```powershell
Copy-Item .env.example .env.local
```

Set:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
VITE_JONATHAN_USER_ID=<Jonathan UUID printed by backend seed>
VITE_KAREEM_USER_ID=<Kareem UUID printed by backend seed>
```

The backend development configuration must allow the Vite origin:

```dotenv
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

Install and start:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Integrated behavior

- The identity gate lists only seeded UUIDs configured through Vite variables.
- The selected identity is persisted in local storage and sent as
  `X-User-Id`; the backend remains the authority for user, workspace, and
  application ownership.
- The typed API client targets `/api/v1`, serializes JSON, handles 204
  responses, and converts backend error envelopes into `ApiError`.
- Browser routes cover the dashboard, applications list, create, detail, edit,
  current-user deleted records, workspace, profile, and not-found pages.
- Active applications are shared across workspace members. Edit, delete, and
  restore actions are owner-only. The UI hides owner mutations where
  appropriate, but backend authorization is still definitive.
- Backend validation details are mapped to form fields when possible. Network,
  access, and unexpected-response failures use page or toast error states.

## Validation commands

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs those commands on Node.js 22 after `npm ci`.

## Known limitations

- Identity selection is a development aid, not authentication.
- Only the seeded Jonathan and Kareem identities are configured by default.
- The first discovered workspace is used; workspace switching and
  administration are not implemented.
- There is no production deployment or end-to-end browser test suite.
- Direct navigation to a client route requires a host configured to fall back
  to `index.html`; Vite development mode already does this.

See
[../docs/frontend-backend-integration.md](../docs/frontend-backend-integration.md)
for setup details and honest manual smoke steps.
