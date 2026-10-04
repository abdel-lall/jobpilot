# Phase 17 — Validation

## Acceptance criteria

- [ ] Submitting one answer stores that trimmed answer, feedback, and an integer score from 0 through 100 on that question only.
- [ ] The other seven questions stay unanswered until each is submitted.
- [ ] The workflow input is the question text, the rubric, the answer, and the prompt built from those three. Expected concepts, category, and profile records are not part of that input. The workflow does not call MCP.
- [ ] A score outside 0 through 100, or any other schema failure, returns `502` and leaves the question unanswered.
- [ ] The attempt stays `in_progress` until all 8 questions have scores. The eighth stored score marks it `completed`.
- [ ] A second answer on the same question is rejected with `409` and does not call the model.
- [ ] `GET /jobs/:id/interview-attempts/current` returns the attempt after a score and after completion, using the stored status and the stored answer, feedback, and score.
- [ ] Starting another attempt after completion is rejected with `409` and does not call the question model.
- [ ] The job JSON keeps `latestOverallScore` and `readinessBadge` null while the attempt is in progress and after it is complete. The dashboard score and readiness stay `Not available`.
- [ ] Another user cannot score an answer. An invalid body does not call the model.
- [ ] The attempt panel shows feedback and the score for a submitted answer, and it still offers an answer box on each unanswered question.
- [ ] No Phase 18 or later work is included.

## Required automated tests

- [ ] Vitest in `packages/ai/src/answer-evaluation.test.ts`, executed by root `pnpm test`: the stub returns feedback `stub-feedback` and score 80; the schema accepts 0, 80, and 100 and rejects -1, 101, and 1.5; one model call carries the question text, rubric, answer, and prompt only; the prompt excludes a profile sentinel, an expected-concept sentinel, and a category sentinel; score 101 and an extra key reject. `GEMINI_API_KEY` is unset. No network call.
- [ ] Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database: score one answer; the other seven stay unanswered; status stays `in_progress`; job score and badge stay null; `GET` current returns the scored question; a second submit is `409` without a model call; score 101 is `502` and writes nothing; the eighth score sets `completed`; a later start is `409` without the question model; cross-user `404`; unknown question `404`; `400` for an empty, missing, or unknown-key body; `401` for a missing or invalid token; `502` with no write when `createApp()` has no evaluation model and both `GEMINI_API_KEY` and `ANSWER_EVALUATION_MODEL` are unset. Existing start and generation cases still pass.
- [ ] `pnpm --filter @jobpilot/api test:auth`
- [ ] `pnpm --filter @jobpilot/api test:profile`
- [ ] `pnpm --filter @jobpilot/api test:resumes`
- [ ] `pnpm --filter @jobpilot/api test:jobs`
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume`
- [ ] `pnpm --filter @jobpilot/api test:interview-plan`
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test`
- [ ] Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset. `*.integration.test.ts` stays excluded.
- [ ] `pnpm typecheck`
- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, `ANSWER_EVALUATION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case submits one answer and shows `stub-feedback` and `80` on that question only. Score and readiness stay `Not available`. A stubbed `502` shows the error and does not show feedback. The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, Phase 15, and Phase 16 cases still pass. The new test deletes its `phase17-` users through Prisma.

Live Gemini is not required. GitHub Actions must not gain a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate deploy` applies `20261004220000_interview_attempt_completed`. `prisma migrate status` reports the schema up to date. `InterviewAttemptStatus` includes `in_progress` and `completed`. The partial unique index `InterviewAttempt_one_in_progress_per_job` still exists. No earlier migration directory was edited.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` leaves `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `ANSWER_EVALUATION_MODEL=stub`, the existing stub model selectors, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.
4. The jobs Playwright case still shows `job-score` and `job-readiness` as `Not available`.
5. The interview-answer case submits one answer and shows that answer, `stub-feedback`, and `80` on the first question. The other seven questions still have an answer box. Score and readiness stay `Not available`.
6. Logout still shows `signed-out` through the existing auth browser test and unmounts the signed-in shell. `JobsQueryCache` still removes interview-attempt queries when the session is `signed-out` and when the user id changes.
7. The Vite-served attempt modules return `200` and contain none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `INTERVIEW_QUESTION_MODEL`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands

Run these from the repository root after implementation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

```bash
pnpm typecheck
env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u ANSWER_EVALUATION_MODEL -u MCP_SHARED_SECRET pnpm test
docker compose up -d postgres
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status
docker compose exec postgres psql -U postgres -c "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'InterviewAttemptStatus' ORDER BY e.enumsortorder;"
docker compose exec postgres psql -U postgres -c "\d \"InterviewAttempt\""
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:auth
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:profile
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:resumes
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:jobs
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:tailored-resume
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:interview-plan
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase17-validation-secret pnpm --filter @jobpilot/api test:interview-attempt
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase17-validation-secret pnpm --filter @jobpilot/portfolio-mcp test
docker compose up --build -d
curl -sS -D - http://localhost:3000/health
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e
```

## Completion checklist

- [ ] One answer stores feedback and an integer score from 0 through 100 on that question only.
- [ ] The evaluation workflow reads the question text, the rubric, and the answer only, and it does not call MCP.
- [ ] An out-of-range score returns `502` and writes nothing.
- [ ] The attempt stays `in_progress` through the seventh score and becomes `completed` on the eighth.
- [ ] A repeated answer returns `409` and does not call the model.
- [ ] `GET /jobs/:id/interview-attempts/current` returns stored scores and a completed attempt.
- [ ] A start after completion returns `409` and does not call the question model.
- [ ] Dashboard score and readiness stay `Not available` after a score and after completion.
- [ ] `Submit answer` posts the textarea value and renders feedback and the score. Unanswered questions keep an answer box.
- [ ] A failed evaluation shows the API error and does not render feedback or a score.
- [ ] The attempt is parsed with `interviewAttemptSchema`. The web app does not call Gemini or MCP.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [ ] `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] The only new migration is `20261004220000_interview_attempt_completed`. Earlier migrations and `.github/workflows/ci.yml` are unchanged.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [ ] GitHub Actions does not run Playwright or start PostgreSQL.
- [ ] No Phase 18 or later work is included.

## Result

Not started.
