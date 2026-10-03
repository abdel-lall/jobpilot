# Phase 11 — Validation

Validation passed on 2026-10-03. Review passed with no changes required before commit. The low finding, unsupported methods on `/mcp` leaving the socket open, was fixed afterward. The MCP suite and `@jobpilot/portfolio-mcp` typecheck were run again after that fix.

## Acceptance criteria

- PASS — `apps/portfolio-mcp` serves the seven exact tools over Streamable HTTP using the official MCP TypeScript SDK.
- PASS — Each tool returns only the context user's profile rows, in the Phase 11 JSON, with `userId` omitted.
- PASS — `get_candidate_profile` matches the five section tools and does not include resume files, jobs, or account secrets.
- PASS — `get_project_details` returns one project owned by the context user.
- PASS — A tool argument that names another user does not change which rows are returned.
- PASS — The other user's records, resume file metadata, and password hashes are absent from the first user's tool results.
- PASS — `POST /mcp` without a matching `MCP_SHARED_SECRET`, or with an invalid user id, returns `401` and `{ "error": "Unauthorized" }` and does not run a tool.
- PASS — Compose starts `portfolio-mcp` beside the API. No AI workflow calls the server.
- PASS — No migration is added. `search_candidate_experience` is not registered.
- PASS — Existing auth, profile, resume, and jobs tests still pass. `GET /health` still returns `200` and `{"status":"ok"}`.

## Required automated tests

- PASS — Vitest with the MCP client, executed by `pnpm --filter @jobpilot/portfolio-mcp test` against the Compose database: 3 tests passed. Two seeded users each have one skill, one education row, one work-experience row, two projects, and one certification. The first user has one `ResumeFile` row and no file on disk. Under the first user's header, all seven tools return that user's Phase 11 JSON. `get_candidate_profile` matches the five section arrays. `get_project_details` returns the owned project. `get_skills` with the second user's id still returns the first user's skills. `get_project_details` for the first user's project, while also passing the second user's id, still returns the first user's project. The second user's project id returns `Not found`. A non-UUID `projectId` returns `Invalid input`. The second user's fact text, the resume file name, `storagePath`, both password hashes, both emails, and `"userId"` are absent from every successful result. A second client with the second user's header returns `beta-skill` and does not return `alpha-skill`. `tools/list` is the seven exact tools and does not include `search_candidate_experience`. Tool schemas have no `userId` or `email`. `POST /mcp` without the secret, and `POST /mcp` with the secret and `not-a-uuid`, each return `401` and `{ "error": "Unauthorized" }`. `GET`, `DELETE`, `PUT`, `PATCH`, and `OPTIONS` on `/mcp` return `405` and that method-not-allowed JSON. `HEAD` returns `405` with `content-type: application/json` and the content length of that JSON. `POST /health` returns `404` and `{ "error": "Not found" }`. The run deletes the users it created. Checked again while writing this record. `GEMINI_API_KEY` was unset.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `MCP_SHARED_SECRET` unset: 4 tests passed. API unit tests 2/2 and AI tests 2/2. The MCP suite is not part of this command.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 41 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm typecheck` succeeded for the whole monorepo during implementation. `@jobpilot/portfolio-mcp` typecheck was run again after the method-status fix. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 18 tests passed. The Phase 4, Phase 6, Phase 7, and Phase 9 cases still pass. This phase adds no Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate status` reports 6 migrations and the schema up to date. None of them is a Phase 11 migration. Checked again while writing this record. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`. Checked again while writing this record.
2. PASS — `docker compose up --build -d` started `postgres`, `api`, `web`, and `portfolio-mcp`. The MCP container log is `portfolio-mcp listening on port 3010`.
3. PASS — `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returned `401` and `{"error":"Unauthorized"}`. Checked again while writing this record.
4. PASS — The MCP Vitest run is the check that a trusted header returns only that user's profile and that resume files are absent.
5. PASS — The running web container has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only. It has no `MCP_SHARED_SECRET`, `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`. The running API container has no `MCP_SHARED_SECRET`. The MCP container has `MCP_PORT`, `DATABASE_URL`, and `MCP_SHARED_SECRET`. Checked again while writing this record. The MCP log does not include the secret or profile fields.

## Commands run

Commands ran from the repository root on 2026-10-03. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset. The fresh Postgres volume had no tables, so the existing migrations were applied with `prisma migrate deploy` before the database-backed tests. That command did not add a Phase 11 migration.

While writing this record, `prisma migrate status`, the MCP suite, `@jobpilot/portfolio-mcp` typecheck, both curls, the container environment inspection, and the MCP log were checked again. Install, the full monorepo typecheck, root `pnpm test`, the API suites, the Compose rebuild, and Playwright were not repeated.

- `pnpm install` — succeeded during implementation.
- `pnpm typecheck` — succeeded for the whole monorepo during implementation. After the method-status fix, `pnpm --filter @jobpilot/portfolio-mcp typecheck` succeeded again while writing this record. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u MCP_SHARED_SECRET pnpm test` — succeeded during implementation. 4 tests passed: API unit tests 2/2 and AI tests 2/2.
- `docker compose up -d postgres` — Postgres was already running for the later checks. A fresh volume was migrated with `prisma migrate deploy` during implementation.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 6 migrations found. Schema up to date. Checked again while writing this record. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:jobs` — succeeded. 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase11-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — succeeded during implementation, again after the method-status fix, and again while writing this record. 3 tests passed. Exit code 0.
- `docker compose up --build -d` — rebuilt and started `postgres`, `api`, `web`, and `portfolio-mcp`. Exit code 0. This image was built before the method-status fix.
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp` — `401` and `{"error":"Unauthorized"}`. Checked again while writing this record.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`. Checked again while writing this record.
- `docker inspect` of `jobpilot-web-1`, `jobpilot-api-1`, and `jobpilot-portfolio-mcp-1` — web has neither the MCP secret nor the API secrets. API has no `MCP_SHARED_SECRET`. Checked again while writing this record.
- `docker logs jobpilot-portfolio-mcp-1` — `portfolio-mcp listening on port 3010`. No secret or profile text. Checked again while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 18 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright, the MCP suite, or PostgreSQL.
- The review did not re-run the validation command list. It compared the diff with the spec.
- `pnpm install`, full `pnpm typecheck`, root `pnpm test`, the API suites, the Compose rebuild, and Playwright were not repeated while writing this record. Those commands succeeded during implementation, after the source files for that run were saved.
- The Compose image was built before unsupported methods on `/mcp` were changed to `405`. The in-process MCP suite covers that response. The running container was not rebuilt, so that image was not checked for `PUT`, `PATCH`, `OPTIONS`, or `HEAD`.
- The MCP suite does not call `get_project_details` with `projectId` omitted, and it does not call the tools with a valid user id that has no rows. A non-UUID `projectId` returns `Invalid input`. The queries filter only on the header user id.
- The manual checks were not repeated in a separate interactive browser session. Existing browser flows passed in Playwright. Health, the unauthorized MCP request, migration status, container environment, and the MCP log were checked again while writing this record.

## Completion checklist

- [x] PASS — `apps/portfolio-mcp` serves the seven exact tools over Streamable HTTP.
- [x] PASS — Tool schemas and results contain no user id or other identity field.
- [x] PASS — The user comes only from `x-jobpilot-user-id` after the shared secret matches.
- [x] PASS — A tool argument cannot select another user.
- [x] PASS — `get_project_details` returns one project owned by the context user, or `Not found`.
- [x] PASS — Uploaded resume files are not returned.
- [x] PASS — No vector query and no `search_candidate_experience` tool.
- [x] PASS — No AI workflow calls the server.
- [x] PASS — Compose starts the MCP server beside the API.
- [x] PASS — No new migration.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — `.github/workflows/ci.yml` is unchanged.
- [x] PASS — No Phase 12 or later work is included.
