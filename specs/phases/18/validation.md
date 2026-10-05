# Phase 18 — Validation

Validation passed on 2026-10-04. The implementation review passed with no required code changes. The command list below was run after implementation, from the repository root, on branch `phase/18-retakes-readiness`.

## Acceptance criteria

- PASS — A completed attempt whose eight scores sum to at least 640, and whose every tested category sums to at least `70 *` that category's question count, shows `latestOverallScore` as `sum / 8` and `readinessBadge` as `Interview Ready`.
- PASS — A completed attempt below either threshold shows that overall score and `readinessBadge` `null`. The score is not rounded. `79.875` does not pass.
- PASS — A category that has no question on the attempt does not affect the result. Eight Backend scores of 80 pass with no other category present.
- PASS — After a newer completed attempt fails, the badge is removed and the score is the newer overall score, even if an older attempt passed. The older attempt, its questions, answers, and scores remain stored.
- PASS — A retake stores a new attempt. Its normalized question texts do not match any question already stored for that user and job.
- PASS — A retake that cannot find 8 unique questions after 3 rounds returns `502` and leaves the stored attempts unchanged.
- PASS — The dashboard score and badge stay on the previous completed attempt while a retake is `in_progress`.
- PASS — `GET /jobs/:id/interview-attempts/current` returns the `in_progress` attempt when one exists, and otherwise the latest completed attempt.
- PASS — Deleting the job removes its analysis, tailored resume, interview plan, attempts, and questions.
- PASS — A passing attempt does not award the badge on another job.
- PASS — No later-phase work is included. There is no new migration, workflow, dependency, or environment variable.

## Required automated tests

- PASS — Vitest in `apps/api/src/readiness.test.ts`, executed by root `pnpm test`: 9 tests passed. They cover the score table in `specs/phases/18/spec.md`, including eight Backend scores of 80 with no other category, and the throw for a short list or a non-integer score.
- PASS — Vitest in `packages/ai`: 28 tests passed inside root `pnpm test`. The evaluation stub returns score 80 and `stub-feedback` for `I would add an index.`, and score 0 with `stub-feedback` for `fail` (5 answer-evaluation tests). The question stub keeps the Phase 16 texts when nothing is stored, and returns eight non-colliding `retake 2` texts when those eight are already stored (8 interview-question tests).
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database: 20 tests passed. They cover score 80 with `Interview Ready`, score `79.875` with no badge, a null score before completion, a repeated-text retake `502` that keeps one attempt, a unique retake that keeps history, an in-progress retake that does not replace the dashboard score, a failing retake that clears the badge, cross-job isolation, cross-user `404`, current-attempt selection, and job delete cascade. The late start that finishes generating after another attempt completes returns `502` and leaves that completed attempt as the only attempt.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:tailored-resume`: 9 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:interview-plan`: 8 tests passed.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset: passed. API unit tests passed (11 tests, including 9 readiness tests). The AI suite passed 28 tests. `*.integration.test.ts` stayed excluded.
- PASS — `pnpm typecheck` succeeded for shared, database, AI, web (including `tsconfig.e2e.json`), portfolio-mcp, and API. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 29 tests passed. Compose was running with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, `ANSWER_EVALUATION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The new case finishes a passing attempt, sees `80` and `Interview Ready`, starts a retake without changing that score or badge, then finishes a failing retake and sees `0` and `Not available`. The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, Phase 15, Phase 16, and Phase 17 cases still passed. The new test deletes its `phase18-` users through Prisma.

Live Gemini was not called. GitHub Actions was not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate deploy` reports no pending migrations. `prisma migrate status` reports 11 migrations and the schema is up to date. No new migration directory was added. The latest directory remains `20261004220000_interview_attempt_completed`.
2. PASS — `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
3. PASS — `docker compose up --build -d` left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API has `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, `ANSWER_EVALUATION_MODEL=stub`, and an empty `GEMINI_API_KEY`. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults. It does not receive a Gemini key or a model selector.
4. PASS — The jobs Playwright case still shows `job-score` and `job-readiness` as `Not available` before any attempt is completed. The Phase 14, Phase 15, Phase 16, and Phase 17 cases that do not complete an attempt also still show both as `Not available`.
5. PASS — The readiness browser case shows `80` and `Interview Ready` after the first attempt, keeps both during the in-progress retake, and shows `0` and `Not available` after the failing retake.
6. PASS — Logout still shows `signed-out` through the existing auth browser test. `JobsQueryCache` still removes interview-attempt queries when the session is `signed-out` and when the user id changes.
7. PASS — The Vite-served modules `src/jobs/dashboard.tsx`, `src/jobs/interview-attempt-panel.tsx`, `src/jobs/interview-attempt.ts`, `src/jobs/cache.tsx`, and `src/main.tsx` returned `200` and contained none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `INTERVIEW_QUESTION_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands run

Commands ran from the repository root on 2026-10-04. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u ANSWER_EVALUATION_MODEL -u MCP_SHARED_SECRET pnpm test` — passed. API unit tests: 11 passed, including 9 readiness tests. AI tests: 28 passed, including 5 answer-evaluation tests and 8 interview-question tests. Integration tests were excluded.
- `docker compose up -d postgres` — Postgres was already running and stayed available for migrate and the database-backed tests.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — 11 migrations found. No pending migrations to apply.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 11 migrations found. Database schema is up to date.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:interview-plan` — 8 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:interview-attempt` — 20 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase18-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed.
- `docker compose up --build -d` — built and left `postgres`, `api`, `web`, and `portfolio-mcp` running. The API uses the stub model selectors and an empty `GEMINI_API_KEY`. The web service does not receive a Gemini key or a model selector.
- `curl -sS -D - http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 29 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- Live Gemini was not called. Compose has the stub model selectors and an empty `GEMINI_API_KEY`.
- No browser test asserts that interview-attempt query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs, tailored-resume, and interview-plan queries.
- Some database-backed API runs printed a Node deprecation from `pg` about `client.query()` during an open query. Every suite still exited 0.

## Completion checklist

- [x] PASS — Overall and category means use integer comparisons against 80 and 70. Untested categories are ignored.
- [x] PASS — `latestOverallScore` and `readinessBadge` are computed on read from the latest completed attempt. No new column or migration.
- [x] PASS — A passing latest attempt shows the score and `Interview Ready` on the job and the dashboard.
- [x] PASS — A failing latest attempt shows the score and no badge, including when an older attempt passed.
- [x] PASS — An in-progress retake does not replace the previous score or badge.
- [x] PASS — A retake stores a new attempt and keeps the old one. Repeated normalized text is rejected without deleting history.
- [x] PASS — `GET` current returns the in-progress attempt when one exists.
- [x] PASS — Job delete removes analysis, tailored resume, plan, attempts, and questions.
- [x] PASS — The attempt panel can start a retake from a completed attempt and refetches jobs after the eighth score.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — No new migration. `.github/workflows/ci.yml` is unchanged.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [x] PASS — GitHub Actions does not run Playwright or start PostgreSQL.
- [x] PASS — No later-phase work is included.

## Result

Passed
