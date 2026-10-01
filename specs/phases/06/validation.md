# Phase 6 — Validation

Not started. Do not mark an item PASS until the command, test, or inspection has actually succeeded.

## Acceptance criteria

- [ ] A signed-in user sees five profile sections, in order: Skills, Education, Work experience, Projects, and Certifications. The page still shows the `/auth/me` email and `Log out`.
- [ ] Profile sections are absent while authentication is `loading` or `signed-out`. Entering `signed-in` does not wait for the profile lists. Each section then loads on its own.
- [ ] While a section's first list request is pending, that section shows its loading state and does not show its empty-state text. The empty state appears only after a successful response whose array is empty. A failed list shows the API `error` string, or `Request failed`, and does not show that section's empty state. One section loading or failing does not block the others.
- [ ] Each empty section shows its empty state: `No skills yet.`, `No education yet.`, `No work experience yet.`, `No projects yet.`, and `No certifications yet.`
- [ ] Profile query keys are the profile path and the authenticated user id. Entering `signed-out` removes cached profile queries. A user id change in the same document does not reuse the previous user's profile queries. The query cache is not persisted. Phase 4 auth behavior stays the same.
- [ ] The user can add one skill, one education record, one work experience record, one project, and one certification.
- [ ] The user can edit each of those records and see the edited values.
- [ ] Reloading the page restores the session and shows the same edited records. A blank end date is shown as `Present`.
- [ ] The user can delete each record and see that section's empty state again.
- [ ] Lists come from TanStack Query refetches of the Phase 5 list routes, in the API order.
- [ ] Forms use React Hook Form, the shared Zod create and update schemas, and shadcn/ui.
- [ ] An empty skill name is rejected in the form and does not send `POST /profile/skills`.
- [ ] A failed profile request shows the API `error` string.
- [ ] Profile requests go to `VITE_API_ORIGIN` with `Authorization: Bearer` and credentials. The access token stays in memory.
- [ ] The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.
- [ ] The Phase 4 auth browser tests still pass. The Phase 3 auth Supertest and the Phase 5 profile Supertest still pass.
- [ ] No resume-file storage, jobs, dashboard, AI, or MCP behavior is added.

## Required automated tests

- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: create, edit, reload, and delete one record of each profile type, including the empty state before the first record and after delete. The test uses the values in the phase spec, deletes its `phase6-` user through Prisma, and shows `Invalid input` when `POST /profile/skills` is stubbed to `400`. An empty skill name produces a form message and no skill `POST`.
- [ ] The same `test:e2e` run holds the initial profile list GETs after `signed-in` is visible. Each section shows its loading state, and none of the empty-state messages are visible, until that section's response resolves. Four resolved empty lists show their empty states while a still-pending section does not. A list GET stubbed to `400` with `{ "error": "Invalid input" }` shows that string and not its empty state, while the other sections still show theirs.
- [ ] The same `test:e2e` run, in one document and without a reload, creates a skill as user A, logs out, and logs in as user B. User B does not see user A's skill. User B's skills empty state appears only after user B's skills list resolves empty.
- [ ] The same `test:e2e` command still passes the Phase 4 auth cases: register, reload while signed in, logout, failed logout, API error strings, and client-side register validation.
- [ ] Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database.
- [ ] Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database.
- [ ] Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset, including the health route and the Argon2id unit test.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. Start Compose and confirm `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. Open `http://localhost:5173`, register, and log in. Confirm the signed-in page shows the email and logout as soon as the session is signed in. Confirm a section does not show its empty-state text before its list request finishes, and that an empty success then shows the empty state.
3. Add one record in each section, edit it, reload, and confirm the edited values are still there. Confirm a blank experience end date reads `Present`.
4. Delete each record and confirm the empty state returns.
5. Log out and confirm the profile sections are gone.
6. Confirm the served web modules have no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. Delete any manual user afterward.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma and the database-backed tests.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase6-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase6-validation-secret pnpm --filter @jobpilot/api test:profile`
- `docker compose up --build -d`
- `pnpm --filter @jobpilot/web exec playwright install chromium`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`
- `curl -sS http://localhost:3000/health`

Do not add these tests to GitHub Actions.

## Completion checklist

- [ ] The signed-in page shows the account email, logout, and the five profile sections in roadmap order.
- [ ] Profile UI is hidden during session restore and when signed out.
- [ ] Each section shows its loading state while its first list request is pending, and shows the empty state only after an empty success. A pending or failed section does not show its empty state and does not block the others.
- [ ] Each section shows the specified empty state when its list is empty.
- [ ] Signed-out removes cached profile queries. Query keys include the user id, so another user in the same document does not see the previous user's records. The query cache is not persisted.
- [ ] Create, edit, and delete call the Phase 5 routes and refresh the list through TanStack Query.
- [ ] Reload shows the edited records, including `Present` for a null end date.
- [ ] Forms use React Hook Form, shared Zod schemas, and shadcn/ui.
- [ ] Accomplishments and technologies are submitted as trimmed line arrays. Blank nullable fields are omitted on create and sent as `null` on edit.
- [ ] Invalid form input does not send the request. A profile `400` shows the API `error` string.
- [ ] The access token stays in memory and is sent only as `Authorization: Bearer`.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4 auth cases, and deletes its user.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] No migration is added. `packages/shared` and the profile API contract stay as Phase 5 defined them.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [ ] No Phase 7 or later work is included.
