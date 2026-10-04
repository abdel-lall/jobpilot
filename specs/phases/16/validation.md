# Phase 16 — Validation

Validation passed on 2026-10-04. The implementation review passed with no required code changes. The command list below was run after implementation, from the repository root, on branch `phase/16-interview-questions`. During close-out, root `pnpm test`, `prisma migrate deploy`, `prisma migrate status`, the `psql` table checks, `test:interview-attempt`, `GET /health`, the API model environment, and the Vite module secret check were run again and passed. The review did not re-run that suite.

## Acceptance criteria

- PASS — Starting an attempt on a job with a current analysis and a current plan stores exactly one in-progress attempt and exactly 8 questions.
- PASS — A plan with categories A, B, and C in that order stores 3, 3, and 2 questions. Those counts come from `interviewQuestionCounts` before the model is called.
- PASS — A one-category plan stores 8 questions in that category. A two-category plan stores 4 and 4.
- PASS — The model is asked for a specific category and the remaining count. A model item labeled with a different category is stored under the TypeScript assignment.
- PASS — A question whose normalized text already exists for that user and job is not stored. Normalization trims, collapses internal whitespace, and compares case-insensitively.
- PASS — A model that only returns known texts is called for 3 rounds. The request then fails and leaves the attempt and question tables unchanged.
- PASS — A model that returns enough unique questions on the first round does not start a second round. A shortfall asks a later round only for the questions still missing.
- PASS — A second start while the first attempt is in progress is rejected with `409` and does not add a row.
- PASS — The job JSON keeps `latestOverallScore` and `readinessBadge` null. The dashboard score and readiness stay `Not available`.
- PASS — The workflow input is the plan, the stored question texts, and the prompt built from them. Profile records are not part of that input. The workflow does not call MCP.
- PASS — A missing or stale analysis, and a missing plan, return `409` and do not call the model.
- PASS — A description change clears the plan and keeps the attempt. A title-only patch and a plan replace also keep the attempt. Job delete removes the attempt and its questions.
- PASS — Another user cannot start or read the attempt.
- PASS — The attempt panel lists the 8 questions and has no answer control. Answer, feedback, and score stay null.
- PASS — No Phase 17 or later work is included.

## Required automated tests

- PASS — Vitest in `packages/ai/src/interview-questions.test.ts`, executed by root `pnpm test`: 7 tests passed. They cover counts for three categories, one category, and two categories with no model; model calls carry the assigned category and count; a conflicting category is ignored; normalized-text rejection; stop after 3 rounds when every text is already known; no second round when the first round already has 8 unique questions; a shortfall requests only the missing count. The prompt contains the plan and excludes a profile sentinel. `GEMINI_API_KEY` is unset. No network call.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database: 8 tests passed. They cover start, distribution 3/3/2, category override, `GET`, null score and badge, second-start `409`, 3-round failure with no new rows, cross-user `404`, missing and stale analysis `409` without a model call, missing plan `409` without a model call, description change keeps the attempt, title-only patch keeps it, plan replace keeps it, job delete removes it, `400` for a keyed body, `401` for a missing or invalid token, and `502` with no row when `createApp()` has no model and both `GEMINI_API_KEY` and `INTERVIEW_QUESTION_MODEL` are unset.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:tailored-resume`: 9 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:interview-plan`: 8 tests passed.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, and `MCP_SHARED_SECRET` unset: passed. API unit tests passed (2 tests). The AI suite passed 22 tests, including the new interview-questions file. `*.integration.test.ts` stayed excluded.
- PASS — `pnpm typecheck` succeeded for shared, database, AI, web (including `tsconfig.e2e.json`), portfolio-mcp, and API. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 26 tests passed. Compose was running with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case covers generate plan, start attempt, 8 questions with the stub texts and categories, no answer control, score and readiness `Not available`, and a `502` before an attempt exists. The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, and Phase 15 cases still passed. The new test deletes its `phase16-` users through Prisma.

Live Gemini was not called. GitHub Actions was not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate deploy` reports no pending migrations. `prisma migrate status` reports 10 migrations and the schema is up to date. The new directory is `20261004180000_interview_attempt`. `InterviewAttempt.jobId` cascades on job delete. The partial unique index `InterviewAttempt_one_in_progress_per_job` exists. `InterviewQuestion` cascades from both the attempt and the job, and `(jobId, normalizedText)` is unique.
2. PASS — `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
3. PASS — `docker compose up --build -d` left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_QUESTION_MODEL=stub`, the existing stub model selectors, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. PASS — The jobs Playwright case still shows `job-score` and `job-readiness` as `Not available` before any attempt is started.
5. PASS — The interview-attempt case opens the panel, sees `No interview attempt yet.`, and after start sees 8 questions: four `Backend`, then four `Behavioral questions`, with the stub texts, `stub-concept`, and `stub-rubric`. Score and readiness stay `Not available`.
6. PASS — Logout still shows `signed-out` through the existing auth browser test and unmounts the signed-in shell. `JobsQueryCache` removes interview-attempt queries when the session is `signed-out` and when the user id changes.
7. PASS — The Vite-served attempt modules returned `200` and contained none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_QUESTION_MODEL`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands run

Commands ran from the repository root on 2026-10-04. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u MCP_SHARED_SECRET pnpm test` — passed. API unit tests: 2 passed. AI tests: 22 passed, including the interview-questions file. Integration tests were excluded.
- `docker compose up -d postgres` — Postgres was available for migrate and the database-backed tests.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — 10 migrations found. No pending migrations to apply.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 10 migrations found. Database schema is up to date.
- `docker compose exec postgres psql -U postgres -c "\d \"InterviewAttempt\""` — `jobId` cascades on delete. Partial unique index `InterviewAttempt_one_in_progress_per_job` is present.
- `docker compose exec postgres psql -U postgres -c "\d \"InterviewQuestion\""` — cascades from the attempt and the job. `(attemptId, position)` and `(jobId, normalizedText)` are unique.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:interview-plan` — 8 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:interview-attempt` — 8 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase16-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed.
- `docker compose up --build -d` — built and left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_QUESTION_MODEL=stub` and an empty `GEMINI_API_KEY`.
- `curl -sS -D - http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 26 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- Live Gemini was not called. Compose has `INTERVIEW_QUESTION_MODEL=stub` and an empty `GEMINI_API_KEY`.
- No test asserts that interview-attempt query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs, tailored-resume, and interview-plan queries.
- The browser suite does not assert Close, opening `Tailored resume` or `Interview plan` while the attempt panel is open, or a description save that keeps the open questions on screen. The API test keeps the attempt on a description change, a title-only patch, and a plan replace.
- The Supertest duplicate case does not pre-insert a stored question. Any stored question belongs to an `in_progress` attempt, and that attempt returns `409` before the model runs. The workflow test covers a pre-supplied `Hello World` with three count-8 calls and a rejection.
- No API test sends a plan document that fails `interviewPlanSchema`. A missing plan returns `409` without a model call. No test starts two requests at once against the partial unique index. The second start after the first attempt is stored returns `409`.

## Completion checklist

- [x] PASS — One in-progress attempt per job, inserted only together with exactly 8 questions.
- [x] PASS — Category counts are computed in TypeScript before the model call. Extras go to earlier categories.
- [x] PASS — The stored category is the TypeScript assignment.
- [x] PASS — Normalized duplicates are discarded. Three unsuccessful rounds store nothing.
- [x] PASS — The workflow reads the stored plan and stored question texts only, and it does not call MCP.
- [x] PASS — `POST /jobs/:id/interview-attempts` and `GET /jobs/:id/interview-attempts/current` match the status codes in `spec.md`.
- [x] PASS — Dashboard score and readiness stay `Not available`.
- [x] PASS — `Interview attempt` opens one panel on that row and loads the current attempt only while the panel is open.
- [x] PASS — The empty state is `No interview attempt yet.`
- [x] PASS — `Start attempt` posts `{}` and renders the 8 questions. The panel has no answer control.
- [x] PASS — A failed start shows the API error and does not render questions.
- [x] PASS — A description change keeps the attempt. Job delete removes it.
- [x] PASS — Signed-out removes cached interview-attempt queries. The query key includes the user id and job id.
- [x] PASS — The attempt is parsed with `interviewAttemptSchema`. The web app does not call Gemini or MCP.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — The only new migration is `20261004180000_interview_attempt`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_QUESTION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [x] PASS — GitHub Actions does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 17 or later work is included.

## Result

PASS
