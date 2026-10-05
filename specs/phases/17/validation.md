# Phase 17 — Validation

Validation passed on 2026-10-04. The implementation review passed with no required code changes. The command list below was run after implementation, from the repository root, on branch `phase/17-answer-evaluation`.

## Acceptance criteria

- PASS — Submitting one answer stores that trimmed answer, feedback, and an integer score from 0 through 100 on that question only.
- PASS — The other seven questions stay unanswered until each is submitted.
- PASS — The workflow input is the question text, the rubric, the answer, and the prompt built from those three. Expected concepts, category, and profile records are not part of that input. The workflow does not call MCP.
- PASS — A score outside 0 through 100, or any other schema failure, returns `502` and leaves the question unanswered.
- PASS — The attempt stays `in_progress` until all 8 questions have scores. The eighth stored score marks it `completed`.
- PASS — A second answer on the same question is rejected with `409` and does not call the model.
- PASS — `GET /jobs/:id/interview-attempts/current` returns the attempt after a score and after completion, using the stored status and the stored answer, feedback, and score.
- PASS — Starting another attempt after completion is rejected with `409` and does not call the question model.
- PASS — The job JSON keeps `latestOverallScore` and `readinessBadge` null while the attempt is in progress and after it is complete. The dashboard score and readiness stay `Not available`.
- PASS — Another user cannot score an answer. An invalid body does not call the model.
- PASS — The attempt panel shows feedback and the score for a submitted answer, and it still offers an answer box on each unanswered question.
- PASS — No Phase 18 or later work is included.

## Required automated tests

- PASS — Vitest in `packages/ai/src/answer-evaluation.test.ts`, executed by root `pnpm test`: 4 tests passed. The stub returns feedback `stub-feedback` and score 80. The schema accepts 0, 80, and 100 and rejects -1, 101, and 1.5. One model call carries the question text, rubric, answer, and prompt only. The prompt excludes a profile sentinel, an expected-concept sentinel, and a category sentinel. Score 101 and an extra key reject. `GEMINI_API_KEY` is unset. No network call.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database: 16 tests passed. They cover one trimmed answer with the other seven unanswered, status `in_progress`, null job score and badge, `GET` current returning the scored question, a second submit `409` without a model call, score 101 as `502` with no write, completion only on the eighth score, a later start `409` without the question model, cross-user `404`, unknown question `404`, `400` for an empty, missing, or unknown-key body, `401` for a missing or invalid token, and `502` with no write when `createApp()` has no evaluation model and both `GEMINI_API_KEY` and `ANSWER_EVALUATION_MODEL` are unset. Existing start and generation cases still passed. Overlapping last-two answers finish `completed`. A start that is still generating does not insert a second attempt after another attempt is completed.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:tailored-resume`: 9 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:interview-plan`: 8 tests passed.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset: passed. API unit tests passed (2 tests). The AI suite passed 26 tests, including the answer-evaluation file. `*.integration.test.ts` stayed excluded.
- PASS — `pnpm typecheck` succeeded for shared, database, AI, web (including `tsconfig.e2e.json`), portfolio-mcp, and API. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 28 tests passed. Compose was running with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, `ANSWER_EVALUATION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case submits one answer and shows that answer, `stub-feedback`, and `80` on that question only. The other seven questions keep an answer box. Score and readiness stay `Not available`. A stubbed `502` shows `Answer evaluation failed` and does not show feedback or a score. The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, Phase 15, and Phase 16 cases still passed. The new test deletes its `phase17-` users through Prisma.

Live Gemini was not called. GitHub Actions was not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate deploy` reports no pending migrations. `prisma migrate status` reports 11 migrations and the schema is up to date. The new directory is `20261004220000_interview_attempt_completed`. `InterviewAttemptStatus` includes `in_progress` and `completed`, in that order. The partial unique index `InterviewAttempt_one_in_progress_per_job` still exists on `jobId` where `status = 'in_progress'`. Job delete still cascades to the attempt. No earlier migration directory was edited.
2. PASS — `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
3. PASS — `docker compose up --build -d` left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `ANSWER_EVALUATION_MODEL=stub`, `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. PASS — The jobs Playwright case still shows `job-score` and `job-readiness` as `Not available`.
5. PASS — The interview-answer case submits one answer and shows that answer, `stub-feedback`, and `80` on the first question. The other seven questions still have an answer box. Score and readiness stay `Not available`.
6. PASS — Logout still shows `signed-out` through the existing auth browser test and unmounts the signed-in shell. `JobsQueryCache` still removes interview-attempt queries when the session is `signed-out` and when the user id changes.
7. PASS — The Vite-served attempt modules `src/jobs/interview-attempt.ts`, `src/jobs/interview-attempt-panel.tsx`, `src/jobs/cache.tsx`, and `src/main.tsx` returned `200` and contained none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `INTERVIEW_QUESTION_MODEL`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands run

Commands ran from the repository root on 2026-10-04. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u ANSWER_EVALUATION_MODEL -u MCP_SHARED_SECRET pnpm test` — passed. API unit tests: 2 passed. AI tests: 26 passed, including 4 answer-evaluation tests. Integration tests were excluded.
- `docker compose up -d postgres` — Postgres was already running and stayed available for migrate and the database-backed tests.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — 11 migrations found. No pending migrations to apply.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 11 migrations found. Database schema is up to date.
- `docker compose exec postgres psql -U postgres -c "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'InterviewAttemptStatus' ORDER BY e.enumsortorder;"` — `in_progress`, then `completed`.
- `docker compose exec postgres psql -U postgres -c "\d \"InterviewAttempt\""` — `jobId` cascades on delete. Partial unique index `InterviewAttempt_one_in_progress_per_job` is present.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:interview-plan` — 8 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:interview-attempt` — 16 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase17-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed.
- `docker compose up --build -d` — built and left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `ANSWER_EVALUATION_MODEL=stub` and an empty `GEMINI_API_KEY`.
- `curl -sS -D - http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 28 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- Live Gemini was not called. Compose has `ANSWER_EVALUATION_MODEL=stub` and an empty `GEMINI_API_KEY`.
- No browser test asserts that interview-attempt query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs, tailored-resume, and interview-plan queries.
- Some database-backed API runs printed a Node deprecation from `pg` about `client.query()` during an open query. Every suite still exited 0.

## Completion checklist

- [x] PASS — One answer stores feedback and an integer score from 0 through 100 on that question only.
- [x] PASS — The evaluation workflow reads the question text, the rubric, and the answer only, and it does not call MCP.
- [x] PASS — An out-of-range score returns `502` and writes nothing.
- [x] PASS — The attempt stays `in_progress` through the seventh score and becomes `completed` on the eighth.
- [x] PASS — A repeated answer returns `409` and does not call the model.
- [x] PASS — `GET /jobs/:id/interview-attempts/current` returns stored scores and a completed attempt.
- [x] PASS — A start after completion returns `409` and does not call the question model.
- [x] PASS — Dashboard score and readiness stay `Not available` after a score and after completion.
- [x] PASS — `Submit answer` posts the textarea value and renders feedback and the score. Unanswered questions keep an answer box.
- [x] PASS — A failed evaluation shows the API error and does not render feedback or a score.
- [x] PASS — The attempt is parsed with `interviewAttemptSchema`. The web app does not call Gemini or MCP.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — The only new migration is `20261004220000_interview_attempt_completed`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [x] PASS — GitHub Actions does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 18 or later work is included.

## Result

PASS
