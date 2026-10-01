# Phase 3 — Validation

Result: Not started.

## Acceptance criteria

- A new user can register and log in.
- Registration creates the user only. It does not log the user in, and it does not issue an access token or a refresh token. This is an intentional MVP contract.
- `GET /auth/me` accepts that user's access token and returns that user.
- Refresh returns a new access token and replaces the refresh session in one transaction.
- If the refresh transaction fails, the old session remains valid and no replacement session is created.
- The previous refresh token fails after a successful rotation.
- Logout causes a later refresh to fail.
- A request without a valid access token is rejected. This includes a missing token, a malformed token, and an expired token.
- Password hashes are Argon2id, and plaintext passwords are not stored.
- Register, login, refresh, and logout responses do not contain a password, a password hash, or a refresh token.
- The refresh cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` only when `NODE_ENV` is `production`.
- CORS allows credentialed requests from `WEB_ORIGIN` and does not use `*`.
- `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app works when both are unset.
- Only the process entrypoint that calls `listen()` validates required runtime environment values. It refuses to listen when `DATABASE_URL` or `JWT_SECRET` is missing or empty.
- Auth routes may validate and use `DATABASE_URL` and `JWT_SECRET` when invoked.
- `GET /health` still returns success without a database and without `JWT_SECRET`.
- The schema adds `User` and `RefreshSession` only. The `vector` extension remains installed.
- The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.

## Required automated tests

- Vitest in the default `@jobpilot/api` run: password hashing output is Argon2id. Verification succeeds for the same password and fails for a different password. This test must not need PostgreSQL.
- Supertest, executed only by `pnpm --filter @jobpilot/api test:auth` against the Compose database:
  - register creates the user only and does not issue an access token or a refresh cookie
  - login
  - protected `GET /auth/me`
  - refresh rotation
  - a failed refresh transaction leaves the old session valid and creates no replacement session
  - the previous refresh token is rejected
  - logout, then a later refresh is rejected
  - missing, malformed, and expired access tokens are rejected
  - duplicate email is rejected
  - login with a wrong password and login with an unknown email return the same `401` body
  - the stored `passwordHash` starts with `$argon2id$` and is not the submitted password
  - the refresh `Set-Cookie` is `HttpOnly` and `SameSite=Lax`, and the raw token is absent from JSON
  - with `NODE_ENV=production`, the refresh cookie is also `Secure`
  - a credentialed CORS response for `http://localhost:5173` allows that origin and credentials
- The Phase 1 health-route Supertest still passes through root `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset. That run imports and constructs the app through `createApp()` without those variables.
- The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose.

No Playwright test is required until Phase 4. Gemini is not called. GitHub Actions is not given a PostgreSQL service in this phase.

## Manual verification

1. Apply the new migration to Compose and confirm `vector` is still installed.
2. Confirm the public tables are `_prisma_migrations`, `User`, and `RefreshSession` only.
3. Register a user, log in, call `GET /auth/me`, refresh, and log out with `curl` against the Compose API on port `3000`.
4. Confirm the second use of the pre-rotation refresh cookie fails, and confirm refresh fails again after logout.
5. Confirm a register response does not set the refresh cookie, and confirm a login `Set-Cookie` includes `HttpOnly` and `SameSite=Lax`.
6. Read the `User` row and confirm `passwordHash` starts with `$argon2id$` and is not the plaintext password.
7. Confirm `GET /health` still returns `200` and `{ "status": "ok" }`.
8. Confirm `apps/web` source has no `JWT_SECRET`, no `DATABASE_URL`, and no Gemini API key.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma and the auth test, unless Compose is injecting them into the API container.

- `docker compose up -d postgres`
- `docker compose ps`
- `pnpm install`
- `pnpm typecheck`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`
- `docker compose exec postgres psql -U postgres -c "\dt"`
- `pnpm test`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase3-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test`
- `docker compose up --build -d`
- `curl -sS http://localhost:3000/health`
- Manual `curl` of register, login, `GET /auth/me`, refresh, and logout against `http://localhost:3000`, including the failed reuse and failed post-logout refresh.
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:5173/`

The expired-token case is covered by `test:auth`. Do not wait 15 minutes.

## Completion checklist

- [ ] `POST /auth/register` creates the user only, does not log the user in, and does not issue an access token or a refresh token. It returns `201` with `{ "user": { "id", "email" } }`. This is an intentional MVP contract.
- [ ] Register stores an Argon2id `passwordHash` and does not store the plaintext password.
- [ ] Duplicate email returns `409` and `{ "error": "Email already registered" }`.
- [ ] Invalid auth input returns `400` and does not echo the password.
- [ ] `POST /auth/login` returns `200`, an access token, `tokenType` `Bearer`, `expiresIn` `900`, and the public user.
- [ ] Login with a wrong password and login with an unknown email both return `401` and `{ "error": "Invalid email or password" }`.
- [ ] The access token is an HS256 JWT whose `sub` is the user id and whose lifetime is 15 minutes.
- [ ] The refresh cookie is named `refresh_token`, is `HttpOnly`, uses `SameSite=Lax`, lives 7 days, and is `Secure` only when `NODE_ENV` is `production`.
- [ ] The raw refresh token is stored only as a SHA-256 hash and never in JSON.
- [ ] `GET /auth/me` returns the token's user.
- [ ] A missing, malformed, or expired access token is rejected with `401`.
- [ ] Refresh returns a new access token, sets a new refresh cookie, and revokes the previous session and creates the replacement session in one transaction.
- [ ] If that refresh transaction fails, the old session remains valid and no replacement session is created.
- [ ] The previous refresh token fails after a successful rotation.
- [ ] Logout revokes the presented session, clears the cookie, and a later refresh fails.
- [ ] CORS credentials are enabled only for `WEB_ORIGIN`.
- [ ] Zod schemas for the register body, login body, public user, and refresh session live in `packages/shared`.
- [ ] Auth logic lives outside controllers.
- [ ] The new migration adds only `User` and `RefreshSession`. The vector migration is unchanged.
- [ ] `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app succeeds when both are unset.
- [ ] `GET /health` still passes with `pnpm test` when `DATABASE_URL` and `JWT_SECRET` are unset.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes against Compose.
- [ ] `pnpm typecheck` passes.
- [ ] The Phase 2 database integration test passes.
- [ ] Compose API receives `DATABASE_URL`, `JWT_SECRET`, and `WEB_ORIGIN`. The web service does not.
- [ ] `.env.example` documents `JWT_SECRET` and `WEB_ORIGIN`.
- [ ] Only the process entrypoint that calls `listen()` validates required runtime environment values. It refuses to listen when `JWT_SECRET` or `DATABASE_URL` is missing or empty.
- [ ] Auth routes may validate and use `DATABASE_URL` and `JWT_SECRET` when invoked.
- [ ] GitHub Actions is unchanged and does not start PostgreSQL.
- [ ] No Phase 4 or later work is included.
