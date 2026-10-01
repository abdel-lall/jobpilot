# Phase 5 — Validation

Not started. Do not mark an item PASS until the command, test, or inspection has actually succeeded.

## Acceptance criteria

- [ ] The owner can create, list, update, and delete a skill, an education record, a work experience record, a project, and a certification.
- [ ] List returns only the authenticated user's rows, ordered by `createdAt` ascending and then `id` ascending. Another user's rows are absent.
- [ ] A second user who updates or deletes the first user's record receives `404` and `{ "error": "Not found" }`, the same response as a missing id.
- [ ] Missing or invalid fields are rejected with `400` and `{ "error": "Invalid input" }`. A body that includes `userId` or another unknown key is rejected.
- [ ] A partial date patch is checked against the merged record after ownership is established. A `startDate` later than the stored `endDate`, an `endDate` earlier than the stored `startDate`, or an `issuedOn` later than the stored `expiresOn` returns `400` and `{ "error": "Invalid input" }` and does not change the row.
- [ ] Accomplishments and technologies are stored trimmed, in input order, including duplicate trimmed values. An item that is empty after trimming is rejected.
- [ ] `userId` on a created record is the access token's user. The client cannot assign a different user.
- [ ] A request without a valid access token is rejected with `401` and `{ "error": "Unauthorized" }`.
- [ ] Nullable fields can be cleared with `null` on update. Omitted patch fields stay unchanged.
- [ ] The new migration adds only `Skill`, `Education`, `WorkExperience`, `Project`, and `Certification`. `User` and `RefreshSession` columns are unchanged. The `vector` extension remains installed. No embedding column is added.
- [ ] `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`. `GET /health` still returns success without those variables.
- [ ] Credentialed CORS still allows only `WEB_ORIGIN`, and preflight allows `PATCH` and `DELETE`.
- [ ] The Phase 3 auth contract still passes. `apps/web` is unchanged.
- [ ] No profile UI, resume-file storage, jobs, AI, MCP, or embedding behavior is added.

## Required automated tests

- [ ] Supertest, executed only by `pnpm --filter @jobpilot/api test:profile` against the Compose database: CRUD for each record type, validation failures, a rejected `userId` in the body, cross-user list exclusion, cross-user update and delete, missing access token, and credentialed preflight for `PATCH` and `DELETE`.
- [ ] The same `test:profile` run covers a partial PATCH whose merged range is invalid: `startDate` after the stored `endDate`, `endDate` before the stored `startDate`, and `issuedOn` after the stored `expiresOn`. Each response is `400` with `{ "error": "Invalid input" }`, and a following list shows the original dates.
- [ ] The same `test:profile` run stores accomplishments and technologies with each item trimmed, in the submitted order, keeping a repeated trimmed value. An item that trims to an empty string returns `400` and does not replace the stored array.
- [ ] Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database.
- [ ] Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset, including the health route and the Argon2id unit test.
- [ ] The Phase 2 database integration test still passes when `DATABASE_URL` points at Compose.

Playwright is not required. Gemini is not called. GitHub Actions is not given a PostgreSQL service.

## Manual verification

1. Apply the new migration to Compose. Confirm `vector` is still installed.
2. Confirm public tables are the Phase 2 and Phase 3 tables plus `Skill`, `Education`, `WorkExperience`, `Project`, and `Certification`.
3. With a bearer token from `POST /auth/login`, create one skill and list it. A second user lists skills and does not see that row. The second user's `PATCH` and `DELETE` of that id return `404`.
4. Send a skill body that includes `userId` and confirm `400`.
5. Confirm `GET /health` still returns `200` and `{"status":"ok"}`.
6. Confirm `apps/web` has no profile pages and still has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
7. Delete the manual users afterward.

## Commands

Run these from the repository root. Set `DATABASE_URL` and `JWT_SECRET` only in the shell for Prisma migrate and the database-backed tests.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`
- `docker compose exec postgres psql -U postgres -c "\dt"`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase5-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase5-validation-secret pnpm --filter @jobpilot/api test:profile`
- `curl -sS http://localhost:3000/health` after the API is running, if Compose is rebuilt

Do not add these tests to GitHub Actions.

## Completion checklist

- [ ] `POST`, `GET`, `PATCH`, and `DELETE` exist for skills, education, experience, projects, and certifications.
- [ ] The owner can create, list, partially update, and delete each record type.
- [ ] List is scoped to the access token and ordered by `createdAt`, then `id`.
- [ ] Another user cannot see, update, or delete the first user's records. Update and delete of a foreign id return `404`.
- [ ] Invalid fields, an empty patch, a body that contains `userId`, and a partial date patch whose merged range is invalid return `400` and `{ "error": "Invalid input" }`. The invalid date patch leaves the stored row unchanged.
- [ ] Accomplishments and technologies are trimmed before storage, validated after trimming, stored in input order, and not sorted or deduplicated. An item that is empty after trimming is rejected.
- [ ] A missing or invalid access token returns `401` and `{ "error": "Unauthorized" }`.
- [ ] Zod schemas for all five record types live in `packages/shared`.
- [ ] Profile logic lives outside controllers.
- [ ] The new migration adds only the five profile tables. Earlier migrations are unchanged.
- [ ] No embedding column, vector index, or resume-file table is added.
- [ ] `createApp()` does not require `DATABASE_URL` or `JWT_SECRET`.
- [ ] `GET /health` still passes with `pnpm test` when `DATABASE_URL` and `JWT_SECRET` are unset.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes against Compose.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm typecheck` passes.
- [ ] The Phase 2 database integration test passes.
- [ ] CORS allows `PATCH` and `DELETE` only for `WEB_ORIGIN` and does not use `*`.
- [ ] `apps/web` is unchanged.
- [ ] GitHub Actions is unchanged and does not start PostgreSQL.
- [ ] No Phase 6 or later work is included.
