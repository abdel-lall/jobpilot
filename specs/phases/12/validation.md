# Phase 12 — Validation

Validation passed on 2026-10-03. The first review found one blocking issue: the Gemini client still flattened newlines. That was fixed, and the second review passed with no changes required before commit. After that fix, typecheck, root `pnpm test`, the MCP suite, migration status, the column inspection, health, the unauthorized MCP request, container environment, and both service logs were checked again.

## Acceptance criteria

- PASS — Saving work experience or a project stores a 768-dimension embedding, and deleting that record removes the embedding.
- PASS — The embedded text is the Phase 12 document for the stored record. An update embeds the merged record.
- PASS — A failed embedding on create leaves no new row and no embedding.
- PASS — A failed embedding on update leaves the previous row and the previous embedding unchanged.
- PASS — The failure response is `502` and `{ "error": "Embedding failed" }`.
- PASS — Skill, education, certification, resume, and job writes do not embed.
- PASS — `search_candidate_experience` returns the context user's experience and projects, nearest first, at most 8 matches, in the Phase 12 JSON.
- PASS — Another user's records are absent, including a nearer vector.
- PASS — The tool schema has no user id. A tool argument cannot select another user.
- PASS — The only database code that uses a vector distance operator is the search tool. The operator is `<=>`.
- PASS — Skills, education, certifications, uploaded files, and interview questions are not embedded.
- PASS — No workflow queries pgvector. No AI workflow calls the MCP server.
- PASS — Existing auth, profile, resume, and jobs behavior still passes. Profile JSON does not include the vector.
- PASS — No Phase 13 or later work is included.

## Required automated tests

- PASS — Vitest in `packages/ai`: the stub embedding client returns 768 finite numbers, index 0 is `1`, and the Euclidean norm is 1 for both methods and any string. A second test builds `createGeminiEmbeddingClient` with a dummy key and model name and expects `stripNewLines === false` on both instances. It does not call `embedDocument` or `embedQuery`. `GEMINI_API_KEY` is unset. No network call. Checked again while writing this record as part of root `pnpm test`: `embedding.test.ts` 2 tests and `job-analysis.test.ts` 2 tests.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:profile` against the Compose database: 45 tests passed. The main app uses `createStubEmbeddingClient()`. `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, and `EMBEDDING_MODEL` are unset. Existing profile cases still pass. A create stores the stub vector, an update replaces it and calls `embedDocument` with the merged document, and a delete removes the row. A rejecting client on create leaves no row. A rejecting client on update leaves the previous fields and the previous vector. Both failures are `502` and `{ "error": "Embedding failed" }`. Skill, education, and certification creates do not call the client. An experience create with no injected client returns `502` and writes nothing.
- PASS — Vitest with the MCP client, executed by `pnpm --filter @jobpilot/portfolio-mcp test` against the Compose database: 6 tests passed. Checked again while writing this record. The seven Phase 11 tools still pass. `tools/list` includes `search_candidate_experience` and does not include a user id on that schema. Two seeded users: the first has one experience and one project with known vectors, and the second has a nearer experience vector. Search returns the first user's nearer record, then the farther record, and omits the second user's fact text. An extra `userId` argument does not change that order. A missing or overlong `query` returns `Invalid input` and does not embed. A rejecting client returns `Search failed`. Eight combined matches are kept and null embeddings are omitted. `GEMINI_API_KEY` is unset. The run deletes the users it created.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, and `MCP_SHARED_SECRET` unset: 6 tests passed. API unit tests 2/2 and AI tests 4/4. Checked again while writing this record. The MCP suite is not part of this command.
- PASS — `pnpm typecheck` succeeded for the whole monorepo during implementation and again while writing this record, after the newline fix. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `EMBEDDING_MODEL=stub` and `GEMINI_API_KEY` unset: 18 tests passed. The existing profile case still creates, edits, and deletes experience and projects. This phase adds no Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate status` reports 7 migrations, including `20261003120000_experience_project_embedding`, and the schema is up to date. Checked again while writing this record. The earlier six migrations are unchanged. `embedding` on `WorkExperience` and `Project` is `vector(768)` and nullable. No new table is present. `\dt` lists the existing profile, resume, job, and job-analysis tables only.
2. PASS — `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`. Checked again while writing this record.
3. PASS — `docker compose up --build -d` started `postgres`, `api`, `web`, and `portfolio-mcp`. The API and MCP services have `EMBEDDING_MODEL=stub`. `GEMINI_API_KEY` and `GEMINI_EMBEDDING_MODEL` are empty. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only. Checked again while writing this record.
4. PASS — `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returned `401` and `{"error":"Unauthorized"}`. Checked again while writing this record.
5. PASS — `<=>` appears only in `apps/portfolio-mcp/src/search.ts`. `<->` and `<#>` do not appear. Profile and job routes do not query vectors. `packages/ai` does not query vectors. The only LangGraph workflow is the existing job-analysis graph.
6. PASS — The MCP log is `portfolio-mcp listening on port 3010`. The API log is `API listening on port 3000`. Neither log includes `GEMINI_API_KEY`, profile documents, or vectors. Checked again while writing this record.

## Commands run

Commands ran from the repository root on 2026-10-03. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

While writing this record, `pnpm typecheck`, root `pnpm test`, the MCP suite, `prisma migrate status`, both column inspections, both curls, the container environment inspection, and both service logs were checked again. Install, `prisma migrate deploy`, the API suites, the Compose rebuild, and Playwright were not repeated. Those commands succeeded during implementation, before the newline fix. That fix does not change the stub client those suites use.

- `pnpm install` — succeeded during implementation. Exit code 0.
- `pnpm typecheck` — succeeded during implementation and again while writing this record, after the newline fix. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u MCP_SHARED_SECRET pnpm test` — succeeded during implementation with 5 tests (API 2/2 and AI 3/3). Checked again while writing this record: 6 tests passed, API 2/2 and AI 4/4. Exit code 0.
- `docker compose up -d postgres` — Postgres was started for the database-backed tests.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — applied the embedding migration during implementation. Exit code 0. Not repeated while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 7 migrations found. Schema up to date. Checked again while writing this record. Exit code 0.
- `docker compose exec postgres psql -U postgres -c "\d \"WorkExperience\""` — `embedding` is nullable `vector(768)`. Checked again while writing this record.
- `docker compose exec postgres psql -U postgres -c "\d \"Project\""` — `embedding` is nullable `vector(768)`. Checked again while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 45 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:jobs` — succeeded. 14 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase12-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — succeeded during implementation and again while writing this record. 6 tests passed. Exit code 0.
- `docker compose up --build -d` — rebuilt and started `postgres`, `api`, `web`, and `portfolio-mcp` with Gemini and embedding variables unset in the shell, so Compose used `EMBEDDING_MODEL=stub`. Exit code 0. This image was built before the newline fix.
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp` — `401` and `{"error":"Unauthorized"}`. Checked again while writing this record.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`. Checked again while writing this record.
- `docker inspect` of `jobpilot-web-1`, `jobpilot-api-1`, and `jobpilot-portfolio-mcp-1` — web has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only. API and MCP have `EMBEDDING_MODEL=stub` and empty Gemini settings. Checked again while writing this record.
- `docker logs jobpilot-portfolio-mcp-1` — `portfolio-mcp listening on port 3010`. Checked again while writing this record.
- `docker logs jobpilot-api-1` — `API listening on port 3000`. Checked again while writing this record.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 18 tests passed.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright, the MCP suite, or PostgreSQL.
- Live Gemini was not called. The newline fix is covered by the unit test that reads `stripNewLines` and does not call the network.
- The Compose image was built before `stripNewLines` was set after construction. Compose uses the stub client, so that image does not exercise the Gemini client. The running containers were not rebuilt.
- `pnpm install`, `prisma migrate deploy`, the API suites, and Playwright were not repeated after the newline fix. Those commands succeeded during implementation.
- These spec paths are implemented and are not covered by a separate test: a project create or update whose embedding fails, search with no injected client, equal-distance ordering by `createdAt` then `id`, an experience document whose end date is `Present` or whose technologies line is `none`, and an invalid merged date range returning `400` without an embedding call. Resume and job routers never receive an embedding client.

## Completion checklist

- [x] PASS — Saving experience or a project stores an embedding, and deleting it removes that embedding.
- [x] PASS — A failed embedding on create leaves no new row and no embedding.
- [x] PASS — A failed embedding on update leaves the previous row and embedding unchanged.
- [x] PASS — Search results come from the context user's experience and projects, nearest first.
- [x] PASS — Another user's similar records are absent.
- [x] PASS — The only database code that queries vectors is the search tool.
- [x] PASS — Skills, education, certifications, resume files, and interview questions are not embedded.
- [x] PASS — No workflow queries pgvector, and no AI workflow calls the MCP server.
- [x] PASS — Profile JSON does not include the vector.
- [x] PASS — Compose uses the stub embedding client unless `EMBEDDING_MODEL` is set.
- [x] PASS — The web service does not receive Gemini, embedding, JWT, database, or MCP secrets.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — `.github/workflows/ci.yml` is unchanged.
- [x] PASS — No Phase 13 or later work is included.
