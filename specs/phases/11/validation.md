# Phase 11 — Validation

Not started.

## Acceptance criteria

- `apps/portfolio-mcp` serves the seven exact tools over Streamable HTTP using the official MCP TypeScript SDK.
- Each tool returns only the context user's profile rows, in the Phase 11 JSON, with `userId` omitted.
- `get_candidate_profile` matches the five section tools and does not include resume files, jobs, or account secrets.
- `get_project_details` returns one project owned by the context user.
- A tool argument that names another user does not change which rows are returned.
- The other user's records, resume file metadata, and password hashes are absent from the first user's tool results.
- `POST /mcp` without a matching `MCP_SHARED_SECRET`, or with an invalid user id, returns `401` and `{ "error": "Unauthorized" }` and does not run a tool.
- Compose starts `portfolio-mcp` beside the API. No AI workflow calls the server.
- No migration is added. `search_candidate_experience` is not registered.
- Existing auth, profile, resume, and jobs tests still pass. `GET /health` still returns `200` and `{"status":"ok"}`.

## Required automated tests

- Vitest with the MCP client, executed by `pnpm --filter @jobpilot/portfolio-mcp test` against the Compose database: each of the seven tools for two seeded users, including a call that passes the other user's id.
- Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `MCP_SHARED_SECRET` unset. The MCP suite is not part of this command.
- `pnpm --filter @jobpilot/api test:auth`
- `pnpm --filter @jobpilot/api test:profile`
- `pnpm --filter @jobpilot/api test:resumes`
- `pnpm --filter @jobpilot/api test:jobs`
- `pnpm typecheck`
- `pnpm --filter @jobpilot/web test:e2e` against Compose, to confirm the existing browser flows still pass after the MCP service is added. This phase does not add a Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate status` reports the schema up to date, with no Phase 11 migration. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. `docker compose up --build -d` starts `postgres`, `api`, `web`, and `portfolio-mcp`. The MCP container is listening on port `3010`.
3. `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returns `401` and `{ "error": "Unauthorized" }`.
4. The MCP Vitest run is the check that a trusted header returns only that user's profile and that resume files are absent.
5. The running web container has no `MCP_SHARED_SECRET`, `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`. The API container has no `MCP_SHARED_SECRET`.

## Commands

Run these from the repository root after implementation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u MCP_SHARED_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase11-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase11-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp`
- `curl -sS http://localhost:3000/health`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`

## Completion checklist

- [ ] `apps/portfolio-mcp` serves the seven exact tools over Streamable HTTP.
- [ ] Tool schemas and results contain no user id or other identity field.
- [ ] The user comes only from `x-jobpilot-user-id` after the shared secret matches.
- [ ] A tool argument cannot select another user.
- [ ] `get_project_details` returns one project owned by the context user, or `Not found`.
- [ ] Uploaded resume files are not returned.
- [ ] No vector query and no `search_candidate_experience` tool.
- [ ] No AI workflow calls the server.
- [ ] Compose starts the MCP server beside the API.
- [ ] No new migration.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] `.github/workflows/ci.yml` is unchanged.
- [ ] No Phase 12 or later work is included.
