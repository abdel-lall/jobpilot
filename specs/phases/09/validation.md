# Phase 9 — Validation

Not started. Do not mark an item PASS until the command, test, or inspection has actually succeeded.

## Acceptance criteria

- [ ] A signed-in user sees the `/auth/me` email, `Log out`, and a switcher with `Profile` and `Dashboard`. The profile view is selected when the session becomes signed in, including after reload.
- [ ] The profile view still shows Skills, Education, Work experience, Projects, Certifications, and Resumes, with those first five headings unchanged. The dashboard is not mounted there, and `GET /jobs` does not run.
- [ ] `Dashboard` shows the heading `Dashboard`, the job list, and the add-job form. Profile sections are unmounted. Returning to `Profile` restores them.
- [ ] The switcher, profile sections, and dashboard are absent while authentication is `loading` or `signed-out`. Entering `signed-in` does not wait for `GET /jobs`.
- [ ] While the dashboard's first jobs request is pending, it shows `Loading jobs…` and does not show `No jobs yet.`. The empty state appears only after a successful empty list. A failed list shows the API `error` string, or `Request failed`, and does not show the empty state.
- [ ] The user can add one profile skill and, in the same session, create a job and see it on the dashboard.
- [ ] After reload, opening `Dashboard` shows that same job: company, title, and analysis, tailored resume, interview plan, score, and readiness each as `Not available`.
- [ ] Editing the job title updates the dashboard. Editing that job's URL to blank clears it, and `job-url` is not rendered after the refetch. Deleting the job returns `No jobs yet.`.
- [ ] The jobs query key is `["jobs", userId]`. Entering `signed-out` removes cached jobs queries. A user id change in the same document does not reuse the previous user's jobs. The query cache is not persisted.
- [ ] Forms use React Hook Form, the existing `createJobBodySchema` and `updateJobBodySchema` from `@jobpilot/shared`, and shadcn/ui. A blank Job URL is an empty string in the form. Create omits `jobUrl`. Edit sends `jobUrl: null`. The shared schema then validates that object, and its errors are mapped back into the form. A failed parse sends no request. The frontend does not copy the job schema or the URL rule.
- [ ] An empty company name, and a job URL that is not absolute `http` or `https`, are rejected in the form and do not send `POST /jobs`.
- [ ] A failed jobs request shows the API `error` string.
- [ ] Job requests go to `VITE_API_ORIGIN` with `Authorization: Bearer` and credentials. The access token stays in memory.
- [ ] The web app has no Gemini API key, no database URL, and no `JWT_SECRET`.
- [ ] The Phase 4, Phase 6, and Phase 7 browser tests still pass. The Phase 3 auth, Phase 5 profile, Phase 7 resume, and Phase 8 jobs Supertest suites still pass.
- [ ] No job analysis, AI workflow, MCP, embedding, tailored-resume, or interview behavior is added. No router and no new API route are added.

## Required automated tests

- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: register a unique `phase9-` user, log in, add a skill named `TypeScript`, open `Dashboard`, see `No jobs yet.`, create `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, see that row and five `Not available` statuses, reload, open `Dashboard` again, see the same job, edit the title to `Senior Engineer`, edit that job's URL to blank, see no `job-url` after the refetch, delete the job, and see `No jobs yet.`. The cleared-URL save sends `jobUrl: null`, not an empty string. The test deletes its user through Prisma.
- [ ] The same `test:e2e` run holds the first `GET /jobs` after `Dashboard` opens. The dashboard shows `Loading jobs…` and does not show `No jobs yet.` until the response is an empty array.
- [ ] The same `test:e2e` run stubs `GET /jobs` to `400` with `{ "error": "Invalid input" }` and shows that string, not `No jobs yet.`. An empty company name produces a form message and no `POST /jobs`. `Job URL` `not-a-url` produces a form message and no `POST /jobs`. A `POST /jobs` stubbed to `400` with `{ "error": "Invalid input" }` shows that string.
- [ ] The same `test:e2e` run, in one document and without a reload, creates a job as user A, logs out, and logs in as user B. User B opens `Dashboard` and does not see user A's company. User B's empty state appears only after user B's jobs list resolves empty.
- [ ] The same `test:e2e` command still passes the Phase 4 auth cases, the Phase 6 profile cases, and the Phase 7 resume case.
- [ ] Supertest from Phase 8 still passes: `pnpm --filter @jobpilot/api test:jobs` against the Compose database.
- [ ] Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes` against the Compose database.
- [ ] Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database.
- [ ] Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database.
- [ ] Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset, including the health route and the Argon2id unit test.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. Start Compose and confirm `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. Open `http://localhost:5173`, register, and log in. Confirm the profile view appears with the email and logout, and that the first headings are still the profile sections. Confirm `Dashboard` is not showing `No jobs yet.` before it is opened.
3. Add a skill, open `Dashboard`, and confirm the empty state appears only after the jobs list succeeds. Create the sample job and confirm company, title, and five `Not available` statuses.
4. Reload, open `Dashboard` again, and confirm the job is still there. Edit the title, confirm the dashboard updates, clear the job URL, confirm `job-url` is gone after the refetch, then delete the job and confirm `No jobs yet.`.
5. Log out and confirm the switcher and dashboard are gone. In the same document, the next user does not see the previous user's job.
6. Confirm the served web modules have no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. Confirm Playwright deletes its `phase9-` users. Delete any manual user afterward.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma, the database-backed tests, and Playwright user cleanup. Leave `GEMINI_API_KEY` unset.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `docker compose up --build -d`
- `pnpm --filter @jobpilot/web exec playwright install chromium`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`
- `curl -sS http://localhost:3000/health`

Do not add these tests to GitHub Actions. Do not add a migration.

## Completion checklist

- [ ] The signed-in page shows the account email, logout, and the Profile / Dashboard switcher.
- [ ] Profile stays the default view. Its headings and resume section stay as Phases 6 and 7 left them.
- [ ] Dashboard lists company, title, location, description, URL when present, and the five status values as `Not available`.
- [ ] Loading jobs is shown before the first list succeeds. The empty state is only `No jobs yet.` after an empty success.
- [ ] Create, edit, and delete call the Phase 8 job routes and refresh the list through TanStack Query.
- [ ] Reload returns to the profile view. Opening Dashboard again shows the stored job.
- [ ] Signed-out removes cached jobs queries. Query keys include the user id, so another user in the same document does not see the previous user's job.
- [ ] Forms use React Hook Form, shared Zod schemas, and shadcn/ui.
- [ ] A blank Job URL stays an empty string in the form. Create omits `jobUrl`. Edit sends `jobUrl: null`. The existing shared schema validates that object, and its errors map back into the form. A failed parse sends no request. Playwright clears an existing URL and the row no longer renders `job-url` after the refetch.
- [ ] Invalid form input does not send the request. A jobs `400` shows the API `error` string.
- [ ] The access token stays in memory and is sent only as `Authorization: Bearer`.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4, Phase 6, and Phase 7 cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] No migration is added. The jobs API contract and `packages/shared` stay as Phase 8 defined them.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [ ] No Phase 10 or later work is included.
