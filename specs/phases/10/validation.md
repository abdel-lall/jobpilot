# Phase 10 — Validation

Not started. Do not mark an item PASS until the command, test, or inspection has actually succeeded.

## Acceptance criteria

- [ ] `POST /jobs` and `PATCH /jobs/:id` remain the create and description-update endpoints. No second job-analysis route is added.
- [ ] Creating a job stores one analysis row for that job. The response `analysis` matches the stub document, `keywords` is `["Build APIs."]`, and `status.analysisCurrent` is `true`.
- [ ] A description edit to `Build reliable APIs.` replaces that analysis. `keywords` becomes `["Build reliable APIs."]`, and the job still has one analysis row.
- [ ] A title-only edit, and an edit that repeats the current description, do not call the model. The stored analysis and `analyzedDescription` stay unchanged.
- [ ] A rejecting model on create returns `502` with `{ "error": "Job analysis failed" }` and leaves no job and no analysis row.
- [ ] A rejecting model on a description change returns that same `502`. The previous description, the other fields changed in that request, and the previous analysis stay as they were.
- [ ] `analysisCurrent` is `true` only when the stored `analyzedDescription` equals the current `jobDescription`. A job with no analysis row, and a job whose `analyzedDescription` differs, return `analysisCurrent: false`.
- [ ] The workflow input is the job description. The recorded prompt is the Phase 10 template plus that description. Profile text is not part of the input.
- [ ] The dashboard shows `Current` for analysis after create, reload, title edit, and description edit. Tailored resume, interview plan, score, and readiness stay `Not available`.
- [ ] The web app has no Gemini API key, no database URL, and no `JWT_SECRET`. Playwright against Compose uses `JOB_ANALYSIS_MODEL=stub` and does not call Gemini.
- [ ] Existing auth, profile, and resume tests still pass. `GET /health` still returns `200` and `{"status":"ok"}`.

## Required automated tests

- [ ] Vitest in `packages/ai`: the stubbed workflow returns `jobAnalysisSchema`, interview topics stay `stub-topic-1` then `stub-topic-2`, the prompt is exactly the template plus the description, and `Secret Employer` and `Secret Skill` are absent from that input. An invalid stub result rejects. `GEMINI_API_KEY` is unset.
- [ ] Supertest, executed by `pnpm --filter @jobpilot/api test:jobs` against the Compose database: create stores the stub analysis, description update replaces it, a non-description update does not call the model, a rejecting model rolls back create, and a rejecting model on description update leaves the previous description and analysis in place. The run unsets `GEMINI_API_KEY` and `JOB_ANALYSIS_MODEL` and injects the model through `createApp`.
- [ ] The same `test:jobs` run covers the legacy job with `analysis: null`, the derived `analysisCurrent: false` when `analyzedDescription` differs, delete removing the analysis row, and no model call for invalid input, a missing token, list, get, or another user's job.
- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`: the Phase 9 jobs case creates `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, sees analysis `Current` and the other four statuses `Not available`, reloads, edits the title to `Senior Engineer`, edits the description to `Build reliable APIs.`, and still sees `Current`. The Phase 4, Phase 6, and Phase 7 cases still pass.
- [ ] Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes`.
- [ ] Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile`.
- [ ] Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth`.
- [ ] Root `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset, including the health route, the Argon2id unit test, and the job-analysis workflow unit test.

Live Gemini is not required for these tests. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. Apply the migration to the Compose database. Confirm `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. With `JOB_ANALYSIS_MODEL=stub` and `GEMINI_API_KEY` unset, register, add a profile skill, create the sample job, and confirm the dashboard shows analysis as `Current` and the other four statuses as `Not available`.
3. Reload, open `Dashboard`, edit the title, then edit the description. Confirm analysis stays `Current` and the description text updates.
4. Confirm a job created before the migration, if one is still present, shows `Not available` for analysis until its description is changed.
5. Confirm the served web modules have no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`.
6. Optional live check: set `JOB_ANALYSIS_MODEL=gemini` and a real `GEMINI_API_KEY`, create one job, and confirm a non-stub analysis is stored. Record this as unverified if it is not run. Automated PASS does not depend on it.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma, the database-backed tests, and Playwright user cleanup. Leave `GEMINI_API_KEY` unset except for the optional live check.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase10-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `docker compose up --build -d` with `JOB_ANALYSIS_MODEL=stub` and `GEMINI_API_KEY` unset
- `pnpm --filter @jobpilot/web exec playwright install chromium`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`
- `curl -sS http://localhost:3000/health`

Do not add these tests to GitHub Actions. The new migration is applied only to the local Compose database.

## Completion checklist

- [ ] `packages/ai` has one LangGraph job-analysis workflow. Its only input is the job description.
- [ ] Create on `POST /jobs` stores the job and the analysis together. A model failure stores neither.
- [ ] A description change on `PATCH /jobs/:id` replaces the analysis. A model failure leaves the previous description and analysis in place.
- [ ] An edit that does not change the description does not call the model.
- [ ] `analysisCurrent` is derived from `analyzedDescription` equaling the current description.
- [ ] The dashboard shows `Current` or `Not available` for analysis, and leaves the other four statuses as `Not available`.
- [ ] The seven arrays are returned on the existing job JSON and are not rendered as a new screen.
- [ ] Jobs from before the migration are not backfilled.
- [ ] Compose Playwright uses the stub model. The web app has no Gemini key.
- [ ] `packages/ai` unit tests pass under root `pnpm test` with `GEMINI_API_KEY` unset.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] `.github/workflows/ci.yml` is unchanged.
- [ ] No Phase 11 or later work is included.
