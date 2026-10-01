# Phase 4 — Validation

## Result

Not started.

## Acceptance criteria

- A visitor can register and, after logging in, reach a signed-in page. Login stores the access token, then calls `GET /auth/me` with `Authorization: Bearer <accessToken>`. The page enters `signed-in` only after `/auth/me` succeeds and shows that `/auth/me` user. It does not use the login response's `user` object.
- Registration does not sign the visitor in and does not leave an access token in memory.
- On load, authentication starts in `loading`, then enters `signed-in` or `signed-out`. The signed-out forms are not rendered while session restoration is pending.
- A successful refresh stores the access token, calls `GET /auth/me` with that bearer token, and then enters `signed-in`.
- A refresh `401` because there is no valid refresh session enters `signed-out`.
- Reloading the page starts in `loading` again, restores the session through the refresh cookie, and shows the same email.
- Logout sends `POST /auth/logout` with credentials. The client clears the in-memory access token immediately and enters `signed-out` whether that request succeeds or fails. An API or network failure may be displayed as an error. No usable bearer token is retained. Only a successful server logout guarantees that a later reload stays signed out. A failed logout request does not require the next refresh to fail.
- The access token is held in memory and sent as `Authorization: Bearer`. It is not in `localStorage`, `sessionStorage`, or a readable cookie.
- Browser JavaScript cannot read the refresh cookie. `document.cookie` does not contain `refresh_token`, and the cookie remains `HttpOnly`.
- Auth requests from `http://localhost:5173` go to `http://localhost:3000` with credentials. `SameSite=Lax` and credentialed CORS from `WEB_ORIGIN` allow refresh to succeed across those origins.
- Register and login forms use React Hook Form, Zod schemas from `@jobpilot/shared`, and shadcn/ui.
- Invalid form input is rejected in the form. Duplicate email and a wrong password show the API error string.
- The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.
- `GET /health` still returns success. The Phase 3 auth Supertest still passes.
- No profile, job, dashboard, AI, or MCP behavior is added.

## Required automated tests

- Playwright, executed only by `pnpm --filter @jobpilot/web test:e2e` against Compose: register a unique user, log in, enter `signed-in` only after `GET /auth/me` succeeds, and see the email from that `/auth/me` response rather than the login response's `user` object. Reload while signed in and see the same email. Log out through a successful `POST /auth/logout`, then reload into the signed-out page. Do not assert that refresh fails when logout itself failed. After login, `document.cookie` does not contain `refresh_token`, and the cookie jar shows `refresh_token` as `HttpOnly`. The test deletes that user through Prisma.
- Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database.
- Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset, including the health route and the Argon2id unit test.

Playwright is not part of GitHub Actions. Gemini is not called.

## Manual verification

1. Compose is up. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. Open `http://localhost:5173`. The app starts in `loading` and does not render the signed-out forms while `POST /auth/refresh` is pending. A `401` because there is no valid refresh session then shows register and login.
3. Register a new email and password. The page confirms the account and stays signed out.
4. Log in with that email and password. After login `200`, the app calls `GET /auth/me` with `Authorization: Bearer <accessToken>` and enters `signed-in` only after that call succeeds. The page shows the `/auth/me` user, not the login response's `user` object.
5. In the browser devtools, the access token is not in `localStorage` or `sessionStorage`. `document.cookie` does not contain `refresh_token`. The `refresh_token` cookie is `HttpOnly` and `SameSite=Lax`.
6. The login and refresh requests go to `http://localhost:3000`, include credentials, and succeed. The refresh response sets a new `refresh_token` cookie.
7. Reload the page. The same email is shown after refresh.
8. Log out. The request is `POST /auth/logout` with credentials. The in-memory access token is cleared immediately, and the client enters `signed-out` whether that request succeeds or fails. After this successful logout, no usable bearer token remains and reload stays signed out. A failed logout does not by itself prove that a later refresh fails.
9. A duplicate email and a wrong password show the API error string. The password is not written to the console.
10. `apps/web` source and the running web bundle have no `JWT_SECRET`, no `DATABASE_URL`, and no Gemini API key.
11. Delete the manual user afterward.

## Commands

Run these from the repository root after implementation. Do not mark a check passed unless that command or inspection succeeded.

- `pnpm install`
- `pnpm typecheck`
- `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase4-validation-secret pnpm --filter @jobpilot/api test:auth`
- `docker compose up --build -d`
- `pnpm --filter @jobpilot/web exec playwright install chromium`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`
- `curl -sS http://localhost:3000/health`

## Completion checklist

- [ ] Register uses React Hook Form, `registerBodySchema`, and shadcn/ui. Success stays signed out and stores no access token.
- [ ] Login uses React Hook Form, `loginBodySchema`, and shadcn/ui. Success stores the returned access token, calls `GET /auth/me` with that bearer token, enters `signed-in` only after `/auth/me` succeeds, and shows that `/auth/me` user. The signed-in page does not use the login response's `user` object.
- [ ] The access token is sent as `Authorization: Bearer` and is absent from `localStorage`, `sessionStorage`, and readable cookies.
- [ ] On load, authentication starts in `loading`, calls `POST /auth/refresh` with credentials, and does not render the signed-out forms while restoration is pending.
- [ ] A successful refresh stores the access token, calls `GET /auth/me` with that bearer token, and then enters `signed-in`.
- [ ] A refresh `401` because there is no valid refresh session enters `signed-out`.
- [ ] Reload while signed in starts in `loading` again, restores the session, and shows the same email.
- [ ] Logout sends `POST /auth/logout` with credentials, clears the in-memory access token immediately, and enters `signed-out` whether the request succeeds or fails. An API or network failure may be displayed as an error. No usable bearer token is retained. Only a successful server logout guarantees that a later reload stays signed out. A failed logout request does not require the next refresh to fail.
- [ ] `document.cookie` cannot read `refresh_token`. The cookie is `HttpOnly`.
- [ ] Auth fetches target `VITE_API_ORIGIN` (`http://localhost:3000` locally) with `credentials: "include"`. They do not use the Vite `/health` proxy.
- [ ] `SameSite=Lax` and credentialed CORS from `http://localhost:5173` succeed for login, refresh, and logout. The Phase 3 auth contract is otherwise unchanged.
- [ ] Duplicate email and a wrong password show the API `error` string. Passwords are not logged.
- [ ] `.env.example` documents `VITE_API_ORIGIN`. Compose sets it on the web service. The web service still has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose and deletes its user.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [ ] No Phase 5 or later work is included.
