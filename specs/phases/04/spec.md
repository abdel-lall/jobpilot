# Phase 4 — Authentication UI

## Objective

Let a person register, log in, stay signed in, and log out in the browser.

## Scope

This phase adds only the authentication UI described in the Phase 4 section of `specs/roadmap.md`:

- Register and login forms using React Hook Form, Zod, and shadcn/ui.
- The access token is held in memory and sent as an `Authorization` bearer token.
- On load, authentication is `loading`, `signed-out`, or `signed-in`. The app starts in `loading`, refreshes the session with the HttpOnly cookie, and does not render the signed-out forms while that restoration is pending.
- Logout sends `POST /auth/logout` with credentials, clears the in-memory access token immediately, and enters `signed-out` whether that request succeeds or fails. Only a successful server logout guarantees that a later reload stays signed out.
- Cookie `SameSite` and credentialed CORS work when the web app and API use different local origins.
- A signed-in page shows the current user's email. A signed-out page shows the register and login forms.
- Playwright covers register, reload while signed in, logout, and the fact that page JavaScript cannot read the refresh cookie.

The browser uses the Phase 3 HTTP contract. Registration still does not log the user in. The visitor registers, then logs in, and only then reaches the signed-in page.

| Visitor action | Request | Result |
| --- | --- | --- |
| Open the app | `POST /auth/refresh` with credentials | Start in `loading`. On `200`, store the access token, call `GET /auth/me` with that bearer token, then enter `signed-in`. On `401` because there is no valid refresh session, enter `signed-out`. Do not render the signed-out forms while restoration is pending. |
| Submit register | `POST /auth/register` | `201` confirms the account and leaves the visitor signed out. No access token is stored and no refresh cookie is expected. |
| Submit login | `POST /auth/login` with credentials, then `GET /auth/me` | `200` stores the returned access token in memory. Then call `GET /auth/me` with `Authorization: Bearer <accessToken>`. Enter `signed-in` only after `/auth/me` succeeds. The signed-in page uses that `/auth/me` user, not the `user` object in the login response. The refresh token stays in the cookie. |
| Signed-in page | `GET /auth/me` with `Authorization: Bearer` | `200` is the authenticated user shown by the UI. |
| Reload while signed in | `POST /auth/refresh` with credentials, then `GET /auth/me` | Start in `loading` again. The same email is shown after `signed-in`. The previous in-memory token is gone. |
| Logout | `POST /auth/logout` with credentials | Clear the in-memory access token immediately when logout is attempted. Enter `signed-out` whether the request succeeds or fails. An API or network failure may be displayed as an error. Only a successful server logout guarantees that a later reload stays signed out. Do not require refresh to fail when the logout request itself failed. |

Auth requests go to the API origin, `http://localhost:3000` locally, with `credentials: "include"`. They do not go through the Vite `/health` proxy. That proxy may stay for the Phase 1 health route. The web origin remains `http://localhost:5173`, which is `WEB_ORIGIN`.

Public user JSON and error bodies stay as Phase 3 defined them. The UI shows the API `error` string for `400`, `401`, and `409`. It does not show a password, a password hash, or a refresh token.

## Affected subsystems

- Authentication
- `apps/web`
- `apps/api`

`apps/api` changes only if the existing `SameSite=Lax` cookie or credentialed CORS fails for a browser on `http://localhost:5173` calling `http://localhost:3000`. Phase 3 already set that cookie and CORS. If they work, leave the API behavior unchanged.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 4:

- Candidate profile tables, profile CRUD, and profile pages. Phases 5 and 6.
- Resume file upload, download, delete, and local disk storage. Phase 7.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, Gemini calls, or a model client. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and vector queries. Phase 12.
- A router library, protected-route framework, or account settings. The signed-out and signed-in views live in the existing React app.
- Email verification, password reset, OAuth, MFA, account deletion, and rate limiting. None of these are in the Phase 4 roadmap.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or response bodies.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phase 3.

Phase 3 provides `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, and `GET /auth/me`. Access tokens last 15 minutes and are bearer tokens. The refresh cookie is named `refresh_token`, is `HttpOnly`, uses `SameSite=Lax`, lives 7 days, and is `Secure` only when `NODE_ENV` is `production`. CORS allows credentials from exactly `WEB_ORIGIN`. Register and login bodies and the public user schema live in `packages/shared`.

Local Compose publishes the API on `http://localhost:3000` and the web app on `http://localhost:5173`. `WEB_ORIGIN` is `http://localhost:5173`.

## Implementation constraints

These constraints come from Phase 4, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Browser session

- Hold the access token in React memory only. Do not write it to `localStorage`, `sessionStorage`, a readable cookie, or any other frontend-readable store.
- Send it only as `Authorization: Bearer <accessToken>`.
- Authentication has three states: `loading`, `signed-out`, and `signed-in`.
- On application load, and on every full reload, start in `loading`. Call `POST /auth/refresh` with credentials before entering either other state. Do not render the signed-out forms while session restoration is still pending.
- If refresh succeeds, store the returned access token in memory, call `GET /auth/me` with that bearer token, then enter `signed-in`.
- If refresh returns `401` because there is no valid refresh session, enter `signed-out`.
- After `POST /auth/login` succeeds, store the returned access token in memory, then call `GET /auth/me` with `Authorization: Bearer <accessToken>`. Enter `signed-in` only after `/auth/me` succeeds. Use the `/auth/me` response as the authenticated user shown by the UI. Do not rely on the `user` object in the login response for the signed-in page. Do not read the refresh token from the login response.
- Logout sends `POST /auth/logout` with credentials. Clear the in-memory access token immediately when logout is attempted, and enter `signed-out` whether that request succeeds or fails. Do not retain a usable bearer token after the user explicitly logs out. An API or network failure may be displayed as an error. Only a successful server logout guarantees that a later reload stays `signed-out`. Do not claim refresh must fail after a logout request that itself failed.
- Register calls `POST /auth/register` and does not store an access token. After `201`, keep the visitor on the signed-out page with a visible confirmation, and let them submit the login form. Duplicate email shows the `409` error. Invalid email or password length is rejected by the form before the request when the shared Zod schema fails.
- The signed-in page shows the email from the `/auth/me` response and a logout control. It does not show the login response's `user` object, and it does not show profile, job, or dashboard data.
- The signed-out page has both a register form and a login form. They may be two sections of one page or a control that switches between them. Do not add a routing library.
- Page JavaScript must not be able to read `refresh_token`. Do not copy the cookie into the page.

### Forms and API calls

- Use React Hook Form, Zod, and shadcn/ui for both forms. Add only the form dependencies and shadcn components this phase needs, including `react-hook-form`, `@hookform/resolvers`, and a direct `zod` dependency if the web app imports the shared schemas.
- Validate with `registerBodySchema` and `loginBodySchema` from `@jobpilot/shared`. Do not duplicate those schemas. Password fields are `type="password"`. Email rules stay trim, lowercase, and a valid email. Password length stays 8 through 128 characters.
- `apps/web` may depend on `@jobpilot/shared`. Do not put `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY` in the web app, its environment, or its bundle.
- The API base URL is the public `VITE_API_ORIGIN`. Locally it is `http://localhost:3000`. Document it in `.env.example`. The Compose web service sets `VITE_API_ORIGIN=http://localhost:3000` so a browser on the host calls the published API port. Missing the variable falls back to `http://localhost:3000`.
- Every auth `fetch` uses `credentials: "include"` and the API origin. Do not send auth requests to the Vite dev server proxy.
- Do not log passwords, access tokens, refresh tokens, or `JWT_SECRET`.

### API

- Keep the Phase 3 auth contract. `createApp()` still must not require `DATABASE_URL` or `JWT_SECRET`.
- Do not add product tables or a migration.
- If a browser on `http://localhost:5173` cannot store or send the refresh cookie to `http://localhost:3000`, the allowed fix is limited to the cookie attributes or the credentialed CORS headers for `WEB_ORIGIN`. `SameSite=Lax` remains the intended attribute unless that browser check proves it cannot send the cookie on the refresh `fetch`. Do not switch auth to the Vite proxy to avoid that check.
- Do not use `Access-Control-Allow-Origin: *`.

### Tests and runtime

- Add Playwright as a dev dependency of `@jobpilot/web`. The script is `pnpm --filter @jobpilot/web test:e2e`. It is not part of root `pnpm test`, so GitHub Actions stays typecheck plus the existing Vitest run.
- The Playwright test assumes Compose is already running. It opens `http://localhost:5173`, registers a unique email, logs in, and enters `signed-in` only after `GET /auth/me` succeeds. The email it sees is that `/auth/me` user. It reloads and sees the same email, logs out through a successful `POST /auth/logout`, and reloads into the signed-out page. It does not assert that refresh fails after a logout request that itself failed.
- After login, `document.cookie` does not contain `refresh_token`. The browser cookie jar still has `refresh_token` with `httpOnly` true.
- The test deletes the user it created through Prisma, using `DATABASE_URL`. It does not add a delete-user route.
- `pnpm --filter @jobpilot/api test:auth` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless this phase directly requires them.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
