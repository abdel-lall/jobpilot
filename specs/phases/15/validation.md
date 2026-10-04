# Phase 15 — Validation

Validation passed on 2026-10-04. The implementation review passed with no required code changes. Every command in this file was run after implementation, from the repository root, on branch `phase/15-interview-plan`. The review did not re-run that suite.

## Acceptance criteria

- PASS — A job with a current analysis gets one stored plan. Every category is one of the seven allowed strings, the categories are unique, and their order is the model order.
- PASS — The stored `interviewTopics` are the current analysis topics in the same order. The model result is categories only.
- PASS — Generating again updates that same row and leaves the job with one plan.
- PASS — A model result with an unknown category, a duplicate, an empty category list, or an extra key is rejected and leaves the previous plan unchanged.
- PASS — The workflow input is the stored analysis and the prompt built from it. Profile records, resume files, and the tailored resume are not part of that input. The workflow does not call MCP.
- PASS — A missing or stale analysis returns `409` and does not call the model.
- PASS — A description change clears the plan. A failed analysis keeps it. A title-only patch keeps it.
- PASS — Another user cannot generate or read the plan.
- PASS — The dashboard `job-interview-plan` text is `Present` or `Not available`. Score and readiness stay `Not available`.
- PASS — The user can open `Interview plan` on a job row, generate, reload into a new dashboard visit, and see the same categories and topics. Generating again updates the open panel in place.
- PASS — After the job description changes, the dashboard shows that no current plan exists until the user generates it again.
- PASS — The tailored-resume panel, analysis label, and resume flag still behave as Phases 10 and 14 defined them.
- PASS — No Phase 16 or later work is included.

## Required automated tests

- PASS — Vitest in `packages/ai/src/interview-plan.test.ts`, executed by root `pnpm test`: the stub categories are `Backend` then `Behavioral questions`; a reversed allowed pair keeps that order; topics are copied from the analysis; the prompt contains the analysis labels and values and excludes a profile sentinel; unknown, duplicate, empty, and extra-key model results reject. `GEMINI_API_KEY` is unset. No network call.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:interview-plan` against the Compose database: 8 tests passed. They cover generate, replace the same row, reject an unknown category without replacing the stored plan, cross-user `404`, missing and stale analysis `409` without a model call, clear on description change, keep on failed analysis, keep on title change, delete with the job, `400` for a keyed body, `401` for a missing or invalid token, and `502` with no row when `createApp()` has no model and both `GEMINI_API_KEY` and `INTERVIEW_PLAN_MODEL` are unset.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed. Create still leaves `interviewPlanPresent` false.
- PASS — `pnpm --filter @jobpilot/api test:tailored-resume`: 9 tests passed. Description change still clears a tailored resume, and a title-only patch still keeps it.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, and `MCP_SHARED_SECRET` unset: passed. API unit tests passed. The AI suite passed 15 tests, including the new interview-plan file. `*.integration.test.ts` stayed excluded.
- PASS — `pnpm typecheck` succeeded for shared, database, AI, web (including `tsconfig.e2e.json`), portfolio-mcp, and API. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 24 tests passed. Compose was running with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case covers generate, replace on the open panel, a reload into a new dashboard visit, clear after a description edit, generate again, a `502` before a plan exists, and a `502` after a plan exists. The Phase 4, Phase 6, Phase 7, Phase 9, and Phase 14 cases still passed, and `job-interview-plan` stays `Not available` in the jobs and tailored-resume cases. The new test deletes its `phase15-` users through Prisma.

Live Gemini was not called. GitHub Actions was not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate deploy` applied the new migration. `prisma migrate status` reports 9 migrations and the schema is up to date. The new directory is `20261004120000_interview_plan`. `InterviewPlan.jobId` is unique and the foreign key is `ON DELETE CASCADE`.
2. PASS — `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
3. PASS — `docker compose up --build -d` left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_PLAN_MODEL=stub`, stub job-analysis, embedding, and resume models, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. PASS — The jobs Playwright case still shows `job-interview-plan` as `Not available` before any plan is generated. The interview-plan case opens the panel, sees `No interview plan yet.`, and after generate sees `Backend`, `Behavioral questions`, `stub-topic-1`, and `stub-topic-2`.
5. PASS — A description edit in that case sets the row to `Not available` and the open panel to `No interview plan yet.` Generating again restores the stub plan and `Present`.
6. PASS — Logout still shows `signed-out` through the existing auth browser test and unmounts the signed-in shell. `JobsQueryCache` removes interview-plan queries when the session is `signed-out` and when the user id changes.
7. PASS — The Vite-served interview-plan modules returned `200` and contained none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands run

Commands ran from the repository root on 2026-10-04. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u MCP_SHARED_SECRET pnpm test` — passed. API unit tests passed. AI tests: 15 passed, including the interview-plan file. Integration tests were excluded.
- `docker compose up -d postgres` — Postgres was available for migrate and the database-backed tests.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — applied `20261004120000_interview_plan`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 9 migrations found. Database schema is up to date.
- `docker compose exec postgres psql -U postgres -c "\d \"InterviewPlan\""` — `jobId` is unique and the foreign key is `ON DELETE CASCADE`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase15-validation-secret pnpm --filter @jobpilot/api test:interview-plan` — 8 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase15-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed.
- `docker compose up --build -d` — built and left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_PLAN_MODEL=stub` and an empty `GEMINI_API_KEY`.
- `curl -sS -D - http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 24 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- Live Gemini was not called. Compose has `INTERVIEW_PLAN_MODEL=stub` and an empty `GEMINI_API_KEY`.
- No test asserts that interview-plan query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs and tailored-resume queries.
- The browser suite does not assert the loading line, an empty topic list rendering `None`, opening `Tailored resume` while the plan panel is open, or a title-only save in the open panel. The description-change refetch is covered in the browser. The API test keeps the plan and the tailored resume on a title-only patch.
- Duplicate categories, an empty category list, and extra keys are rejected in the workflow unit test. The API test that the previous row stays unchanged uses an unknown category, which fails on that same path before the write.

## Completion checklist

- [x] PASS — One `InterviewPlan` row per job, replaced in place, cleared when the description change stores a new analysis.
- [x] PASS — Categories are limited to the seven allowed strings, unique, and kept in model order.
- [x] PASS — Interview topics on the plan are copied from the current analysis.
- [x] PASS — The workflow reads the stored analysis only and does not call MCP.
- [x] PASS — `POST` and `GET /jobs/:id/interview-plan` match the status codes in `spec.md`.
- [x] PASS — The dashboard shows `Present` or `Not available` for the plan. Score and readiness stay `Not available`.
- [x] PASS — `Interview plan` opens one panel on that row and loads `GET /jobs/:id/interview-plan` only while the panel is open.
- [x] PASS — The empty state is `No interview plan yet.`
- [x] PASS — `Generate plan` posts `{}` and renders the stored categories and topics.
- [x] PASS — A description edit clears the flag and the open panel until the user generates again.
- [x] PASS — A failed generate shows the API error and keeps the previous panel body.
- [x] PASS — Signed-out removes cached interview-plan queries. The query key includes the user id and job id.
- [x] PASS — The plan is parsed with `interviewPlanSchema`. The web app does not call Gemini or MCP.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:interview-plan` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` and `test:tailored-resume` pass.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — The only new migration is `20261004120000_interview_plan`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [x] PASS — GitHub Actions does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 16 or later work is included.

## Result

PASS
