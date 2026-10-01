# Phase 9 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — A signed-in user sees the `/auth/me` email, `Log out`, and a switcher with `Profile` and `Dashboard`. The profile view is selected when the session becomes signed in, including after reload.
- PASS — The profile view still shows Skills, Education, Work experience, Projects, Certifications, and Resumes, with those first five headings unchanged. The dashboard is not mounted there, and `GET /jobs` does not run.
- PASS — `Dashboard` shows the heading `Dashboard`, the job list, and the add-job form. Profile sections are unmounted. Returning to `Profile` restores them.
- PASS — The switcher, profile sections, and dashboard are absent while authentication is `loading` or `signed-out`. Entering `signed-in` does not wait for `GET /jobs`.
- PASS — While the dashboard's first jobs request is pending, it shows `Loading jobs…` and does not show `No jobs yet.`. The empty state appears only after a successful empty list. A failed list shows the API `error` string, or `Request failed`, and does not show the empty state.
- PASS — The user can add one profile skill and, in the same session, create a job and see it on the dashboard.
- PASS — After reload, opening `Dashboard` shows that same job: company, title, and analysis, tailored resume, interview plan, score, and readiness each as `Not available`.
- PASS — Editing the job title updates the dashboard. Editing that job's URL to blank clears it, and `job-url` is not rendered after the refetch. Deleting the job returns `No jobs yet.`.
- PASS — The jobs query key is `["jobs", userId]`. Entering `signed-out` removes cached jobs queries. A user id change in the same document does not reuse the previous user's jobs. The query cache is not persisted.
- PASS — Forms use React Hook Form, the existing `createJobBodySchema` and `updateJobBodySchema` from `@jobpilot/shared`, and shadcn/ui. A blank Job URL is an empty string in the form. Create omits `jobUrl`. Edit sends `jobUrl: null`. The shared schema then validates that object, and its errors are mapped back into the form. A failed parse sends no request. The frontend does not copy the job schema or the URL rule.
- PASS — An empty company name, and a job URL that is not absolute `http` or `https`, are rejected in the form and do not send `POST /jobs`.
- PASS — A failed jobs request shows the API `error` string.
- PASS — Job requests go to `VITE_API_ORIGIN` with `Authorization: Bearer` and credentials. The access token stays in memory.
- PASS — The web app has no Gemini API key, no database URL, and no `JWT_SECRET`. Playwright reads `DATABASE_URL` in Node to delete its users.
- PASS — The Phase 4, Phase 6, and Phase 7 browser tests still pass. The Phase 3 auth, Phase 5 profile, Phase 7 resume, and Phase 8 jobs Supertest suites still pass.
- PASS — No job analysis, AI workflow, MCP, embedding, tailored-resume, or interview behavior is added. No router and no new API route are added.

## Required automated tests

- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 18 tests passed. The jobs case registers a unique `phase9-` user, logs in, adds a skill named `TypeScript`, opens `Dashboard`, sees `No jobs yet.`, creates `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, sees that row and five `Not available` statuses, reloads, opens `Dashboard` again, sees the same job, edits the title to `Senior Engineer`, edits that job's URL to blank, sees no `job-url` after the refetch, deletes the job, and sees `No jobs yet.`. The cleared-URL save sends `jobUrl: null`. The test deletes its users through Prisma.
- PASS — The same `test:e2e` run holds the first `GET /jobs` after `Dashboard` opens. The dashboard shows `Loading jobs…` and does not show `No jobs yet.` until the response is an empty array.
- PASS — The same `test:e2e` run stubs `GET /jobs` to `400` with `{ "error": "Invalid input" }` and shows that string, not `No jobs yet.`. An empty company name produces a form message and no `POST /jobs`. `Job URL` `not-a-url` produces a form message and no `POST /jobs`. A `POST /jobs` stubbed to `400` with `{ "error": "Invalid input" }` shows that string.
- PASS — The same `test:e2e` run, in one document and without a reload, creates a job as user A, logs out, and logs in as user B. User B opens `Dashboard` and does not see user A's company. User B's empty state appears only after user B's jobs list resolves empty.
- PASS — The same `test:e2e` command still passes the Phase 4 auth cases, the Phase 6 profile cases, and the Phase 7 resume case.
- PASS — Supertest from Phase 8 still passes: `pnpm --filter @jobpilot/api test:jobs` against the Compose database, 8 tests passed.
- PASS — Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes` against the Compose database, 7 tests passed.
- PASS — Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database, 41 tests passed.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset: 2 tests passed, including the health route and the Argon2id unit test.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

The browser checks below were exercised by the Playwright suite against Compose. Health, the served-module scan, and the leftover-user query were checked again while writing this record. There was no separate interactive devtools session.

1. PASS — Compose was up. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
2. PASS — After login, the profile view shows the email and logout, and the first headings are still the profile sections. `Dashboard` is not showing `No jobs yet.` before it is opened, and `GET /jobs` has not run.
3. PASS — A skill is added, `Dashboard` is opened, and the empty state appears only after the jobs list succeeds. The sample job shows company, title, and five `Not available` statuses.
4. PASS — Reload returns to the profile view. Opening `Dashboard` again shows the job. Editing the title updates the dashboard, clearing the job URL removes `job-url` after the refetch, and delete shows `No jobs yet.`.
5. PASS — Log out removes the switcher and dashboard. In the same document, the next user does not see the previous user's job.
6. PASS — The Vite-served modules for `main`, `App`, the API helper, session, the auth page, the jobs cache, dashboard, forms, and requests, and the profile cache, sections, requests, resumes, and forms have no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`. The Playwright specs read `DATABASE_URL` on the host to delete their users.
7. PASS — Playwright deletes its `phase9-` users. A follow-up query found no `phase9-%` rows. No separate manual users were created.

## Commands run

Commands ran from the repository root on 2026-10-01. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for the database-backed tests and Playwright user cleanup. `GEMINI_API_KEY` stayed unset. Source files were saved before the API suites, the Compose rebuild, and Playwright. The review typechecked `@jobpilot/web` only. While writing this record, full `pnpm typecheck`, `pnpm test`, health, the served-module scan, and the leftover-user query were checked again. Install, migrate, the API suites, the Compose rebuild, Playwright install, and Playwright were not repeated.

- `pnpm typecheck` — succeeded for the whole monorepo, including `apps/web/tsconfig.e2e.json`. Checked again while writing this record. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test` — succeeded. 2 tests passed. Checked again while writing this record. Exit code 0.
- `docker compose up -d postgres` — Postgres was already running.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase9-validation-secret pnpm --filter @jobpilot/api test:jobs` — succeeded. 8 tests passed.
- `docker compose up --build -d` — rebuilt and started the API and web images. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 18 tests passed.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`. Checked again while writing this record.
- `curl` of the Vite-served modules listed above — no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- `docker compose exec -T postgres psql -U postgres -c "SELECT count(*) AS leftover_phase9_users FROM \"User\" WHERE email LIKE 'phase9-%';"` — 0 rows. Checked while writing this record.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- `pnpm install`, `prisma migrate deploy`, and `playwright install chromium` were not repeated. No dependency, lockfile, or migration changed. Playwright already had Chromium, and `test:e2e` passed.
- The review did not re-run the API suites, the Compose rebuild, or Playwright. Those commands succeeded after the source files were saved.
- There is no separate production web bundle. Compose runs the Vite dev server, and those served modules were scanned.
- Playwright does not submit a blank Job URL on create, click `Cancel`, or stub a list body that fails `jobSchema`. Those paths are implemented. The cleared-URL edit asserts `jobUrl: null`.
- The browser test does not read the query key. `jobsQueryKey` is `["jobs", userId]`, and the user-switch test shows user B does not see user A's company.
- The manual checks were not repeated in a separate interactive browser session. They passed in Playwright, plus the health request, the served-module scan, and the leftover-user query.

## Completion checklist

- [x] PASS — The signed-in page shows the account email, logout, and the Profile / Dashboard switcher.
- [x] PASS — Profile stays the default view. Its headings and resume section stay as Phases 6 and 7 left them.
- [x] PASS — Dashboard lists company, title, location, description, URL when present, and the five status values as `Not available`.
- [x] PASS — Loading jobs is shown before the first list succeeds. The empty state is only `No jobs yet.` after an empty success.
- [x] PASS — Create, edit, and delete call the Phase 8 job routes and refresh the list through TanStack Query.
- [x] PASS — Reload returns to the profile view. Opening Dashboard again shows the stored job.
- [x] PASS — Signed-out removes cached jobs queries. Query keys include the user id, so another user in the same document does not see the previous user's job.
- [x] PASS — Forms use React Hook Form, shared Zod schemas, and shadcn/ui.
- [x] PASS — A blank Job URL stays an empty string in the form. Create omits `jobUrl`. Edit sends `jobUrl: null`. The existing shared schema validates that object, and its errors map back into the form. A failed parse sends no request. Playwright clears an existing URL and the row no longer renders `job-url` after the refetch.
- [x] PASS — Invalid form input does not send the request. A jobs `400` shows the API `error` string.
- [x] PASS — The access token stays in memory and is sent only as `Authorization: Bearer`.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4, Phase 6, and Phase 7 cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — No migration is added. The jobs API contract and `packages/shared` stay as Phase 8 defined them.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [x] PASS — GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 10 or later work is included.
