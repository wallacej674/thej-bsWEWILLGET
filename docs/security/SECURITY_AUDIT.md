# ApplyTogether security audit — task list

_Audit date: 2026-11-13 · Scope: `backend/` (FastAPI, SQLAlchemy, Alembic, Postgres), `frontend/` (React/Vite), `compose.yaml`, `.github/workflows/`, git history._

This is a code-review audit, not a penetration test. Every finding below was found by reading the code at the referenced lines; nothing was exploited against a running deployment. Hosting, TLS termination and production secrets are not in this repo, so deployment items are written as requirements to verify.

## How to use this list

- Each `SEC-xx` task is self-contained: problem, where, what to change, and how to prove it's done. Hand one task to one agent.
- **Tracks** group tasks that edit the same files. Tasks in different tracks can run in parallel; tasks in the same track should run one after another (or in one agent) to avoid merge conflicts.
- Every task must keep the existing suites green and add tests for the new behaviour:
  - Backend: `uv run python -m pytest`, `uv run python -m ruff check .`, `uv run python -m mypy app` (call tools through `python -m`; see `backend/` CI for the exact steps).
  - Frontend: `npm run lint`, `npm run typecheck`, `npm test`.
- Never commit secrets or real credentials. Test accounts use `@example.test` addresses.
- Keep the **Status** column in the summary current: set a task to `In progress` when you start it and `Done` when its PR merges, linking the PR.

### Severity

| Level | Meaning |
|---|---|
| **High** | Exploitable by an outside attacker or any signed-in user with real impact (internal network access, account takeover at scale, outage). Fix first. |
| **Medium** | Real weakness, but it needs a precondition, has limited impact, or is defence in depth for a High area. |
| **Low** | Hardening, hygiene, privacy polish, or production-readiness. |

### Summary

| ID | Title | Severity | Track | Effort | Status |
|---|---|---|---|---|---|
| SEC-00 | Land the dependency vulnerability fixes | High | — | S | Done |
| SEC-01 | Close SSRF holes in job-link autofill | High | A · Autofill | M | In progress |
| SEC-02 | Rate limiting for auth and expensive endpoints | High | B · Rate limiting | M | Done |
| SEC-03 | Replace hard account lockout with throttling (lockout DoS) | Medium | B · Rate limiting | S | Done |
| SEC-04 | Fail-closed production configuration | Medium | C · Config & headers | S | Done |
| SEC-05 | Security headers on API and frontend | Medium | C · Config & headers | S | Open |
| SEC-06 | Harden résumé upload and PDF parsing | Medium | D · Uploads & AI | S | Done |
| SEC-07 | AI tailor cost quota and prompt-injection hardening | Medium | D · Uploads & AI | S | Open |
| SEC-08 | Security event logging and alerting | Medium | E · Observability | M | Open |
| SEC-09 | Logout must work with an expired access token | Medium | F · Auth flows | S | Open |
| SEC-10 | Secure "forgot password" flow | Medium | F · Auth flows | M | Open |
| SEC-11 | Verification email content injection and email bombing | Medium | F · Auth flows | S | Open |
| SEC-12 | Least-privilege database roles, TLS and timeouts | Medium | G · Database | M | Done |
| SEC-13 | Row-level security as tenant-isolation backstop | Low | G · Database | L | Open |
| SEC-14 | Data retention and purge jobs | Low | G · Database | S | Done |
| SEC-15 | Account deletion and data export | Medium | H · Privacy | M | Open |
| SEC-16 | Limit member email visibility | Low | H · Privacy | S | Open |
| SEC-17 | Escape LIKE wildcards in search | Low | I · Small fixes | S | Open |
| SEC-18 | Caps on workspaces and invitations per user | Low | I · Small fixes | S | Open |
| SEC-19 | Lockout counter keeps re-locking after expiry | Low | B · Rate limiting | S | Done (with SEC-03) |
| SEC-20 | Remove the verification token from the URL after use | Low | J · Frontend | S | Open |
| SEC-21 | Self-host fonts and tighten third-party requests | Low | J · Frontend | S | Open |
| SEC-22 | CI and supply-chain hardening | Low | K · CI | S | Open |
| SEC-23 | Session management: list and revoke devices | Low | F · Auth flows | M | Open |
| SEC-24 | Breached-password check and optional MFA | Low | F · Auth flows | M | Open |

---

## SEC-00 · Land the dependency vulnerability fixes — High

**Status: Done.** Merged into `main` in PR #39 (commit `c8ea7a8`). Afterwards, `npm audit` and `pip-audit` both report 0 on `main`, and GitHub's Dependabot alerts dropped from 29 to 1.

- **What was fixed:**
  - `react-router` 7.18.0 → 7.18.5 (RSC CSRF bypass).
  - `vite` 6.4.3 → 6.4.6 (dev-server file-serving and `launch-editor` command-injection issues).
  - Refreshed transitive `tar`, `postcss`, `brace-expansion`, `browserslist`, `js-yaml` and `nanoid`.
  - An npm `overrides` entry forcing `minimatch ^11.0.8` under `@typescript-eslint/typescript-estree` (GHSA-g3hv-75wg-m249).
  - `cryptography` 49 → 50.0.2, `dnspython` 2.8 → 2.9.2, `soupsieve` 2.8.4 → 4.1.
- **Left over:** one moderate alert, [#102](https://github.com/wallacej674/thej-bsWEWILLGET/security/dependabot/102), is still open, but neither local audit reproduces it. It may be a stale alert that clears on the next scan, or one in a file the local tools don't check (the GitHub Actions workflows or the Postgres image in `compose.yaml`). Whoever picks up SEC-22 should check it on GitHub and fix it or dismiss it with a reason.
- **Stale branch:** `dependabot/npm_and_yarn/frontend/source-map-js-1.2.2` is already part of `main` and can be deleted.

---

## Track A · Autofill

### SEC-01 · Close SSRF holes in job-link autofill — High

**Where:** `backend/app/services/job_posting_autofill_service.py` (`SafeHttpJobPostingFetcher`, `_reject_blocked_host`), called from `POST /workspaces/{id}/applications/autofill`.

**Problem.** Any workspace member can make the server fetch an arbitrary URL. The current guard has five gaps:

1. **Redirect hops aren't checked before they're fetched** (line 86, `follow_redirects=True`). Only the first URL and the *final* `response.url` are validated, and the final check runs after the request has already been made. A public page that redirects to `http://169.254.169.254/…`, `http://10.x.x.x/admin` or another internal address makes the server send a request into the internal network: a blind SSRF.
2. **DNS rebinding / time-of-check-time-of-use.** `getaddrinfo` validates the hostname, and then `httpx` resolves it *again* when it connects. A malicious DNS server can answer with a public IP for the check and a private IP for the connect.
3. **The blocklist misses non-global ranges** (lines 224–250). It tests `is_private`, `is_loopback` and similar, but `100.64.0.0/10` (carrier-grade NAT, often used for cloud-internal networks) is neither private nor global in Python 3.12, so it gets through. Any port is also allowed.
4. **The whole response is downloaded before the size cap** (line 116). `response.content` is fully buffered, and gzip-decoded, before `MAX_FETCH_BYTES` is checked. A multi-GB or compressed-bomb response can exhaust memory.
5. **A missing `Content-Type` header skips the type check.**

**Change.**

- Set `follow_redirects=False` and follow redirects manually, at most 3. For each hop: parse the URL, require http/https, resolve it, reject any address where `not ip.is_global`, then connect.
- Pin the connection to the vetted IP: use a custom `httpx` transport that connects to the resolved address while sending the original `Host` and TLS SNI. Alternatively, route all autofill traffic through an egress proxy that enforces the policy (for example Stripe's *smokescreen*). Either closes the rebinding gap.
- Replace the hand-written range checks with `not address.is_global`. Also reject IPv4-mapped, 6to4, Teredo and NAT64 forms whose embedded IPv4 address isn't global.
- Allow only ports 80 and 443.
- Stream the body with `client.stream(...)` and abort once more than `MAX_FETCH_BYTES` *decoded* bytes have been read. Also abort early if `Content-Length` is over the limit.
- Require a `Content-Type` header, and that it is text/html, application/xhtml or text/plain.
- Put an overall deadline on the whole fetch, covering all hops, not just per-request timeouts.

**Tests (add to `tests/test_job_posting_autofill.py`).** Mock DNS and transport so no real network is used:

- A public URL that redirects to `127.0.0.1`, `169.254.169.254`, `10.0.0.1` or `100.64.0.1` is rejected **without** a request reaching the internal host.
- A rebinding resolver (public on the first lookup, private on the second) can't reach the private address.
- A URL on port 22 or 6379 is rejected.
- A body over 2 MB is aborted mid-stream.
- A response with no `Content-Type` is rejected.

**Done when:** all of the above tests pass, and the existing autofill tests still pass.

---

## Track B · Rate limiting

### SEC-02 · Rate limiting for auth and expensive endpoints — High

**Status: Done** on branch `sec-even-tasks`. Postgres-backed fixed-window limits (`backend/app/services/rate_limit.py`, all `RATE_LIMIT_*` settings): login 10/min per IP, signup 5/hour per IP, resend 3/hour per email and 10/hour per IP, verify 20/min per IP, refresh 30/min per session, autofill 20/min per user, résumé upload 10/hour per user, all answering `429 rate_limited` with `Retry-After`. The suggested per-email *login* limit was left out on purpose: anyone could trip it for a victim's email and lock them out, which SEC-03 handles safely. The AI tailor quota is SEC-07. Tests: `backend/tests/test_rate_limits.py`.


**Where:** `backend/app/main.py` (middleware) and `backend/app/api/routes/auth.py`, `applications.py` (autofill), `ai_analysis.py` and `profile.py` (résumé upload).

**Problem.** Nothing limits request rates.

- `POST /auth/login` allows unlimited credential stuffing across accounts. The per-account lockout only slows attacks on a single account.
- `POST /auth/signup` and `/auth/resend-verification` let anyone make the app email arbitrary addresses (see SEC-11).
- `/auth/verify-email` and `/auth/refresh` can be hammered.
- Autofill (outbound HTTP), the AI tailor (paid API calls) and résumé upload (PDF parsing) are expensive per request and can be used for cost or CPU exhaustion.

**Change.**

- Add a limiter, for example `slowapi`/`limits`, with a shared store such as Redis or Postgres so limits hold across workers.
- Key the limits by client IP (behind the proxy, trust only the configured `X-Forwarded-For` hop) **and** by the target account or email where there is one.
- Suggested starting limits:
  - login: 10/min per IP, 5/min per email
  - signup: 5/hour per IP
  - resend: 3/hour per email
  - verify: 20/min per IP
  - refresh: 30/min per session
  - autofill: 20/min per user
  - AI tailor: see SEC-07
  - résumé upload: 10/hour per user
- Return `429` with a `Retry-After` header and the standard `{error: {code: "rate_limited"}}` body. Make the frontend show a friendly message.
- Make the limits configurable in `Settings`, and loose in the `test` environment.

**Tests:** exceeding each limit returns 429; the limit resets after the window; a per-email limit can't be bypassed by changing IP; a per-IP limit can't be bypassed by changing email.

### SEC-03 · Replace hard account lockout with throttling — Medium

**Status: Done** on branch `sec-03-login-throttling`.

**Was:** five wrong passwords locked the account for 15 minutes, whoever typed them, so anyone who knew a user's email could keep them locked out. In practice the lock also never took effect: the login route rolled the transaction back on a wrong password, which discarded the failure count every time.

**Now** (OWASP's device-cookie defence; see `backend/app/services/login_throttle.py`):

- **Failures count per source, not per account.** A source is either a recognised device or an IP address. A recognised device is a browser carrying a signed `applytogether_device` cookie, issued on a successful sign-in (`backend/app/core/device_cookie.py`). A stranger can only throttle their own source.
- **Thresholds and lock lengths.** Five failures in 15 minutes throttle a source. Locks double each time (1, 2, 4 … minutes, capped at 60). A lock that has run out starts a fresh count, which fixes SEC-19. A quiet day forgets the lock history.
- **Account-wide backstop.** Attempts from unrecognised devices are also counted together: 20 failures pause unrecognised devices only, so browsers the owner already uses keep working. The owner gets at most one "sign-in attempts paused" email a day; it contains no user-supplied text (SEC-11).
- **Throttled responses.** A throttled request gets `429 login_throttled` with `Retry-After` and "Try again in N minutes", before the password is checked. The sign-in page shows that message.
- **No account enumeration.** Buckets are keyed by the typed email, so unknown emails behave exactly like real ones. Only keyed hashes of the email and the source are stored, in `login_throttle_buckets`.
- **Settings and schema.** All limits are `LOGIN_THROTTLE_*` settings. The unused `users.failed_login_attempts` and `users.locked_until` columns are dropped (migration `20261113_0011`). An administrator password reset clears the account's buckets.

**Still needed from SEC-02:** buckets are per email, so one IP trying a single password against thousands of different accounts (credential stuffing) isn't slowed here. That needs SEC-02's per-IP limit across all accounts. CAPTCHA was not added; progressive delay was used instead.

**Deploying:** behind a proxy, run uvicorn with `--proxy-headers` and a trusted `--forwarded-allow-ips`, so the IP is the visitor's and not the proxy's.

### SEC-19 · Lockout counter keeps re-locking after expiry — Low

**Status: Done**, as part of SEC-03. The per-account counter is gone. In its place, a throttle lock that has run out starts a fresh count, so one typo afterwards doesn't re-lock. This is covered by `test_locks_double_and_a_spent_lock_starts_a_fresh_count`.

---

## Track C · Config & headers

### SEC-04 · Fail-closed production configuration — Medium

**Status: Done** on branch `sec-even-tasks`. ENVIRONMENT has no default. In production, startup refuses: a weak or placeholder JWT secret, non-https CORS origins, a missing or wildcard `ALLOWED_HOSTS`, a database URL without `sslmode=verify-full`/`verify-ca`, insecure cookies, or the dev identity header. `TrustedHostMiddleware` rejects unknown hosts; CORS methods and headers are narrowed; `/docs`, `/redoc` and `/openapi.json` exist only in development; and the `X-User-Id` header is honoured only from this machine. Tests: `backend/tests/test_production_configuration.py`.


**Where:** `backend/app/core/settings.py`, `backend/app/main.py` and `backend/app/api/dependencies/current_user.py`.

**Problems.**

- `environment` defaults to `"development"` (settings.py:15). A production deploy that forgets `ENVIRONMENT=production` silently runs in development mode. That turns off the production checks in `validate_identity_configuration`, and with it the guard on the `X-User-Id` impersonation header (`current_user.py:77–103`).
- `AUTH_JWT_SECRET_KEY` isn't checked for strength. A short or placeholder secret makes HS256 tokens forgeable.
- `/docs`, `/redoc` and `/openapi.json` are public in every environment (main.py:23).
- There is no `TrustedHostMiddleware`, and production `CORS_ORIGINS` aren't required to be `https://`.
- `DATABASE_URL` isn't required to use TLS in production (see SEC-12).

**Change.**

- Remove the default for `environment` so it must be set explicitly.
- In `validate_identity_configuration`:
  - In production, refuse to start unless the JWT secret is at least 32 bytes of entropy and isn't the `.env.example` placeholder.
  - In production, require `https://` CORS origins.
  - In production, require `sslmode=require` or `verify-full` in `DATABASE_URL`.
  - Refuse `DEV_IDENTITY_HEADER_ENABLED` unless the environment is development or test **and** requests come from localhost.
- Add an `ALLOWED_HOSTS` setting and `TrustedHostMiddleware`.
- Disable the OpenAPI docs routes outside development.
- Narrow CORS `allow_methods` and `allow_headers` to what the app actually uses.

**Tests:** a production configuration with a weak secret, an `http://` origin, the dev header enabled or a non-TLS database URL fails to start; docs return 404 in production.

### SEC-05 · Security headers on API and frontend — Medium

**Where:** a new middleware in `backend/app/main.py`, plus the frontend hosting config (static host or reverse proxy; not in this repo yet). `frontend/index.html` currently sets no CSP.

**Problem.** Neither the API nor the SPA sends HSTS, `Content-Security-Policy`, `X-Content-Type-Options`, `frame-ancestors`/`X-Frame-Options`, `Referrer-Policy` or `Permissions-Policy`. That leaves clickjacking possible and gives no defence-in-depth against any future XSS.

**Change.**

- API responses: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` on auth and user-data endpoints.
- Frontend:
  - A strict CSP: `default-src 'self'`, `script-src 'self'` (move the inline theme script in `index.html` into a file, or give it a hash), `style-src 'self' 'unsafe-inline'` (needed for Tailwind/motion inline styles), `font-src 'self'` (after SEC-21), `connect-src 'self' <api origin>`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.
  - `Referrer-Policy: strict-origin-when-cross-origin` (or `no-referrer`).
  - `Permissions-Policy` disabling the camera, microphone and geolocation.
- Document the headers in `README.md` for whoever deploys.

**Tests:** a backend test asserts the headers are present; a Playwright or manual check confirms no CSP violations on the landing, sign-in and dashboard pages.

---

## Track D · Uploads & AI

### SEC-06 · Harden résumé upload and PDF parsing — Medium

**Status: Done** on branch `sec-even-tasks`. A request-size middleware (`MAX_REQUEST_BYTES`, 4 MB, including chunked bodies) answers 413 before buffering; uploads are read in chunks and stop at 3 MB; files must start with the `%PDF-` signature; parsing reads at most 10 pages and 50,000 characters within a 5-second budget; and any parser exception is a 422. Tests: `backend/tests/test_resume_upload_limits.py`.


**Where:** `backend/app/api/routes/profile.py:26` and `backend/app/services/resume_service.py:81–125`.

**Problems.**

- `await file.read()` buffers the whole upload in memory **before** the 3 MB check, and there is no request-body limit at the server.
- `pypdf` parses untrusted PDFs with no limit on pages or decompressed stream size. A small PDF can expand to huge text or burn CPU.
- Only `PdfReadError`, `ValueError`, `TypeError` and `OSError` are caught. Other parser errors (`KeyError`, `RecursionError`, `AssertionError`) become 500s.
- The file type check trusts the client's filename and `Content-Type`. There is no `%PDF-` magic-byte check.
- The extracted text is stored unbounded.

**Change.**

- Read the upload in chunks and stop as soon as 3 MB is exceeded. Also cap the request body at the proxy or ASGI level.
- Check for the magic bytes `%PDF-`.
- Cap the number of pages (for example 10), cap the extracted text (for example 50k characters), and catch `Exception` from the parser, mapping it to `422 resume_parse_failed`.
- Run parsing under a time limit, such as a worker thread with a timeout or a subprocess with resource limits.

**Tests:** an 8 MB upload is rejected without being fully read; a non-PDF renamed to `.pdf` is rejected; a 500-page PDF is truncated or refused; a malformed PDF that raises `KeyError` returns 422, not 500.

### SEC-07 · AI tailor cost quota and prompt-injection hardening — Medium

**Where:** `backend/app/services/ai_analysis_service.py:105` and `backend/app/services/ai_provider.py:118` (`_build_input`).

**Problems.**

- Any member can call `POST …/resume-tailor` without limit. Each call is a paid OpenAI request, so the cost is unbounded.
- The job description comes from third-party pages (via autofill) or from other members. It is concatenated into the prompt, so text such as "ignore previous instructions…" can skew the suggestions.
  - Output is schema-constrained JSON rendered as React text, so this can't become XSS, but it can produce misleading advice.

**Change.**

- Add a per-user daily quota (for example 20 per day) and a per-workspace daily ceiling, stored in the database. Return `429 ai_quota_exceeded` with the reset time.
- Add a global monthly spend kill-switch setting.
- Wrap untrusted inputs in clearly delimited blocks, for example `<job_description>…</job_description>`, and tell the model in `SYSTEM_INSTRUCTIONS` to treat block contents as data only and never as instructions.
- Strip control characters from the input.
- Keep `store=False`.

**Tests:** the 21st call in a day returns 429; the prompt builder wraps and escapes inputs (assert on the built string); the quota resets the next day (using a frozen clock).

---

## Track E · Observability

### SEC-08 · Security event logging and alerting — Medium

**Where:** the backend has essentially no application logging (`grep logger.` finds nothing in `app/`).

**Problem.** There is no audit trail for logins, failed logins, lockouts, refresh-token reuse (a likely sign of token theft), password changes, role changes, member removal, workspace deletion or permanent deletes. Incidents can't be detected or investigated.

**Change.**

- Add structured JSON logging (for example `structlog`) with a request ID.
- Emit events containing **user ID, workspace ID, IP, user agent and outcome**. Never include passwords, tokens, résumé text or full emails; hash or mask the email.
- Treat `RefreshTokenReuseError` and lockouts as warning-level events that can drive alerts.
- Optionally persist key events in a `security_events` table so owners can see recent activity.

**Tests:** each event is emitted with the expected fields, and a log capture shows no password or token values.

---

## Track F · Auth flows

### SEC-09 · Logout must work with an expired access token — Medium

**Where:** `backend/app/api/routes/auth.py:171–190`.

**Problem.** `verify_token` raises `TokenExpiredError` (a subclass of `AuthXException`) once the 15-minute access token expires. Logout then returns **403**, doesn't clear the cookies, and doesn't revoke the server-side session, so the 20-day refresh token stays valid. A user who leaves a tab idle and clicks "Log out" isn't really logged out.

**Change.**

- On logout, accept an expired access token, still verifying its signature and CSRF, and revoke its `sid`.
- Or fall back to the refresh cookie (with refresh CSRF) to find and revoke the session.
- Always clear the cookies.

**Test:** with the clock 16 minutes past login, logout returns 204, the session's `revoked_at` is set, and a later `/auth/refresh` fails.

### SEC-10 · Secure "forgot password" flow — Medium

**Where:** new endpoints in `auth.py` and `registration_service.py`/`auth_service.py`, plus frontend pages under `features/auth`.

**Problem.** There's no way to recover an account. A user who forgets their password, or is locked out per SEC-03, needs an administrator to run `app/commands/set_password.py`.

**Change.**

- Add `POST /auth/forgot-password`. It always returns 202 (no account enumeration) and emails a single-use token (`secrets.token_urlsafe(32)`, stored as a SHA-256 digest) that expires in 30 minutes.
- Add `POST /auth/reset-password`, which consumes the token, applies the password policy, calls `reset_password()` (this already revokes all sessions) and emails a notice.
- Rate-limit both endpoints (SEC-02).
- Add frontend pages styled like the new sign-in page, and link them from the sign-in page.

**Tests:** the token is single-use; an expired token is rejected; an unknown email still returns 202; reset revokes existing sessions; the reset form enforces the policy.

### SEC-11 · Verification email content injection and email bombing — Medium

**Where:** `backend/app/services/email_delivery.py:45`, and `signup`/`resend` in `registration_service.py`.

**Problems.**

- The attacker-chosen `display_name` (up to 200 characters) is inserted unescaped into the **plain-text** part of an email sent from the app's own address. For example, "Hi Your account is suspended, visit evil.example …". That's a ready-made phishing vector. (The HTML part is escaped correctly.)
- Signup and resend can send mail to any address (one email per minute per address via resend), so the app can be used to spam strangers.

**Change.**

- Leave the display name out of the email, or restrict it to letters, spaces, `'` and `-`, cap it at 50 characters, and strip URLs and newlines.
- Add per-IP and per-recipient-domain limits (SEC-02), and add a CAPTCHA/turnstile to signup.
- Add an SPF/DKIM/DMARC check to the deploy checklist.

**Tests:** a display name containing a URL or newline is sanitized (or rejected at signup); limits apply.

### SEC-23 · Session management: list and revoke devices — Low

- **Where:** `auth_session` model, a new `/auth/sessions` route, and Profile → Security.
- **Change:**
  - Store the user agent, IP prefix and `created_at` on each session.
  - Add endpoints to list your active sessions, revoke one, and revoke all others.
  - Email the user when a new device signs in (optional).
- **Tests:** a user can list and revoke only their own sessions; a revoked session fails its next request.

### SEC-24 · Breached-password check and optional MFA — Low

- **Where:** `backend/app/core/passwords.py` (`validate_password`).
- **Change:**
  - Reject passwords found in Have I Been Pwned's Pwned Passwords list, using its k-anonymity range API (send only the first five characters of the SHA-1 hash).
  - Fail open with a log entry if the service is unreachable.
  - Later, add optional TOTP MFA for owners and admins.
- **Tests:** a known breached password is rejected (using a mocked range response); the service being down doesn't block signup.

---

## Track G · Database

### SEC-12 · Least-privilege database roles, TLS and timeouts — Medium

**Status: Done** on branch `sec-even-tasks`. `python -m app.commands.create_db_roles` creates the schema-owning migrator and the DML-only app role (safe to rerun), Alembic uses `MIGRATION_DATABASE_URL` when set, every API connection sets `statement_timeout` and `idle_in_transaction_session_timeout`, the Postgres image is pinned by digest, and the README documents roles, TLS and a backup/PITR/restore checklist. Tests: `backend/tests/test_database_roles.py`.


**Where:** `compose.yaml`, `backend/.env.example`, `backend/app/db/session.py`, the Alembic config, and the deployment.

**Problems.**

- The app connects as the database owner (`POSTGRES_USER`, a superuser in the official image), so a SQL injection or compromised app could drop tables or read other databases.
- There's no TLS requirement, no `statement_timeout` and no `idle_in_transaction_session_timeout`.
- The `postgres:16-alpine` tag floats, and the compose passwords are trivial. That's fine locally, but it must never be reused.

**Change.**

- Create two roles. `applytogether_migrator` owns the schema and runs Alembic. `applytogether_app` has only `SELECT`, `INSERT`, `UPDATE` and `DELETE` on application tables, with no DDL and no superuser rights. Document both in the README, and give the app and the migrations separate URLs.
- In production, require `sslmode=verify-full` (validated in SEC-04).
- Set `connect_args={"options": "-c statement_timeout=5000 -c idle_in_transaction_session_timeout=10000"}` in `get_engine`, and set explicit `pool_size` and `max_overflow`.
- Pin the Postgres image by digest.
- Add a backup and point-in-time-recovery plan, with encrypted backups, to the deploy checklist.

**Tests:** migrations run as the migrator; the app role can't run `DROP TABLE`; a deliberately slow query is cancelled.

### SEC-13 · Row-level security as tenant-isolation backstop — Low

- **Where:** a new Alembic migration and a per-request `SET LOCAL app.user_id`.
- **Problem:** workspace isolation depends entirely on every query remembering its `workspace_id` filter. One missed filter would leak another workspace's applications.
- **Change:**
  - Enable RLS on `job_applications`, `application_ai_analyses`, `workspace_invitations` and `workspace_memberships`, with policies limited to workspaces the current user is an active member of.
  - Set the user per transaction from `get_current_user`.
  - Start with read policies.
- **Tests:** a query run as user A with a hand-built `workspace_id` filter for workspace B returns 0 rows.

### SEC-14 · Data retention and purge jobs — Low

**Status: Done** on branch `sec-even-tasks`. `python -m app.commands.purge` (daily, safe to repeat) removes sessions 30 days past expiry or revocation, pending registrations 7 days past expiry or use, idle unlocked throttle buckets, and rate-limit windows older than a day. Soft-deleted applications are erased only if `PURGE_DELETED_APPLICATIONS_AFTER_DAYS` is set, because that's still a product decision. Tests: `backend/tests/test_purge.py`.


- **Problem:** several kinds of data are never deleted.
  - Expired or revoked `auth_sessions`.
  - Expired or consumed `pending_registrations`, which **hold password hashes**.
  - Soft-deleted applications.
  - Orphaned AI analyses.
- **Change:**
  - Add a scheduled `python -m app.commands.purge` that removes sessions 30 days past expiry and pending registrations 7 days past expiry or consumption.
  - Permanently delete applications 30 days after soft deletion, telling users first. This is a product decision.
- **Tests:** the purge removes only rows past their retention, and can be run repeatedly safely.

---

## Track H · Privacy

### SEC-15 · Account deletion and data export — Medium

- **Problem:** users can't delete their account or download their data (applications, résumé text, AI results). Privacy laws such as GDPR and CCPA expect both, and résumé text is sensitive personal data. It is also sent to OpenAI (with `store=False`), which needs a privacy notice.
- **Change:**
  - Add `DELETE /users/me`. It re-checks the password, revokes sessions and deletes or anonymizes the user's data. Workspaces the user is sole owner of must be handled first (transfer ownership or delete).
  - Add `GET /users/me/export`, returning JSON.
  - Add a privacy page explaining the AI processing.
- **Tests:** deletion removes or anonymizes all rows; the export contains only the requester's data; sole-owner workspaces block deletion with a clear error.

### SEC-16 · Limit member email visibility — Low

- **Where:** `backend/app/schemas/workspace.py:23` (`WorkspaceMemberUser.email`) and `list_members`.
- **Problem:** every member, of any role, can list every other member's email address, in workspaces of up to 500 people.
- **Change:** return emails only to owners and admins (other members get the display name only), or make email visibility opt-in.
- **Tests:** a plain member's response omits emails; an owner's includes them.

---

## Track I · Small fixes

### SEC-17 · Escape LIKE wildcards in search — Low

- **Where:** `application_repository.py:332` and `:365`, and `workspace_repository.py:155`.
- **Problem:** the search text is placed into `ilike(f"%{search}%")`. It's still parameterized, so this is **not** SQL injection, but `%` and `_` act as wildcards. That gives users unexpected matches and lets them force expensive scans.
- **Change:** escape `\`, `%` and `_`, and pass `escape="\\"`.
- **Tests:** searching for `%` matches only names that literally contain `%`.

### SEC-18 · Caps on workspaces and invitations per user — Low

- **Where:** `workspace_service.create_workspace` and `invite_member`.
- **Problem:** one account can create unlimited workspaces and pending invitations, which is a storage-abuse and spam vector.
- **Change:** add settings such as `max_workspaces_per_user = 20` and `max_pending_invitations_per_workspace = 200`, and return 409 with a clear message.
- **Tests:** the limits are enforced.

---

## Track J · Frontend

### SEC-20 · Remove the verification token from the URL after use — Low

- **Where:** `frontend/src/features/auth/VerifyEmailPage.tsx`.
- **Problem:** `/verify-email?token=…` stays in the address bar and browser history after use. Tokens are single-use, but they still leak through history, shared screenshots and analytics.
- **Change:** read the token, then call `history.replaceState` to drop it from the URL before verifying. Set `<meta name="referrer" content="no-referrer">` on this route, or globally via SEC-05.
- **Tests:** after the page mounts, `location.search` no longer contains the token.

### SEC-21 · Self-host fonts and tighten third-party requests — Low

- **Where:** `frontend/src/styles/fonts.css:1`, which imports Inter, JetBrains Mono, Outfit and Space Grotesk from `fonts.googleapis.com`.
- **Problem:** loading the fonts from Google sends every visitor's IP address to Google, and it forces SEC-05's CSP to allow those external origins.
- **Change:** self-host the four font families (for example with `@fontsource-variable/*`), then remove the Google origins from the CSP.
- **Tests:** a production build makes no requests to `fonts.googleapis.com` or `fonts.gstatic.com`.

---

## Track K · CI

### SEC-22 · CI and supply-chain hardening — Low

- **Where:** `.github/workflows/*.yml`.
- **Problem:** actions are pinned by tag (`@v4`) rather than commit SHA, and CI does no dependency or secret scanning. Dependabot is set up only in the GitHub settings; there's no `.github/dependabot.yml` in the repo.
- **Change:**
  - Pin every `uses:` to a full commit SHA, with a version comment.
  - Add `npm audit --audit-level=high` and `pip-audit` steps.
  - Add CodeQL (Python and JavaScript), `gitleaks` secret scanning, and `actions/dependency-review-action` on pull requests.
  - Add `.github/dependabot.yml` covering npm (`/frontend`), uv/pip (`/backend`), github-actions and docker (compose).
- **Also:** resolve the leftover Dependabot alert #102 noted under SEC-00.
- **Tests:** CI fails on a deliberately added vulnerable package or a fake secret, checked on a throwaway branch.

---

## Verified strengths (no action needed)

These were checked and found solid. Agents shouldn't rework them:

- **Password storage and login:**
  - Argon2 hashing via `pwdlib`, with automatic rehash on login.
  - A 12-character minimum and 1 KB maximum.
  - The same error message, and dummy-hash timing, for unknown users.
- **Sessions:**
  - Access and refresh JWTs in `HttpOnly`, `Secure` (configurable), `SameSite` cookies with path scoping.
  - Double-submit CSRF tokens on every unsafe method, including refresh and logout.
  - Server-side sessions checked on **every** request, with refresh-token rotation and reuse detection that revokes the session.
  - Changing the password revokes all sessions.
- **Signup and verification:**
  - Signup and resend give the same answer whether or not an account exists, so they don't reveal which emails are registered.
  - Verification tokens are 256-bit random, stored as SHA-256 digests, single-use and expire after 24 hours.
  - Emails are HTML-escaped.
- **Authorization:**
  - Every workspace route requires active membership.
  - Owner-only actions are enforced in the service layer.
  - Applications can be edited only by their owner; moderation is limited to owners and admins; restore and permanent delete are limited to whoever deleted.
- **Input handling:**
  - Job URLs are restricted to http/https on create and update, so there's no `javascript:` link XSS.
  - Request fields have length limits, page sizes are capped at 100, and bulk delete is capped at 100 IDs.
  - Queries use SQLAlchemy parameterization; the only raw SQL is a constant `SELECT 1` health check.
- **Database:** unique constraints on token digests, `RESTRICT` and `CASCADE` foreign keys chosen deliberately, and the database bound to `127.0.0.1` in compose.
- **Secrets:** no secrets in git history. Only `.env.example` files were ever committed, and `.env*` is gitignored.
- **CORS:** wildcard origins with credentials are refused at startup.
- **AI provider:** OpenAI is called with `store=False` and strict JSON-schema output.
- **Frontend:** React escapes rendered text. The only `dangerouslySetInnerHTML` is shadcn's chart style block, which takes configuration only, never user input.
