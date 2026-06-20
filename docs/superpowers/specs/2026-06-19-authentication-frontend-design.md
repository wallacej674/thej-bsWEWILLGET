# ApplyTogether Milestone 3 Frontend Authentication Design

## Scope

Replace the normal Milestone 2 development-identity flow with cookie-based
email/password authentication. The frontend will use the API contract specified
for Milestone 3, preserve all dashboard and workspace behavior, and retain the
existing development identity mechanism only behind an explicit development
flag. This design does not add registration, password recovery, OAuth, token
storage, or changes to workspace/application authorization.

The current backend has not yet implemented the authentication routes. Frontend
tests will exercise the documented contract with mocked fetch responses; the
integration becomes functional once the matching backend routes are available.

## Architecture

Create a central `AuthProvider` and `useAuth` interface. Its public state is
one of `initializing`, `authenticated`, `unauthenticated`, and
`recoverable-error`, with the current user and discovered workspace available
only while authenticated. The provider is the sole owner of:

- initial session restoration;
- login and logout;
- password change;
- one-time refresh recovery; and
- workspace restoration after an authenticated current-user lookup.

`App` will render a branded loading view while state is `initializing`, the
login page while unauthenticated, and the existing routed workspace app only
while authenticated. This prevents protected dashboard content from flashing
before the session is known. The existing `AppContext` will carry only the
authenticated client and session; it will no longer expose normal identity
switching controls.

## API client and request behavior

Extend the typed API client with cookie credentials and explicit auth helpers.
All calls use `credentials: "include"`. The client exposes normal request
methods plus login, refresh, logout, and password-change operations using the
following contract:

- `POST /auth/login` with `{ email, password }`;
- `POST /auth/refresh`;
- `POST /auth/logout`;
- `POST /auth/change-password` with current and new password fields; and
- `GET /users/me`.

Unsafe authenticated requests add the CSRF header configured by the backend;
the value is read from the corresponding non-HTTP-only CSRF cookie and no JWT
is read or stored by frontend code. `POST /auth/login` and `POST /auth/refresh`
never trigger automatic refresh handling.

When an appropriate authenticated request returns 401, the client shares one
in-progress refresh promise across concurrent callers, retries the original
request at most once after a successful refresh, and reports the original
authentication failure if refresh fails. It must not create recursive retries
or a refresh storm. A failed unrecoverable refresh clears the provider's
authenticated state. Existing error-envelope parsing and `204 No Content`
handling remain intact.

## Session lifecycle

On application start, the provider requests `/users/me`. If that succeeds, it
loads the first accessible workspace and enters `authenticated`. If the first
request is unauthorized, it calls refresh once, retries `/users/me` once on
success, and otherwise enters `unauthenticated`. Network/configuration errors
become `recoverable-error`, with a retry action rather than an empty dashboard.

Login disables duplicate submissions, sends the credential payload, and then
uses the same current-user/workspace restoration flow. Login failures with the
stable `invalid_credentials` code always show one generic user-facing message;
the page never infer account existence. A network failure has a separate,
actionable unavailable-backend message. Password input state is cleared after
every completed login attempt and no token is written to browser storage.

Logout calls the logout endpoint, clears local provider state regardless of an
idempotent server response, and returns to the login page. A successful
password change relies on server-side session revocation, clears provider
state, and similarly returns to login.

## User interface

The login page uses the dashboard's existing dark slate background, indigo
brand accent, `Briefcase` mark, rounded `#111827` panel, subtle border, and
restrained typography. It is a focused sign-in screen rather than a new visual
brand. It contains:

- visible labels for email and password;
- associated inline errors and an error summary with accessible live updates;
- a show/hide-password control with an accurate accessible name;
- a full-width sign-in action that displays progress and is disabled while
  pending; and
- no registration, social-provider, or non-functional password-recovery link.

The application shell will display the signed-in user's name/avatar and offer
logout. The Profile page will replace development-identity messaging with a
change-password panel. Existing application controls, routes, filtering, and
workspace loading remain unchanged.

## Development identity containment

The existing `X-User-Id` and local UUID selector remain available only when an
explicit `VITE_ENABLE_DEV_IDENTITY_SWITCHER` flag is true in a development
build. It is hidden by default, excluded from production builds, and cannot
override a valid cookie session. The normal API client has no development
header behavior unless that flag activates an isolated development adapter.
No password or authentication token is placed in local or session storage.

## Test-first delivery

Implementation will use vertical TDD slices against public behavior:

1. The initial auth-loading state resolves to the login page when no session
   can be restored.
2. The login form submits email/password with credentials, prevents repeated
   submission, and restores the workspace after success.
3. Generic credential and network-failure states are distinguishable without
   exposing account details.
4. A 401 performs one shared refresh attempt and one retry; failure returns to
   login without a loop.
5. Credentialed calls send the configured CSRF header for unsafe methods and
   continue to parse existing error envelopes and 204 responses.
6. Logout and a successful password change clear the authenticated UI.
7. The development switcher is absent by default and no tokens are stored in
   local/session storage.

Tests will stay behavior-focused: React Testing Library exercises rendered
states and actions, while API-client tests inspect network requests and retry
semantics. They will not inspect private provider state or mock component
internals.

## Alternatives rejected

- Keeping authentication state inside the existing large `IntegratedApp` was
  rejected because it would further couple lifecycle, routing, and page UI.
- Router loaders were rejected because shared refresh coordination and the
  current component-driven application shell need an explicit central boundary.
- A frontend-managed token solution was rejected because the milestone requires
  HTTP-only authentication cookies and prohibits browser token storage.

## Assumptions and integration risk

The final backend configuration will document the CSRF cookie/header names and
the exact password-change request field names. These will be centralized as
client configuration rather than duplicated in components. Until backend
authentication is added, a real browser login cannot be smoke-tested; frontend
unit tests validate the specified HTTP contract only.
