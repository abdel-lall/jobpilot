# Phase 4 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — A visitor can register and, after logging in, reach a signed-in page. Login stores the access token, then calls `GET /auth/me` with `Authorization: Bearer <accessToken>`. The page enters `signed-in` only after `/auth/me` succeeds and shows that `/auth/me` user. It does not use the login response's `user` object.
- PASS — Registration does not sign the visitor in and does not leave an access token in memory.
- PASS — On load, authentication starts in `loading`, then enters `signed-in` or `signed-out`. The signed-out forms are not rendered while session restoration is pending.
- PASS — A successful refresh stores the access token, calls `GET /auth/me` with that bearer token, and then enters `signed-in`.
- PASS — A refresh `401` because there is no valid refresh session enters `signed-out`.
- PASS — Reloading the page starts in `loading` again, restores the session through the refresh cookie, and shows the same email.
- PASS — Logout sends `POST /auth/logout` with credentials. The client clears the in-memory access token immediately and enters `signed-out` whether that request succeeds or fails. An API or network failure may be displayed as an error. No usable bearer token is retained. Only a successful server logout guarantees that a later reload stays signed out. A failed logout request does not require the next refresh to fail.
- PASS — The access token is held in memory and sent as `Authorization: Bearer`. It is not in `localStorage`, `sessionStorage`, or a readable cookie.
- PASS — Browser JavaScript cannot read the refresh cookie. `document.cookie` does not contain `refresh_token`, and the cookie remains `HttpOnly`.
- PASS — Auth requests from `http://localhost:5173` go to `http://localhost:3000` with credentials. `SameSite=Lax` and credentialed CORS from `WEB_ORIGIN` allow refresh to succeed across those origins.
- PASS — Register and login forms use React Hook Form, Zod schemas from `@jobpilot/shared`, and shadcn/ui.
- PASS — Invalid form input is rejected in the form. Duplicate email and a wrong password show the API error string.
- PASS — The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.
- PASS — `GET /health` still returns success. The Phase 3 auth Supertest still passes.
- PASS — No profile, job, dashboard, AI, or MCP behavior is added.

## Required automated tests

- PASS — Playwright, executed only by `pnpm --filter @jobpilot/web test:e2e` against Compose: 4 tests passed. They register a unique user, log in, enter `signed-in` only after `GET /auth/me` succeeds, and see the email from that `/auth/me` response rather than the rewritten login `user` object. Reload while signed in shows the same email. Logout through a successful `POST /auth/logout` then reload enters the signed-out page. A held-then-aborted logout stays signed out and shows `Request failed` without requiring the next refresh to fail. After login, `document.cookie` does not contain `refresh_token`, and the cookie jar shows `refresh_token` as `HttpOnly` with `SameSite=Lax`. The test deletes that user through Prisma.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset: 2 tests passed, including the health route and the Argon2id unit test.

Playwright is not part of GitHub Actions. Gemini is not called.

## Manual verification

The browser checks below were exercised by the Playwright suite against Compose, plus the health request and the served-module scan. There was no separate interactive devtools session.

1. PASS — Compose was up. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
2. PASS — Opening the app showed `loading` and did not render the signed-out forms while `POST /auth/refresh` was pending. A `401` then showed register and login.
3. PASS — Register confirmed the account and stayed signed out. No refresh cookie was set.
4. PASS — After login `200`, the app called `GET /auth/me` with `Authorization: Bearer <accessToken>` and entered `signed-in` only after that call succeeded. The page showed the `/auth/me` email. The test rewrote the login `user.email` to `not-used@example.com`.
5. PASS — After login, `localStorage` and `sessionStorage` were empty. `document.cookie` did not contain `refresh_token`. The cookie jar had `refresh_token` with `httpOnly: true` and `sameSite: "Lax"`.
6. PASS — Register, login, refresh, logout, and `/auth/me` went to `http://localhost:3000` with credentials. Cross-origin refresh succeeded with the existing `SameSite=Lax` cookie.
7. PASS — Reload started in `loading` again and showed the same email after refresh and `GET /auth/me`.
8. PASS — Logout was `POST /auth/logout` with credentials and returned `204`. The client entered `signed-out`, and a later reload stayed signed out (`refresh` `401`). A failed logout request left the signed-out page and showed `Request failed` without requiring the next refresh to fail.
9. PASS — Duplicate email showed `Email already registered`. A wrong password showed `Invalid email or password`. Invalid email and a short password produced form messages and no register request. Passwords were not written to the console.
10. PASS — `apps/web/src` and the modules Vite served have no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`. The Compose web service does not receive those variables. The Playwright process reads `DATABASE_URL` on the host to delete its user.
11. PASS — Playwright deleted its users. A follow-up query found no `phase4-%` rows.

## Commands run

Commands ran from the repository root on 2026-10-01 during implementation. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate and the auth test. The later review re-ran `pnpm typecheck` only. It passed, including `apps/web/tsconfig.e2e.json`. The review did not repeat install, `pnpm test`, migrate, `test:auth`, the Compose rebuild, Playwright, or the health request.

- `pnpm install` — succeeded. Lockfile updated for the web auth and Playwright dependencies.
- `pnpm typecheck` — succeeded for the whole monorepo. The web script also typechecks `tsconfig.e2e.json`.
- `env -u DATABASE_URL -u JWT_SECRET pnpm test` — succeeded. 2 tests passed.
- `docker compose up -d postgres` — started Postgres.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. 2 migrations applied. No new migration was added in this phase.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase4-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `docker compose up --build -d` — rebuilt and started the API and web images. Exit code 0.
- `pnpm --filter @jobpilot/web exec playwright install chromium` — succeeded. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 4 tests passed. `apps/web/test-results/.last-run.json` records `passed`.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `curl` of the Vite-served auth modules — no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- `docker exec jobpilot-postgres-1 psql -U postgres -c "SELECT email FROM \"User\" WHERE email LIKE 'phase4-%';"` — no rows.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- There is no separate production web bundle. Compose runs the Vite dev server, and those served modules were scanned.
- The review did not re-run the Playwright suite. Its last-run file was recorded after the current auth source and e2e spec were saved.

## Completion checklist

- [x] PASS — Register uses React Hook Form, `registerBodySchema`, and shadcn/ui. Success stays signed out and stores no access token.
- [x] PASS — Login uses React Hook Form, `loginBodySchema`, and shadcn/ui. Success stores the returned access token, calls `GET /auth/me` with that bearer token, enters `signed-in` only after `/auth/me` succeeds, and shows that `/auth/me` user. The signed-in page does not use the login response's `user` object.
- [x] PASS — The access token is sent as `Authorization: Bearer` and is absent from `localStorage`, `sessionStorage`, and readable cookies.
- [x] PASS — On load, authentication starts in `loading`, calls `POST /auth/refresh` with credentials, and does not render the signed-out forms while restoration is pending.
- [x] PASS — A successful refresh stores the access token, calls `GET /auth/me` with that bearer token, and then enters `signed-in`.
- [x] PASS — A refresh `401` because there is no valid refresh session enters `signed-out`.
- [x] PASS — Reload while signed in starts in `loading` again, restores the session, and shows the same email.
- [x] PASS — Logout sends `POST /auth/logout` with credentials, clears the in-memory access token immediately, and enters `signed-out` whether the request succeeds or fails. An API or network failure may be displayed as an error. No usable bearer token is retained. Only a successful server logout guarantees that a later reload stays signed out. A failed logout request does not require the next refresh to fail.
- [x] PASS — `document.cookie` cannot read `refresh_token`. The cookie is `HttpOnly`.
- [x] PASS — Auth fetches target `VITE_API_ORIGIN` (`http://localhost:3000` locally) with `credentials: "include"`. They do not use the Vite `/health` proxy.
- [x] PASS — `SameSite=Lax` and credentialed CORS from `http://localhost:5173` succeed for login, refresh, and logout. The Phase 3 auth contract is otherwise unchanged.
- [x] PASS — Duplicate email and a wrong password show the API `error` string. Passwords are not logged.
- [x] PASS — `.env.example` documents `VITE_API_ORIGIN`. Compose sets it on the web service. The web service still has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose and deletes its user.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 5 or later work is included.
