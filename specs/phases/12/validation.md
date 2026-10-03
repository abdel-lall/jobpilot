# Phase 12 — Validation

## Result

Not started.

## Acceptance criteria

- Saving work experience or a project stores a 768-dimension embedding, and deleting that record removes the embedding.
- The embedded text is the Phase 12 document for the stored record. An update embeds the merged record.
- A failed embedding on create leaves no new row and no embedding.
- A failed embedding on update leaves the previous row and the previous embedding unchanged.
- The failure response is `502` and `{ "error": "Embedding failed" }`.
- Skill, education, certification, resume, and job writes do not embed.
- `search_candidate_experience` returns the context user's experience and projects, nearest first, at most 8 matches, in the Phase 12 JSON.
- Another user's records are absent, including a nearer vector.
- The tool schema has no user id. A tool argument cannot select another user.
- The only database code that uses a vector distance operator is the search tool. The operator is `<=>`.
- Skills, education, certifications, uploaded files, and interview questions are not embedded.
- No workflow queries pgvector. No AI workflow calls the MCP server.
- Existing auth, profile, resume, and jobs behavior still passes. Profile JSON does not include the vector.
- No Phase 13 or later work is included.

## Required automated tests

- Vitest in `packages/ai`: the stub embedding client returns 768 finite numbers, index 0 is `1`, the Euclidean norm is 1, and both methods do that for any string. `GEMINI_API_KEY` is unset. No network call. This test is part of root `pnpm test`.
- Supertest, executed by `pnpm --filter @jobpilot/api test:profile` against the Compose database. The main app uses `createStubEmbeddingClient()`. `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, and `EMBEDDING_MODEL` are unset. Existing profile cases still pass. A create stores the stub vector, an update replaces it and calls `embedDocument` with the merged document, and a delete removes the row. A rejecting client on create leaves no row. A rejecting client on update leaves the previous fields and the previous vector. Both failures are `502` and `{ "error": "Embedding failed" }`. Skill, education, and certification creates do not call the client. An experience create with no injected client returns `502` and writes nothing.
- Vitest with the MCP client, executed by `pnpm --filter @jobpilot/portfolio-mcp test` against the Compose database. The seven Phase 11 tools still pass. `tools/list` includes `search_candidate_experience` and does not include a user id on that schema. Two seeded users: the first has one experience and one project with known vectors, and the second has a nearer experience vector. Search returns the first user's nearer record, then the farther record, and omits the second user's fact text. An extra `userId` argument does not change that order. A missing or overlong `query` returns `Invalid input` and does not embed. A rejecting client returns `Search failed`. `GEMINI_API_KEY` is unset. The run deletes the users it created.
- `pnpm --filter @jobpilot/api test:auth` passes.
- `pnpm --filter @jobpilot/api test:resumes` passes.
- `pnpm --filter @jobpilot/api test:jobs` passes.
- Root `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, and `MCP_SHARED_SECRET` unset.
- `pnpm typecheck` passes.
- Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `EMBEDDING_MODEL=stub` and `GEMINI_API_KEY` unset. The existing profile case still creates, edits, and deletes experience and projects. This phase adds no Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate status` reports 7 migrations, including the new embedding migration, and the schema is up to date. The earlier six migrations are unchanged. `embedding` on `WorkExperience` and `Project` is `vector(768)` and nullable. No new table is present.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` starts `postgres`, `api`, `web`, and `portfolio-mcp`. The API and MCP services have `EMBEDDING_MODEL=stub` when that variable is unset in the shell. The web service has no Gemini, embedding, JWT, database, or MCP secret.
4. `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returns `401` and `{"error":"Unauthorized"}`.
5. Inspection: `<=>`, `<->`, and `<#>` appear only in the search tool. Profile and job routes do not query vectors. `packages/ai` does not query vectors.
6. The MCP log and the API log do not include `GEMINI_API_KEY`, profile documents, or vectors.

## Commands

Run these from the repository root during validation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test. Leave `GEMINI_API_KEY` unset.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u MCP_SHARED_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `docker compose exec postgres psql -U postgres -c "\d \"WorkExperience\""`
- `docker compose exec postgres psql -U postgres -c "\d \"Project\""`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase12-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase12-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp`
- `curl -sS http://localhost:3000/health`
- `docker inspect` of `jobpilot-web-1`, `jobpilot-api-1`, and `jobpilot-portfolio-mcp-1`
- `docker logs jobpilot-portfolio-mcp-1`
- `docker logs jobpilot-api-1`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`

## Completion checklist

- [ ] Saving experience or a project stores an embedding, and deleting it removes that embedding.
- [ ] A failed embedding on create leaves no new row and no embedding.
- [ ] A failed embedding on update leaves the previous row and embedding unchanged.
- [ ] Search results come from the context user's experience and projects, nearest first.
- [ ] Another user's similar records are absent.
- [ ] The only database code that queries vectors is the search tool.
- [ ] Skills, education, certifications, resume files, and interview questions are not embedded.
- [ ] No workflow queries pgvector, and no AI workflow calls the MCP server.
- [ ] Profile JSON does not include the vector.
- [ ] Compose uses the stub embedding client unless `EMBEDDING_MODEL` is set.
- [ ] The web service does not receive Gemini, embedding, JWT, database, or MCP secrets.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] `.github/workflows/ci.yml` is unchanged.
- [ ] No Phase 13 or later work is included.
