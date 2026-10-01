# Phase 5 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — The owner can create, list, update, and delete a skill, an education record, a work experience record, a project, and a certification.
- PASS — List returns only the authenticated user's rows, ordered by `createdAt` ascending and then `id` ascending. Another user's rows are absent.
- PASS — A second user who updates or deletes the first user's record receives `404` and `{ "error": "Not found" }`, the same response as a missing id. A malformed path id returns that same response.
- PASS — Missing or invalid fields are rejected with `400` and `{ "error": "Invalid input" }`. A body that includes `userId` or another unknown key is rejected.
- PASS — A partial date patch is checked against the merged record after ownership is established. A `startDate` later than the stored `endDate`, an `endDate` earlier than the stored `startDate`, or an `issuedOn` later than the stored `expiresOn` returns `400` and `{ "error": "Invalid input" }` and does not change the row.
- PASS — Accomplishments and technologies are stored trimmed, in input order, including duplicate trimmed values. An item that is empty after trimming is rejected.
- PASS — `userId` on a created record is the access token's user. The client cannot assign a different user.
- PASS — A request without a valid access token is rejected with `401` and `{ "error": "Unauthorized" }`.
- PASS — Nullable fields can be cleared with `null` on update. Omitted patch fields stay unchanged.
- PASS — The new migration adds only `Skill`, `Education`, `WorkExperience`, `Project`, and `Certification`. `User` and `RefreshSession` columns are unchanged. The `vector` extension remains installed. No embedding column is added.
- PASS — `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. `GET /health` still returns success without those variables.
- PASS — Credentialed CORS still allows only `WEB_ORIGIN`, and preflight allows `PATCH` and `DELETE`.
- PASS — The Phase 3 auth contract still passes. `apps/web` is unchanged.
- PASS — No profile UI, resume-file storage, jobs, AI, MCP, or embedding behavior is added.

## Required automated tests

- PASS — Supertest, executed only by `pnpm --filter @jobpilot/api test:profile` against the Compose database: 41 tests passed. They cover CRUD for each record type, validation failures, a rejected `userId` in the body, cross-user list exclusion, cross-user update and delete, a malformed path id, a missing access token, and credentialed preflight for `PATCH` and `DELETE`.
- PASS — The same `test:profile` run covers a partial PATCH whose merged range is invalid: `startDate` after the stored `endDate`, `endDate` before the stored `startDate`, and `issuedOn` after the stored `expiresOn`. Each response is `400` with `{ "error": "Invalid input" }`, and a following list shows the original dates.
- PASS — The same `test:profile` run stores accomplishments and technologies with each item trimmed, in the submitted order, keeping a repeated trimmed value. An item that trims to an empty string returns `400` and does not replace the stored array.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset: 2 tests passed, including the health route and the Argon2id unit test.
- PASS — The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose: 1 test passed.

Playwright is not required. Gemini is not called. GitHub Actions is not given a PostgreSQL service.

## Manual verification

The checks below were exercised by `test:profile`, `test:auth`, `pnpm test`, migrate deploy, and `psql`. There was no separate interactive HTTP session against a running API process.

1. PASS — `prisma migrate deploy` found 3 migrations and none pending. `vector` is still installed.
2. PASS — Public tables are `User`, `RefreshSession`, `Skill`, `Education`, `WorkExperience`, `Project`, `Certification`, and `_prisma_migrations`.
3. PASS — `test:profile` creates a skill with a bearer token, lists it for that user, and shows that a second user does not see the row. The second user's `PATCH` and `DELETE` of that id return `404`.
4. PASS — A skill body that includes `userId` returns `400` in `test:profile`.
5. PASS — `GET /health` returns `200` and `{"status":"ok"}` in `pnpm test` with `DATABASE_URL` and `JWT_SECRET` unset. `curl` against a running API was not used.
6. PASS — `apps/web` has no diff in this phase, so it still has no profile pages and no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. PASS — `test:profile` deletes its users afterward. No separate manual users were created.

## Commands run

Commands ran from the repository root on 2026-10-01 during implementation. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate and the database-backed tests. The later review did not re-run these commands. Source files were last saved before that run.

- `pnpm install` — succeeded. Lockfile unchanged. Prisma client generated.
- `pnpm typecheck` — succeeded for the whole monorepo.
- `env -u DATABASE_URL -u JWT_SECRET pnpm test` — succeeded. 2 tests passed.
- `docker compose up -d postgres` — Postgres was already running.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. 3 migrations found, none pending.
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"` — returned `vector`.
- `docker compose exec postgres psql -U postgres -c "\dt"` — listed `User`, `RefreshSession`, `Skill`, `Education`, `WorkExperience`, `Project`, `Certification`, and `_prisma_migrations`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` — succeeded. 1 test passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase5-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase5-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.

`curl -sS http://localhost:3000/health` was not run. Compose was not rebuilt, and the API container was not started.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not start PostgreSQL.
- The review did not re-run install, typecheck, `pnpm test`, migrate, `psql`, `test:auth`, or `test:profile`.
- `curl` against a running API was not run. Health without `DATABASE_URL` and `JWT_SECRET` was verified by `pnpm test`.
- The manual login session was not repeated outside Supertest. Those cases passed in `test:profile`.

## Completion checklist

- [x] PASS — `POST`, `GET`, `PATCH`, and `DELETE` exist for skills, education, experience, projects, and certifications.
- [x] PASS — The owner can create, list, partially update, and delete each record type.
- [x] PASS — List is scoped to the access token and ordered by `createdAt`, then `id`.
- [x] PASS — Another user cannot see, update, or delete the first user's records. Update and delete of a foreign id return `404`.
- [x] PASS — Invalid fields, an empty patch, a body that contains `userId`, and a partial date patch whose merged range is invalid return `400` and `{ "error": "Invalid input" }`. The invalid date patch leaves the stored row unchanged.
- [x] PASS — Accomplishments and technologies are trimmed before storage, validated after trimming, stored in input order, and not sorted or deduplicated. An item that is empty after trimming is rejected.
- [x] PASS — A missing or invalid access token returns `401` and `{ "error": "Unauthorized" }`.
- [x] PASS — Zod schemas for all five record types live in `packages/shared`.
- [x] PASS — Profile logic lives outside controllers.
- [x] PASS — The new migration adds only the five profile tables. Earlier migrations are unchanged.
- [x] PASS — No embedding column, vector index, or resume-file table is added.
- [x] PASS — `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`.
- [x] PASS — `GET /health` still passes with `pnpm test` when `DATABASE_URL` and `JWT_SECRET` are unset.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes against Compose.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — The Phase 2 database integration test passes.
- [x] PASS — CORS allows `PATCH` and `DELETE` only for `WEB_ORIGIN` and does not use `*`.
- [x] PASS — `apps/web` is unchanged.
- [x] PASS — GitHub Actions is unchanged and does not start PostgreSQL.
- [x] PASS — No Phase 6 or later work is included.
