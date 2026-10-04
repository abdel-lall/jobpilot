# Phase 16 — Validation

## Acceptance criteria

- [ ] Starting an attempt on a job with a current analysis and a current plan stores exactly one in-progress attempt and exactly 8 questions.
- [ ] A plan with categories A, B, and C in that order stores 3, 3, and 2 questions. Those counts come from `interviewQuestionCounts` before the model is called.
- [ ] A one-category plan stores 8 questions in that category. A two-category plan stores 4 and 4.
- [ ] The model is asked for a specific category and the remaining count. A model item labeled with a different category is stored under the TypeScript assignment.
- [ ] A question whose normalized text already exists for that user and job is not stored. Normalization trims, collapses internal whitespace, and compares case-insensitively.
- [ ] A model that only returns known texts is called for 3 rounds. The request then fails and leaves the attempt and question tables unchanged.
- [ ] A model that returns enough unique questions on the first round does not start a second round. A shortfall asks a later round only for the questions still missing.
- [ ] A second start while the first attempt is in progress is rejected with `409` and does not add a row.
- [ ] The job JSON keeps `latestOverallScore` and `readinessBadge` null. The dashboard score and readiness stay `Not available`.
- [ ] The workflow input is the plan, the stored question texts, and the prompt built from them. Profile records are not part of that input. The workflow does not call MCP.
- [ ] A missing or stale analysis, and a missing plan, return `409` and do not call the model.
- [ ] A description change clears the plan and keeps the attempt. A title-only patch and a plan replace also keep the attempt. Job delete removes the attempt and its questions.
- [ ] Another user cannot start or read the attempt.
- [ ] The attempt panel lists the 8 questions and has no answer control. Answer, feedback, and score stay null.
- [ ] No Phase 17 or later work is included.

## Required automated tests

- [ ] Vitest in `packages/ai/src/interview-questions.test.ts`, executed by root `pnpm test`: counts for three categories, one category, and two categories with no model; model calls carry the assigned category and count; a conflicting category is ignored; normalized-text rejection; stop after 3 rounds when every text is already known; no second round when the first round already has 8 unique questions; a shortfall requests only the missing count. The prompt contains the plan and excludes a profile sentinel. `GEMINI_API_KEY` is unset. No network call.
- [ ] Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database: start, distribution 3/3/2, category override, `GET`, null score and badge, second-start `409`, 3-round failure with no new rows, cross-user `404`, missing and stale analysis `409` without a model call, missing plan `409` without a model call, description change keeps the attempt, title-only patch keeps it, plan replace keeps it, job delete removes it, `400` for a keyed body, `401` for a missing or invalid token, and `502` with no row when `createApp()` has no model and both `GEMINI_API_KEY` and `INTERVIEW_QUESTION_MODEL` are unset.
- [ ] `pnpm --filter @jobpilot/api test:auth`
- [ ] `pnpm --filter @jobpilot/api test:profile`
- [ ] `pnpm --filter @jobpilot/api test:resumes`
- [ ] `pnpm --filter @jobpilot/api test:jobs`
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume`
- [ ] `pnpm --filter @jobpilot/api test:interview-plan`
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test`
- [ ] Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, and `MCP_SHARED_SECRET` unset. `*.integration.test.ts` stays excluded.
- [ ] `pnpm typecheck`
- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case covers generate plan, start attempt, 8 questions with the stub texts and categories, no answer control, score and readiness `Not available`, and a `502` before an attempt exists. The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, and Phase 15 cases still pass. The new test deletes its `phase16-` users through Prisma.

Live Gemini is not required. GitHub Actions must not gain a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate deploy` applies `20261004180000_interview_attempt`. `prisma migrate status` reports the schema up to date. `InterviewAttempt.jobId` cascades on job delete. The partial unique index `InterviewAttempt_one_in_progress_per_job` exists. `InterviewQuestion` cascades from both the attempt and the job, and `(jobId, normalizedText)` is unique.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` leaves `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `INTERVIEW_QUESTION_MODEL=stub`, the existing stub model selectors, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. The jobs Playwright case still shows `job-score` and `job-readiness` as `Not available` before any attempt is started.
5. The interview-attempt case opens the panel, sees `No interview attempt yet.`, and after start sees 8 questions: four `Backend`, then four `Behavioral questions`, with the stub texts, `stub-concept`, and `stub-rubric`. Score and readiness stay `Not available`.
6. Logout still shows `signed-out` through the existing auth browser test and unmounts the signed-in shell. `JobsQueryCache` removes interview-attempt queries when the session is `signed-out` and when the user id changes.
7. The Vite-served attempt modules return `200` and contain none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_QUESTION_MODEL`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands

Run these from the repository root after implementation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

```bash
pnpm typecheck
env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u MCP_SHARED_SECRET pnpm test
docker compose up -d postgres
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status
docker compose exec postgres psql -U postgres -c "\d \"InterviewAttempt\""
docker compose exec postgres psql -U postgres -c "\d \"InterviewQuestion\""
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:auth
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:profile
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:resumes
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:jobs
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:tailored-resume
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:interview-plan
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase16-validation-secret pnpm --filter @jobpilot/api test:interview-attempt
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase16-validation-secret pnpm --filter @jobpilot/portfolio-mcp test
docker compose up --build -d
curl -sS -D - http://localhost:3000/health
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e
```

## Completion checklist

- [ ] One in-progress attempt per job, inserted only together with exactly 8 questions.
- [ ] Category counts are computed in TypeScript before the model call. Extras go to earlier categories.
- [ ] The stored category is the TypeScript assignment.
- [ ] Normalized duplicates are discarded. Three unsuccessful rounds store nothing.
- [ ] The workflow reads the stored plan and stored question texts only, and it does not call MCP.
- [ ] `POST /jobs/:id/interview-attempts` and `GET /jobs/:id/interview-attempts/current` match the status codes in `spec.md`.
- [ ] Dashboard score and readiness stay `Not available`.
- [ ] `Interview attempt` opens one panel on that row and loads the current attempt only while the panel is open.
- [ ] The empty state is `No interview attempt yet.`
- [ ] `Start attempt` posts `{}` and renders the 8 questions. The panel has no answer control.
- [ ] A failed start shows the API error and does not render questions.
- [ ] A description change keeps the attempt. Job delete removes it.
- [ ] Signed-out removes cached interview-attempt queries. The query key includes the user id and job id.
- [ ] The attempt is parsed with `interviewAttemptSchema`. The web app does not call Gemini or MCP.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [ ] `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] The only new migration is `20261004180000_interview_attempt`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `INTERVIEW_QUESTION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [ ] GitHub Actions does not run Playwright or start PostgreSQL.
- [ ] No Phase 17 or later work is included.

## Result

Not started.
