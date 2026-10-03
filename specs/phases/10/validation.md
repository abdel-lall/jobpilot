# Phase 10 — Validation

Validation passed on 2026-10-02. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — `POST /jobs` and `PATCH /jobs/:id` remain the create and description-update endpoints. No second job-analysis route is added.
- PASS — Creating a job stores one analysis row for that job. The response `analysis` matches the stub document, `keywords` is `["Build APIs."]`, and `status.analysisCurrent` is `true`.
- PASS — A description edit to `Build reliable APIs.` replaces that analysis. `keywords` becomes `["Build reliable APIs."]`, and the job still has one analysis row.
- PASS — A title-only edit, and an edit that repeats the current description, do not call the model. The stored analysis and `analyzedDescription` stay unchanged.
- PASS — A rejecting model on create returns `502` with `{ "error": "Job analysis failed" }` and leaves no job and no analysis row.
- PASS — A rejecting model on a description change returns that same `502`. The previous description, the other fields changed in that request, and the previous analysis stay as they were.
- PASS — `analysisCurrent` is `true` only when the stored `analyzedDescription` equals the current `jobDescription`. A job with no analysis row, and a job whose `analyzedDescription` differs, return `analysisCurrent: false`.
- PASS — The workflow input is the job description. The recorded prompt is the Phase 10 template plus that description. Profile text is not part of the input.
- PASS — The dashboard shows `Current` for analysis after create, reload, title edit, and description edit. Tailored resume, interview plan, score, and readiness stay `Not available`.
- PASS — The web app has no Gemini API key, no database URL, and no `JWT_SECRET`. Playwright against Compose uses `JOB_ANALYSIS_MODEL=stub` and does not call Gemini.
- PASS — Existing auth, profile, and resume tests still pass. `GET /health` still returns `200` and `{"status":"ok"}`.

## Required automated tests

- PASS — Vitest in `packages/ai`: 2 tests passed. The stubbed workflow returns `jobAnalysisSchema`, interview topics stay `stub-topic-1` then `stub-topic-2`, the prompt is exactly the template plus the description, and `Secret Employer` and `Secret Skill` are absent from that input. An invalid stub result rejects. `GEMINI_API_KEY` is unset. Checked again while writing this record as part of root `pnpm test`.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:jobs` against the Compose database: 14 tests passed. Create stores the stub analysis, description update replaces it, a non-description update does not call the model, a rejecting model rolls back create, and a rejecting model on description update leaves the previous description and analysis in place. The run unsets `GEMINI_API_KEY` and `JOB_ANALYSIS_MODEL` and injects the model through `createApp`.
- PASS — The same `test:jobs` run covers the legacy job with `analysis: null`, the derived `analysisCurrent: false` when `analyzedDescription` differs, delete removing the analysis row, and no model call for invalid input, a missing token, list, get, or another user's job.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`: 18 tests passed. The jobs case creates `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, sees analysis `Current` and the other four statuses `Not available`, reloads, edits the title to `Senior Engineer`, edits the description to `Build reliable APIs.`, and still sees `Current`. The Phase 4, Phase 6, and Phase 7 cases still pass.
- PASS — Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes`, 7 tests passed.
- PASS — Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile`, 41 tests passed.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth`, 11 tests passed.
- PASS — Root `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset: 4 tests passed, including the health route, the Argon2id unit test, and the job-analysis workflow unit test. Checked again while writing this record.

Live Gemini is not required for these tests. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

The browser checks below were exercised by the Playwright suite against Compose. Health, the migration table, the served-module scan, and the leftover-user query were checked again while writing this record. There was no separate interactive devtools session.

1. PASS — The Compose database has `20261002120000_job_analysis` applied. `prisma migrate status` reports the schema up to date. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
2. PASS — With `JOB_ANALYSIS_MODEL=stub` on the API container and `GEMINI_API_KEY` unset, Playwright registers, adds a profile skill, creates the sample job, and the dashboard shows analysis as `Current` and the other four statuses as `Not available`.
3. PASS — Reload, opening `Dashboard`, the title edit, and the description edit keep analysis `Current`. The description text becomes `Build reliable APIs.`.
4. UNVERIFIED on the dashboard — This database already had the job-analysis migration, so no pre-migration job was available to open in the browser. The jobs API test inserts a job with no analysis row and shows `analysis: null` and `analysisCurrent: false` until a description change succeeds.
5. PASS — The Vite-served modules for `main`, `App`, the API helper, session, the auth page, the jobs cache, dashboard, forms, and requests, and the profile cache, sections, requests, resumes, and forms have no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`. The running web container does not have those variables. The API container has `JOB_ANALYSIS_MODEL=stub`.
6. UNVERIFIED — The optional live Gemini check was not run. `JOB_ANALYSIS_MODEL` stayed `stub`, and `GEMINI_API_KEY` stayed unset.

## Commands run

Commands ran from the repository root on 2026-10-02. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma, the database-backed tests, and Playwright user cleanup. `GEMINI_API_KEY` stayed unset. Source files were saved before the API suites, the Compose rebuild, and Playwright. The review typechecked `@jobpilot/ai`, `@jobpilot/api`, `@jobpilot/shared`, and `@jobpilot/web`, and re-ran the AI and API unit tests. While writing this record, full `pnpm typecheck`, root `pnpm test`, health, migration status, the served-module scan, and the leftover-user query were checked again. Install, migrate deploy, the API suites, the Compose rebuild, and Playwright were not repeated.

- `pnpm install` — succeeded. The workspace was already up to date, and Prisma Client was generated.
- `pnpm typecheck` — succeeded for the whole monorepo, including `apps/web/tsconfig.e2e.json`. Checked again while writing this record. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test` — succeeded. 4 tests passed: API health and Argon2id, plus 2 workflow tests. Checked again while writing this record. Exit code 0.
- `docker compose up -d postgres` — Postgres was already running.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — applied `20261002120000_job_analysis`. While writing this record, `prisma migrate status` reported the schema up to date, and `_prisma_migrations` lists that migration.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:jobs` — succeeded. 14 tests passed.
- `docker compose up --build -d` with `JOB_ANALYSIS_MODEL=stub` and `GEMINI_API_KEY` unset — rebuilt and started the API and web images. Exit code 0. The running API still has `JOB_ANALYSIS_MODEL=stub`.
- `pnpm --filter @jobpilot/web exec playwright install chromium` — started during implementation. A separate install log was not retained. `test:e2e` then passed, so Chromium was available.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 18 tests passed.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`. Checked again while writing this record.
- Served-module scan of the Vite modules listed above — no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`.
- `docker compose exec -T postgres psql` leftover-user counts for `phase3-%`, `phase5-%`, `phase7-%`, `phase8-%`, and `phase9-%` — 0 rows. Checked while writing this record.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- The optional live Gemini check was not run.
- No job created before the migration was opened on the dashboard. The jobs API test covers a job inserted with no analysis row.
- The review did not re-run the API suites, the Compose rebuild, or Playwright. Those commands succeeded after the source files were saved.
- `pnpm install`, `prisma migrate deploy`, and the Playwright install were not repeated while writing this record. The migration is present, and `test:e2e` passed.
- There is no separate production web bundle. Compose runs the Vite dev server, and those served modules were scanned.
- The manual checks were not repeated in a separate interactive browser session. They passed in Playwright, plus the health request, the migration check, the served-module scan, and the leftover-user query.

## Completion checklist

- [x] PASS — `packages/ai` has one LangGraph job-analysis workflow. Its only input is the job description.
- [x] PASS — Create on `POST /jobs` stores the job and the analysis together. A model failure stores neither.
- [x] PASS — A description change on `PATCH /jobs/:id` replaces the analysis. A model failure leaves the previous description and analysis in place.
- [x] PASS — An edit that does not change the description does not call the model.
- [x] PASS — `analysisCurrent` is derived from `analyzedDescription` equaling the current description.
- [x] PASS — The dashboard shows `Current` or `Not available` for analysis, and leaves the other four statuses as `Not available`.
- [x] PASS — The seven arrays are returned on the existing job JSON and are not rendered as a new screen.
- [x] PASS — Jobs from before the migration are not backfilled.
- [x] PASS — Compose Playwright uses the stub model. The web app has no Gemini key.
- [x] PASS — `packages/ai` unit tests pass under root `pnpm test` with `GEMINI_API_KEY` unset.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — `.github/workflows/ci.yml` is unchanged.
- [x] PASS — No Phase 11 or later work is included.
