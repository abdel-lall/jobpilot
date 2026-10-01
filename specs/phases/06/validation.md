# Phase 6 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — A signed-in user sees five profile sections, in order: Skills, Education, Work experience, Projects, and Certifications. The page still shows the `/auth/me` email and `Log out`.
- PASS — Profile sections are absent while authentication is `loading` or `signed-out`. Entering `signed-in` does not wait for the profile lists. Each section then loads on its own.
- PASS — While a section's first list request is pending, that section shows its loading state and does not show its empty-state text. The empty state appears only after a successful response whose array is empty. A failed list shows the API `error` string, or `Request failed`, and does not show that section's empty state. One section loading or failing does not block the others.
- PASS — Each empty section shows its empty state: `No skills yet.`, `No education yet.`, `No work experience yet.`, `No projects yet.`, and `No certifications yet.`
- PASS — Profile query keys are the profile path and the authenticated user id. Entering `signed-out` removes cached profile queries. A user id change in the same document does not reuse the previous user's profile queries. The query cache is not persisted. Phase 4 auth behavior stays the same.
- PASS — The user can add one skill, one education record, one work experience record, one project, and one certification.
- PASS — The user can edit each of those records and see the edited values.
- PASS — Reloading the page restores the session and shows the same edited records. A blank end date is shown as `Present`.
- PASS — The user can delete each record and see that section's empty state again.
- PASS — Lists come from TanStack Query refetches of the Phase 5 list routes, in the API order. Each section in the browser test has one row, so ordering between multiple rows was not asserted.
- PASS — Forms use React Hook Form, the shared Zod create and update schemas, and shadcn/ui.
- PASS — An empty skill name is rejected in the form and does not send `POST /profile/skills`.
- PASS — A failed profile request shows the API `error` string.
- PASS — Profile requests go to `VITE_API_ORIGIN` with `Authorization: Bearer` and credentials. The access token stays in memory.
- PASS — The web app has no Gemini API key, no database URL, and no `JWT_SECRET`. Playwright reads `DATABASE_URL` in Node to delete its users.
- PASS — The Phase 4 auth browser tests still pass. The Phase 3 auth Supertest and the Phase 5 profile Supertest still pass.
- PASS — No resume-file storage, jobs, dashboard, AI, or MCP behavior is added.

## Required automated tests

- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 10 tests passed. They create, edit, reload, and delete one record of each profile type, including the empty state before the first record and after delete. The test uses the values in the phase spec, deletes its `phase6-` user through Prisma, and shows `Invalid input` when `POST /profile/skills` is stubbed to `400`. An empty skill name produces a form message and no skill `POST`.
- PASS — The same `test:e2e` run holds the initial profile list GETs after `signed-in` is visible. Each section shows its loading state, and none of the empty-state messages are visible, until that section's response resolves. Four resolved empty lists show their empty states while a still-pending section does not. A list GET stubbed to `400` with `{ "error": "Invalid input" }` shows that string and not its empty state, while the other sections still show theirs.
- PASS — The same `test:e2e` run, in one document and without a reload, creates a skill as user A, logs out, and logs in as user B. User B does not see user A's skill. User B's skills empty state appears only after user B's skills list resolves empty.
- PASS — The same `test:e2e` command still passes the Phase 4 auth cases: register, reload while signed in, logout, failed logout, API error strings, and client-side register validation.
- PASS — Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database, 41 tests passed.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset: 2 tests passed, including the health route and the Argon2id unit test.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

The browser checks below were exercised by the Playwright suite against Compose. Health, the served-module scan, and the leftover-user query were checked again while writing this record. There was no separate interactive devtools session.

1. PASS — Compose was up. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
2. PASS — The signed-in page shows the email and logout as soon as the session is signed in. A section does not show its empty-state text before its list request finishes. An empty success then shows the empty state.
3. PASS — One record in each section is added, edited, and still present after reload. A blank experience end date reads `Present`.
4. PASS — Deleting each record returns that section's empty state.
5. PASS — Logout removes the profile sections. In the same document, the next user does not see the previous user's skill.
6. PASS — `apps/web/src` and the modules Vite served for `main`, session, API helper, and profile have no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`. The Playwright specs read `DATABASE_URL` on the host to delete their users.
7. PASS — Playwright deletes its users. A follow-up query found no `phase6-%` rows. No separate manual users were created.

## Commands run

Commands ran from the repository root on 2026-10-01 during implementation. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate, the database-backed tests, and Playwright user cleanup. Source files were last saved before that run. The later review did not re-run these commands. While writing this record, health, the served-module scan, and the leftover-user query were checked again. Install, typecheck, `pnpm test`, migrate, `test:auth`, `test:profile`, the Compose rebuild, and Playwright were not repeated.

- `pnpm install` — succeeded. Lockfile already up to date. Prisma client generated.
- `pnpm typecheck` — succeeded for the whole monorepo, including `apps/web/tsconfig.e2e.json`.
- `env -u DATABASE_URL -u JWT_SECRET pnpm test` — succeeded. 2 tests passed.
- `docker compose up -d postgres` — Postgres was already running.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. 3 migrations found, none pending. No new migration was added.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase6-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase6-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `docker compose up --build -d` — rebuilt and started the API and web images. Exit code 0.
- `pnpm --filter @jobpilot/web exec playwright install chromium` — succeeded as the second half of that command. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 10 tests passed. `apps/web/test-results/.last-run.json` records `passed`.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `curl` of the Vite-served profile and session modules — no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- `docker exec jobpilot-postgres-1 psql -U postgres -c "SELECT email FROM \"User\" WHERE email LIKE 'phase6-%';"` — no rows.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- The review did not re-run install, typecheck, `pnpm test`, migrate, `test:auth`, `test:profile`, the Compose rebuild, or Playwright. Those commands succeeded in the implementation run, and source files were saved before it.
- There is no separate production web bundle. Compose runs the Vite dev server, and those served modules were scanned.
- The browser cases do not assert an end date before the start date, splitting accomplishment lines, clearing a date that was previously set, or order across multiple rows in one section. Those paths are implemented. The spec's required browser cases do not include them.
- The manual checks were not repeated in a separate interactive browser session. They passed in Playwright, plus the health request and the served-module scan.

## Completion checklist

- [x] PASS — The signed-in page shows the account email, logout, and the five profile sections in roadmap order.
- [x] PASS — Profile UI is hidden during session restore and when signed out.
- [x] PASS — Each section shows its loading state while its first list request is pending, and shows the empty state only after an empty success. A pending or failed section does not show its empty state and does not block the others.
- [x] PASS — Each section shows the specified empty state when its list is empty.
- [x] PASS — Signed-out removes cached profile queries. Query keys include the user id, so another user in the same document does not see the previous user's records. The query cache is not persisted.
- [x] PASS — Create, edit, and delete call the Phase 5 routes and refresh the list through TanStack Query.
- [x] PASS — Reload shows the edited records, including `Present` for a null end date.
- [x] PASS — Forms use React Hook Form, shared Zod schemas, and shadcn/ui.
- [x] PASS — Accomplishments and technologies are submitted as trimmed line arrays. Blank nullable fields are omitted on create and sent as `null` on edit.
- [x] PASS — Invalid form input does not send the request. A profile `400` shows the API `error` string.
- [x] PASS — The access token stays in memory and is sent only as `Authorization: Bearer`.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4 auth cases, and deletes its user.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — No migration is added. `packages/shared` and the profile API contract stay as Phase 5 defined them.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [x] PASS — GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 7 or later work is included.
