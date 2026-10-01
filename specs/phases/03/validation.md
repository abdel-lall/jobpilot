# Phase 3 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — A new user can register and log in.
- PASS — Registration creates the user only. It does not log the user in, and it does not issue an access token or a refresh token.
- PASS — `GET /auth/me` accepts that user's access token and returns that user.
- PASS — Refresh returns a new access token and replaces the refresh session in one transaction.
- PASS — If the refresh transaction fails, the old session remains valid and no replacement session is created.
- PASS — The previous refresh token fails after a successful rotation.
- PASS — Logout causes a later refresh to fail.
- PASS — A request without a valid access token is rejected. This includes a missing token, a malformed token, and an expired token.
- PASS — Password hashes are Argon2id, and plaintext passwords are not stored.
- PASS — Register, login, refresh, and logout responses do not contain a password, a password hash, or a refresh token.
- PASS — The refresh cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` only when `NODE_ENV` is `production`.
- PASS — CORS allows credentialed requests from `WEB_ORIGIN` and does not use `*`.
- PASS — `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app works when both are unset.
- PASS — Only the process entrypoint that calls `listen()` validates required runtime environment values. It refuses to listen when `DATABASE_URL` or `JWT_SECRET` is missing or empty.
- PASS — Auth routes use `DATABASE_URL` and `JWT_SECRET` when invoked.
- PASS — `GET /health` still returns success without a database and without `JWT_SECRET`.
- PASS — The schema adds `User` and `RefreshSession` only. The `vector` extension remains installed.
- PASS — The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.

## Required automated tests

- PASS — Vitest in the default `@jobpilot/api` run: password hashing output is Argon2id. Verification succeeds for the same password and fails for a different password. This test does not use PostgreSQL.
- PASS — Supertest, executed only by `pnpm --filter @jobpilot/api test:auth` against the Compose database: 11 tests passed. They cover register without tokens, login, `GET /auth/me`, refresh rotation, a failed refresh transaction, rejection of the previous refresh token, logout then a later refresh, missing, malformed, and expired access tokens, duplicate email, the same `401` body for a wrong password and an unknown email, an Argon2id `passwordHash` that is not the submitted password, an `HttpOnly` `SameSite=Lax` refresh cookie with the raw token absent from JSON, `Secure` when `NODE_ENV` is `production`, and credentialed CORS for `http://localhost:5173`.
- PASS — The Phase 1 health-route Supertest still passes through root `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset.
- PASS — The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose.

No Playwright test is required until Phase 4. Gemini is not called. GitHub Actions was not given a PostgreSQL service.

## Manual verification

1. PASS — The new migration was applied to Compose. `vector` is still installed.
2. PASS — Public tables are `_prisma_migrations`, `User`, and `RefreshSession` only.
3. PASS — Register, login, `GET /auth/me`, refresh, and logout were exercised with `curl` against the Compose API on port `3000`. Status codes were `201`, `200`, `200`, `200`, and `204`.
4. PASS — The second use of the pre-rotation refresh cookie returned `401`. Refresh after logout returned `401`.
5. PASS — The register response set no refresh cookie. The login `Set-Cookie` included `HttpOnly`, `SameSite=Lax`, and `Max-Age=604800`.
6. PASS — The stored `passwordHash` started with `$argon2id$` and was not the plaintext password. The manual user was deleted afterward.
7. PASS — `GET /health` returned `200` and `{"status":"ok"}`.
8. PASS — `apps/web` source has no `JWT_SECRET`, no `DATABASE_URL`, and no Gemini API key. `apps/web` was not modified in this phase.

## Commands run

Commands ran from the repository root on 2026-10-01. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate and the auth test, unless Compose injected them into the API container. The later review re-ran `pnpm typecheck`, `pnpm test`, `test:auth`, and the database test. It did not repeat install, migrate, the Compose rebuild, the full manual `curl` sequence, or the entrypoint process.

- `docker compose up -d postgres` — started `jobpilot-postgres-1`. The container became healthy.
- `docker compose ps` — Postgres was up.
- `pnpm install` — lockfile was up to date. `packages/database` `prepare` generated the Prisma client. That client stays gitignored.
- `pnpm typecheck` — succeeded for the whole monorepo.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. Applied `20261001050000_user_refresh_session`. A second run had nothing pending. `20260930120000_enable_vector` stayed applied.
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"` — one row, `vector`.
- `docker compose exec postgres psql -U postgres -c "\dt"` — `public._prisma_migrations`, `public.User`, and `public.RefreshSession`.
- `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset — succeeded. Vitest ran the health route and the Argon2id unit test: 2 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase3-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` — succeeded. 1 test passed.
- `docker compose up --build -d` — rebuilt and started the API and web images.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- Manual `curl` of register, login, `GET /auth/me`, refresh, reuse of the previous refresh cookie, logout, and a later refresh — `201`, `200`, `200`, `200`, `401`, `204`, `401`.
- The built entrypoint was run with `DATABASE_URL` missing, `DATABASE_URL` empty, and `JWT_SECRET` empty. Each exited 1 before `listen()`, with `DATABASE_URL is required` or `JWT_SECRET is required`.
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:5173/` — `200`. The rendered page was not opened in a browser.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test` with no PostgreSQL service.
- There is no automated case for a missing or expired refresh cookie, or for login with a differently cased email. The handlers normalize email and reject a missing, empty, unknown, expired, or revoked refresh cookie with `401`.

## Completion checklist

- [x] PASS — `POST /auth/register` creates the user only, does not log the user in, and does not issue an access token or a refresh token. It returns `201` with `{ "user": { "id", "email" } }`.
- [x] PASS — Register stores an Argon2id `passwordHash` and does not store the plaintext password.
- [x] PASS — Duplicate email returns `409` and `{ "error": "Email already registered" }`.
- [x] PASS — Invalid auth input returns `400` and does not echo the password.
- [x] PASS — `POST /auth/login` returns `200`, an access token, `tokenType` `Bearer`, `expiresIn` `900`, and the public user.
- [x] PASS — Login with a wrong password and login with an unknown email both return `401` and `{ "error": "Invalid email or password" }`.
- [x] PASS — The access token is an HS256 JWT whose `sub` is the user id and whose lifetime is 15 minutes.
- [x] PASS — The refresh cookie is named `refresh_token`, is `HttpOnly`, uses `SameSite=Lax`, lives 7 days, and is `Secure` only when `NODE_ENV` is `production`.
- [x] PASS — The raw refresh token is stored only as a SHA-256 hash and never in JSON.
- [x] PASS — `GET /auth/me` returns the token's user.
- [x] PASS — A missing, malformed, or expired access token is rejected with `401`.
- [x] PASS — Refresh returns a new access token, sets a new refresh cookie, and revokes the previous session and creates the replacement session in one transaction.
- [x] PASS — If that refresh transaction fails, the old session remains valid and no replacement session is created.
- [x] PASS — The previous refresh token fails after a successful rotation.
- [x] PASS — Logout revokes the presented session, clears the cookie, and a later refresh fails.
- [x] PASS — CORS credentials are enabled only for `WEB_ORIGIN`.
- [x] PASS — Zod schemas for the register body, login body, public user, and refresh session live in `packages/shared`.
- [x] PASS — Auth logic lives outside controllers.
- [x] PASS — The new migration adds only `User` and `RefreshSession`. The vector migration is unchanged.
- [x] PASS — `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app succeeds when both are unset.
- [x] PASS — `GET /health` still passes with `pnpm test` when `DATABASE_URL` and `JWT_SECRET` are unset.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes against Compose.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — The Phase 2 database integration test passes.
- [x] PASS — Compose API receives `DATABASE_URL`, `JWT_SECRET`, and `WEB_ORIGIN`. The web service does not.
- [x] PASS — `.env.example` documents `JWT_SECRET` and `WEB_ORIGIN`.
- [x] PASS — Only the process entrypoint that calls `listen()` validates required runtime environment values. It refuses to listen when `JWT_SECRET` or `DATABASE_URL` is missing or empty.
- [x] PASS — Auth routes use `DATABASE_URL` and `JWT_SECRET` when invoked.
- [x] PASS — GitHub Actions is unchanged and does not start PostgreSQL.
- [x] PASS — No Phase 4 or later work is included.
