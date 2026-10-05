# Phase 18 — Validation

Validation has not been run. Do not mark a check PASS unless the command or inspection succeeded.

## Acceptance criteria

- [ ] A completed attempt whose eight scores sum to at least 640, and whose every tested category sums to at least `70 *` that category's question count, shows `latestOverallScore` as `sum / 8` and `readinessBadge` as `Interview Ready`.
- [ ] A completed attempt below either threshold shows that overall score and `readinessBadge` `null`. The score is not rounded. `79.875` does not pass.
- [ ] A category that has no question on the attempt does not affect the result.
- [ ] After a newer completed attempt fails, the badge is removed and the score is the newer overall score, even if an older attempt passed. The older attempt, its questions, answers, and scores remain stored.
- [ ] A retake stores a new attempt. Its normalized question texts do not match any question already stored for that user and job.
- [ ] A retake that cannot find 8 unique questions after 3 rounds returns `502` and leaves the stored attempts unchanged.
- [ ] The dashboard score and badge stay on the previous completed attempt while a retake is `in_progress`.
- [ ] `GET /jobs/:id/interview-attempts/current` returns the `in_progress` attempt when one exists, and otherwise the latest completed attempt.
- [ ] Deleting the job removes its analysis, tailored resume, interview plan, attempts, and questions.
- [ ] A passing attempt does not award the badge on another job.
- [ ] No later-phase work is included. There is no new migration, workflow, dependency, or environment variable.

## Required automated tests

- [ ] Vitest in `apps/api/src/readiness.test.ts`, executed by root `pnpm test`. Cover the score table in `specs/phases/18/spec.md`, including eight Backend scores of 80 with no other category.
- [ ] Vitest in `packages/ai`: the evaluation stub returns score 80 for `I would add an index.` and score 0 for `fail`. The question stub keeps the Phase 16 texts when nothing is stored, and returns eight non-colliding texts when those eight are already stored.
- [ ] Supertest, executed by `pnpm --filter @jobpilot/api test:interview-attempt` against the Compose database. Cover score 80 with `Interview Ready`, score `79.875` with no badge, a null score before completion, a repeated-text retake `502` that keeps one attempt, a unique retake that keeps history, an in-progress retake that does not replace the dashboard score, a failing retake that clears the badge, cross-job isolation, cross-user `404`, current-attempt selection, and job delete cascade.
- [ ] `pnpm --filter @jobpilot/api test:auth`
- [ ] `pnpm --filter @jobpilot/api test:profile`
- [ ] `pnpm --filter @jobpilot/api test:resumes`
- [ ] `pnpm --filter @jobpilot/api test:jobs`
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume`
- [ ] `pnpm --filter @jobpilot/api test:interview-plan`
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test`
- [ ] Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset. `*.integration.test.ts` stays excluded.
- [ ] `pnpm typecheck`
- [ ] Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with the stub models and an empty `GEMINI_API_KEY`. The new case finishes a passing attempt, sees `80` and `Interview Ready`, starts a retake without changing that score or badge, then finishes a failing retake and sees `0` and `Not available`. Earlier browser cases still pass. The test deletes its `phase18-` users.

Live Gemini is not required. GitHub Actions does not gain a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate status` reports no pending migrations and no new migration directory.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` leaves `postgres`, `api`, `web`, and `portfolio-mcp` running. The API uses the stub model selectors and an empty `GEMINI_API_KEY`. The web service does not receive a Gemini key or a model selector.
4. The jobs browser case still shows `job-score` and `job-readiness` as `Not available` before any attempt is completed.
5. The readiness browser case shows `80` and `Interview Ready` after the first attempt, keeps both during the in-progress retake, and shows `0` and `Not available` after the failing retake.
6. Logout still shows the signed-out state. Interview-attempt queries are still removed when the session is signed out and when the user id changes.
7. The web bundle served for the attempt and dashboard modules contains none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `INTERVIEW_QUESTION_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`.

## Commands

Run these from the repository root after implementation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u INTERVIEW_PLAN_MODEL -u INTERVIEW_QUESTION_MODEL -u ANSWER_EVALUATION_MODEL -u MCP_SHARED_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:tailored-resume`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:interview-plan`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase18-validation-secret pnpm --filter @jobpilot/api test:interview-attempt`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase18-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `curl -sS -D - http://localhost:3000/health`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`

## Completion checklist

- [ ] Overall and category means use integer comparisons against 80 and 70. Untested categories are ignored.
- [ ] `latestOverallScore` and `readinessBadge` are computed on read from the latest completed attempt. No new column or migration.
- [ ] A passing latest attempt shows the score and `Interview Ready` on the job and the dashboard.
- [ ] A failing latest attempt shows the score and no badge, including when an older attempt passed.
- [ ] An in-progress retake does not replace the previous score or badge.
- [ ] A retake stores a new attempt and keeps the old one. Repeated normalized text is rejected without deleting history.
- [ ] `GET` current returns the in-progress attempt when one exists.
- [ ] Job delete removes analysis, tailored resume, plan, attempts, and questions.
- [ ] The attempt panel can start a retake from a completed attempt and refetches jobs after the eighth score.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the earlier browser cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:interview-attempt` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` pass.
- [ ] `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` pass.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] No new migration. `.github/workflows/ci.yml` is unchanged.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [ ] GitHub Actions does not run Playwright or start PostgreSQL.
- [ ] No later-phase work is included.

## Result

Not started.
