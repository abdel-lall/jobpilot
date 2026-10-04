# Phase 15 — Validation

## Acceptance criteria

- [ ] A job with a current analysis gets one stored plan. Every category is one of the seven allowed strings, the categories are unique, and their order is the model order.
- [ ] The stored `interviewTopics` are the current analysis topics in the same order. The model result is categories only.
- [ ] Generating again updates that same row and leaves the job with one plan.
- [ ] A model result with an unknown category, a duplicate, an empty category list, or an extra key is rejected and leaves the previous plan unchanged.
- [ ] The workflow input is the stored analysis and the prompt built from it. Profile records, resume files, and the tailored resume are not part of that input. The workflow does not call MCP.
- [ ] A missing or stale analysis returns `409` and does not call the model.
- [ ] A description change clears the plan. A failed analysis keeps it. A title-only patch keeps it.
- [ ] Another user cannot generate or read the plan.
- [ ] The dashboard `job-interview-plan` text is `Present` or `Not available`. Score and readiness stay `Not available`.
- [ ] The user can open `Interview plan` on a job row, generate, reload into a new dashboard visit, and see the same categories and topics. Generating again updates the open panel in place.
- [ ] After the job description changes, the dashboard shows that no current plan exists until the user generates it again.
- [ ] The tailored-resume panel, analysis label, and resume flag still behave as Phases 10 and 14 defined them.
- [ ] No Phase 16 or later work is included.

## Required automated tests

- [ ] Vitest in `packages/ai/src/interview-plan.test.ts`, executed by root `pnpm test`: the stub categories are `Backend` then `Behavioral questions`; a reversed allowed pair keeps that order; topics are copied from the analysis; the prompt contains the analysis labels and values and excludes a profile sentinel; unknown, duplicate, empty, and extra-key model results reject. `GEMINI_API_KEY` is unset. No network call.
- [ ] Supertest, executed by `pnpm --filter @jobpilot/api test:interview-plan` against the Compose database: generate, replace the same row, reject an unknown category without replacing the stored plan, cross-user `404`, missing and stale analysis `409` without a model call, clear on description change, keep on failed analysis, keep on title change, delete with the job, `400` for a keyed body, `401` for a missing or invalid token, and `502` with no row when `createApp()` has no model and both `GEMINI_API_KEY` and `INTERVIEW_PLAN_MODEL` are unset.
- [ ] `pnpm --filter @jobpilot/api test:auth`
- [ ] `pnpm --filter @jobpilot/api test:profile`
- [ ] `pnpm --filter @jobpilot/api test:resumes`
- [ ] `pnpm --filter @jobpilot/api test:jobs` — create still leaves `interviewPlanPresent` false.
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume` — description change still clears a tailored resume, and a title-only patch still keeps it.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test`
- [ ] Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, and `MCP_SHARED_SECRET` unset. This includes the new AI file and excludes `*.integration.test.ts`.
- [ ] `pnpm typecheck`
- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case covers generate, replace on the open panel, clear after a description edit, generate again, a `502` before a plan exists, and a `502` after a plan exists. The Phase 4, Phase 6, Phase 7, Phase 9, and Phase 14 cases still pass, and `job-interview-plan` stays `Not available` in the jobs and tailored-resume cases. The new test deletes its `phase15-` users through Prisma.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate status` reports 9 migrations and the schema is up to date. The new directory is `20261004120000_interview_plan`. The earlier eight migration directories are unchanged. `InterviewPlan.jobId` is unique and the foreign key is `ON DELETE CASCADE`.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` leaves `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_PLAN_MODEL=stub` and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. The jobs Playwright case still shows `job-interview-plan` as `Not available` before any plan is generated. The interview-plan case opens the panel, sees `No interview plan yet.`, and after generate sees `Backend`, `Behavioral questions`, `stub-topic-1`, and `stub-topic-2`.
5. A description edit in that case sets the row to `Not available` and the open panel to `No interview plan yet.` Generating again restores the stub plan and `Present`.
6. Logout still shows `signed-out` and unmounts the signed-in shell. `JobsQueryCache` removes interview-plan queries when the session is `signed-out` and when the user id changes.
7. The Vite-served interview-plan modules contain none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands

Run these from the repository root after implementation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u MCP_SHARED_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `docker compose exec postgres psql -U postgres -c "\d \"InterviewPlan\""`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:tailored-resume`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:interview-plan`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase15-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `curl -sS -D - http://localhost:3000/health`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`

## Completion checklist

- [ ] One `InterviewPlan` row per job, replaced in place, cleared when the description change stores a new analysis.
- [ ] Categories are limited to the seven allowed strings, unique, and kept in model order.
- [ ] Interview topics on the plan are copied from the current analysis.
- [ ] The workflow reads the stored analysis only and does not call MCP.
- [ ] `POST` and `GET /jobs/:id/interview-plan` match the status codes in `spec.md`.
- [ ] The dashboard shows `Present` or `Not available` for the plan. Score and readiness stay `Not available`.
- [ ] `Interview plan` opens one panel on that row and loads `GET /jobs/:id/interview-plan` only while the panel is open.
- [ ] The empty state is `No interview plan yet.`
- [ ] `Generate plan` posts `{}` and renders the stored categories and topics.
- [ ] A description edit clears the flag and the open panel until the user generates again.
- [ ] A failed generate shows the API error and keeps the previous panel body.
- [ ] Signed-out removes cached interview-plan queries. The query key includes the user id and job id.
- [ ] The plan is parsed with `interviewPlanSchema`. The web app does not call Gemini or MCP.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:interview-plan` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs` and `test:tailored-resume` pass.
- [ ] `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] The only new migration is `20261004120000_interview_plan`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [ ] GitHub Actions does not run Playwright or start PostgreSQL.
- [ ] No Phase 16 or later work is included.

## Result

Not started.
