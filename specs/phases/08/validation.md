# Phase 8 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — The owner can create, list, get, update, and delete a job. Supertest created `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, listed it, fetched it, patched the title and then the description, and deleted it with `204` and an empty body.
- PASS — List returns only the authenticated user's jobs, ordered by `createdAt` ascending and then `id` ascending. Another user's jobs are absent. An owner with no jobs gets `{ "jobs": [] }` and `200`.
- PASS — A second user who gets, updates, or deletes the first user's job receives `404` and `{ "error": "Not found" }`, the same response as a missing or malformed id. The owner's job remains.
- PASS — Missing or invalid fields are rejected with `400` and `{ "error": "Invalid input" }`. A body that includes `userId`, `status`, or another unknown key is rejected. A non-`http`/`https` `jobUrl`, a description that is empty after trim, and an empty patch are rejected.
- PASS — `userId` on a created job is the access token's user. A body that sets `userId` is rejected, so the client cannot assign a different user.
- PASS — A request without a valid access token is rejected with `401` and `{ "error": "Unauthorized" }`.
- PASS — Every create, list, get, and update job includes `status`. For every job, `analysisCurrent`, `tailoredResumePresent`, and `interviewPlanPresent` are `false`, and `latestOverallScore` and `readinessBadge` are `null`. A description update keeps that same status.
- PASS — Create and update do not call Gemini. Both succeed with `GEMINI_API_KEY` unset. The jobs implementation does not import `@jobpilot/ai`.
- PASS — `jobUrl` may be omitted or `null` on create and is stored as `null`. A patch can clear it with `null`. Omitted patch fields stay unchanged.
- PASS — Delete removes that job and returns `204`. It does not remove profile rows or resume files. The jobs test leaves a profile skill and a resume row in place.
- PASS — The new migration adds only `Job` and the `User` relation. Auth, profile, and `ResumeFile` tables stay as they are. The `vector` extension remains installed. No analysis, resume, plan, attempt, or embedding table is added.
- PASS — `createApp()` does not require `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`. `GET /health` still returns `200` and `{"status":"ok"}` from `pnpm test` with those variables unset.
- PASS — The Phase 3 auth contract, the Phase 5 profile contract, and the Phase 7 resume contract still pass. `apps/web` has no diff.
- PASS — No jobs UI, dashboard page, AI workflow, MCP, or embedding behavior is added.

## Required automated tests

- PASS — Supertest, executed only by `pnpm --filter @jobpilot/api test:jobs` against the Compose database: 8 tests passed. They create, list, get, partially update, and delete a job using `Example Co`, `Engineer`, `Build APIs.`, `Remote`, and `https://example.com/jobs/engineer`.
- PASS — The same `test:jobs` run covers an empty list, a missing access token, a validation failure, a rejected `userId` or `status` in the body, a non-`http`/`https` `jobUrl`, a description that is empty after trim, an empty patch, cross-user list exclusion, cross-user get, update, and delete, and a malformed path id.
- PASS — The same `test:jobs` run stores an omitted or `null` `jobUrl` as `null`, clears `jobUrl` with a `null` patch, and leaves omitted patch fields unchanged.
- PASS — The same `test:jobs` run asserts the fixed empty `status` object on create, list, get, and update, including after a description change. `GEMINI_API_KEY` is unset for the run.
- PASS — Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes` against the Compose database, 7 tests passed.
- PASS — Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database, 41 tests passed.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset: 2 tests passed, including the health route (`200` and `{"status":"ok"}`) and the Argon2id unit test.
- PASS — The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose: 1 test passed.

Playwright is not required. Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job. `test:jobs` is not added to root `pnpm test`.

## Manual verification

Schema, health, and leftover users were checked again while writing this record. Create, list, ownership, and status were exercised by `test:jobs` against Compose. There was no separate interactive session.

1. PASS — Compose was up. `prisma migrate deploy` reports five migrations and none pending. `_prisma_migrations` includes finished `20261001220000_job`. `vector` is still installed.
2. PASS — Public tables are `User`, `RefreshSession`, `Skill`, `Education`, `WorkExperience`, `Project`, `Certification`, `ResumeFile`, and `Job`, plus `_prisma_migrations`. No analysis, tailored-resume, interview-plan, or attempt table is present.
3. PASS — `test:jobs` creates a job with a bearer token, lists it for that user, and confirms a second user does not see it. The second user's get, update, and delete of that id return `404`.
4. PASS — The created job's `status` is analysis not current, no tailored resume, no interview plan, no score, and no badge. A description update keeps that object.
5. PASS — `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset includes the health route, which expects `200` and `{"status":"ok"}`.
6. PASS — `apps/web` has no diff in this phase, so it still has no jobs UI and no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. PASS — `test:jobs` deletes its users afterward. A follow-up query found no `phase8-%` rows. No separate manual users were created.

## Commands run

Commands ran from the repository root on 2026-10-01. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate and the database-backed tests. `GEMINI_API_KEY` stayed unset. The implementation run applied the migration and executed the database and API suites. Source files were saved before that run. The review did not re-run those commands. While writing this record, typecheck, `pnpm test`, migrate deploy, the `vector` and `\dt` checks, the applied-migration query, and the leftover-user query were checked again. `test:auth`, `test:profile`, `test:resumes`, `test:jobs`, and the Phase 2 database test were not repeated.

- `pnpm typecheck` — succeeded for the whole monorepo, including `apps/web/tsconfig.e2e.json`. Checked again while writing this record. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test` — succeeded. 2 tests passed. Checked again while writing this record. Exit code 0.
- `docker compose up -d postgres` — Postgres was already running. Checked again while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — the implementation run applied `20261001220000_job`. The close-out run found 5 migrations and no pending migrations. Exit code 0.
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"` — `vector`. Checked again while writing this record.
- `docker compose exec postgres psql -U postgres -c "\dt"` — public tables add `Job` only. Checked again while writing this record.
- `docker compose exec postgres psql -U postgres -c "SELECT migration_name, finished_at IS NOT NULL AS finished FROM _prisma_migrations ORDER BY finished_at;"` — `20261001220000_job` is finished, along with the four earlier migrations. Checked while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` — succeeded. 1 test passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:jobs` — succeeded. 8 tests passed.
- `docker compose exec postgres psql -U postgres -c "SELECT count(*) AS leftover_phase8_users FROM \"User\" WHERE email LIKE 'phase8-%';"` — 0 rows. Checked again while writing this record.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run `test:jobs` or start PostgreSQL.
- The review did not re-run the commands. The implementation run passed them, and source files were saved before it.
- This close-out did not re-run `test:auth`, `test:profile`, `test:resumes`, `test:jobs`, or the Phase 2 database test. Those succeeded in the implementation run, with exit code 0, and no source file changed afterward.
- A malformed or expired bearer token on a jobs route is not given its own assertion. The routes use the same access-token check as `GET /auth/me`, and `test:jobs` covers a missing token.
- Length bounds and keeping internal description whitespace are not given their own assertion. Zod trims the ends and enforces 1–200 and 1–20000.
- `createdAt` as the primary sort when timestamps differ is not given its own assertion. The query orders by `createdAt` then `id`, and the test covers the `id` tie-break.
- Resume bytes on disk after job delete are not asserted. The test shows the resume row remains, and delete removes only that `Job` row.

## Completion checklist

- [x] PASS — `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, and `DELETE /jobs/:id` match the phase spec.
- [x] PASS — The owner can create, list, get, partially update, and delete a job.
- [x] PASS — List is scoped to the access token and ordered by `createdAt`, then `id`.
- [x] PASS — Another user cannot see, get, update, or delete the first user's job. Get, update, and delete of a foreign or malformed id return `404`.
- [x] PASS — Invalid fields, an empty patch, and a body that contains `userId` or `status` return `400` and `{ "error": "Invalid input" }`.
- [x] PASS — A missing or invalid access token returns `401` and `{ "error": "Unauthorized" }`.
- [x] PASS — Zod schemas for the job, the create body, the update body, and status live in `packages/shared`.
- [x] PASS — Job logic lives outside controllers. Status is assembled in the service and is not a database column.
- [x] PASS — Every job response has the fixed empty status. Create and update do not call Gemini.
- [x] PASS — Delete removes only that `Job` row.
- [x] PASS — The new migration adds only `Job`. Earlier migrations are unchanged.
- [x] PASS — No analysis, tailored resume, interview plan, attempt, or embedding table is added.
- [x] PASS — `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes against Compose.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — The Phase 2 database integration test passes.
- [x] PASS — `apps/web` is unchanged.
- [x] PASS — GitHub Actions is unchanged and does not start PostgreSQL.
- [x] PASS — No Phase 9 or later work is included.
