# Phase 8 — Validation

Not started. Do not mark an item PASS until the command, test, or inspection has actually succeeded.

## Acceptance criteria

- [ ] The owner can create, list, get, update, and delete a job.
- [ ] List returns only the authenticated user's jobs, ordered by `createdAt` ascending and then `id` ascending. Another user's jobs are absent. An owner with no jobs gets `{ "jobs": [] }` and `200`.
- [ ] A second user who gets, updates, or deletes the first user's job receives `404` and `{ "error": "Not found" }`, the same response as a missing or malformed id. The owner's job remains.
- [ ] Missing or invalid fields are rejected with `400` and `{ "error": "Invalid input" }`. A body that includes `userId`, `status`, or another unknown key is rejected. An empty patch is rejected.
- [ ] `userId` on a created job is the access token's user. The client cannot assign a different user.
- [ ] A request without a valid access token is rejected with `401` and `{ "error": "Unauthorized" }`.
- [ ] Every create, list, get, and update job includes `status`. For every job, `analysisCurrent`, `tailoredResumePresent`, and `interviewPlanPresent` are `false`, and `latestOverallScore` and `readinessBadge` are `null`. A description update keeps that same status.
- [ ] Create and update do not call Gemini. Both succeed with `GEMINI_API_KEY` unset. The jobs implementation does not import `@jobpilot/ai`.
- [ ] `jobUrl` may be omitted or `null` on create and is stored as `null`. A patch can clear it with `null`. Omitted patch fields stay unchanged.
- [ ] Delete removes that job and returns `204`. It does not remove profile rows or resume files.
- [ ] The new migration adds only `Job` and the `User` relation. Auth, profile, and `ResumeFile` tables stay as they are. The `vector` extension remains installed. No analysis, resume, plan, attempt, or embedding table is added.
- [ ] `createApp()` does not require `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`. `GET /health` still returns success without those variables.
- [ ] The Phase 3 auth contract, the Phase 5 profile contract, and the Phase 7 resume contract still pass. `apps/web` is unchanged.
- [ ] No jobs UI, dashboard page, AI workflow, MCP, or embedding behavior is added.

## Required automated tests

- [ ] Supertest, executed only by `pnpm --filter @jobpilot/api test:jobs` against the Compose database: create, list, get, partial update, and delete, using `Example Co`, `Engineer`, `Build APIs.`, `Remote`, and `https://example.com/jobs/engineer`.
- [ ] The same `test:jobs` run covers an empty list, a missing access token, a validation failure, a rejected `userId` or `status` in the body, a non-`http`/`https` `jobUrl`, a description that is empty after trim, an empty patch, cross-user list exclusion, cross-user get, update, and delete, and a malformed path id.
- [ ] The same `test:jobs` run stores an omitted or `null` `jobUrl` as `null`, clears `jobUrl` with a `null` patch, and leaves omitted patch fields unchanged.
- [ ] The same `test:jobs` run asserts the fixed empty `status` object on create, list, get, and update, including after a description change. `GEMINI_API_KEY` is unset for the run.
- [ ] Supertest from Phase 7 still passes: `pnpm --filter @jobpilot/api test:resumes` against the Compose database.
- [ ] Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database.
- [ ] Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database.
- [ ] Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset, including the health route and the Argon2id unit test.
- [ ] The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose.

Playwright is not required. Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job. `test:jobs` is not added to root `pnpm test`.

## Manual verification

1. Apply migrations to Compose and confirm the new migration adds only `Job`. Confirm `vector` is still installed.
2. Confirm public tables add `Job` and do not add analysis, tailored-resume, interview-plan, or attempt tables.
3. Through `test:jobs`, create a job with a bearer token, list it for that user, and confirm a second user does not see it. The second user's get, update, and delete of that id return `404`.
4. Confirm the created job's `status` is analysis not current, no tailored resume, no interview plan, no score, and no badge.
5. Confirm `GET /health` returns `200` and `{"status":"ok"}` from `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset.
6. Confirm `apps/web` has no diff in this phase, so it still has no jobs UI and no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. Confirm `test:jobs` deletes its users afterward. No separate manual users need to be created.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma and the database-backed tests. Leave `GEMINI_API_KEY` unset.

- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`
- `docker compose exec postgres psql -U postgres -c "\dt"`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase8-validation-secret pnpm --filter @jobpilot/api test:jobs`

Do not add these tests to GitHub Actions. Do not require `pnpm --filter @jobpilot/web test:e2e` for this phase.

## Completion checklist

- [ ] `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, and `DELETE /jobs/:id` match the phase spec.
- [ ] The owner can create, list, get, partially update, and delete a job.
- [ ] List is scoped to the access token and ordered by `createdAt`, then `id`.
- [ ] Another user cannot see, get, update, or delete the first user's job. Get, update, and delete of a foreign or malformed id return `404`.
- [ ] Invalid fields, an empty patch, and a body that contains `userId` or `status` return `400` and `{ "error": "Invalid input" }`.
- [ ] A missing or invalid access token returns `401` and `{ "error": "Unauthorized" }`.
- [ ] Zod schemas for the job, the create body, the update body, and status live in `packages/shared`.
- [ ] Job logic lives outside controllers. Status is assembled in the service and is not a database column.
- [ ] Every job response has the fixed empty status. Create and update do not call Gemini.
- [ ] Delete removes only that `Job` row.
- [ ] The new migration adds only `Job`. Earlier migrations are unchanged.
- [ ] No analysis, tailored resume, interview plan, attempt, or embedding table is added.
- [ ] `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes against Compose.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] The Phase 2 database integration test passes.
- [ ] `apps/web` is unchanged.
- [ ] GitHub Actions is unchanged and does not start PostgreSQL.
- [ ] No Phase 9 or later work is included.
