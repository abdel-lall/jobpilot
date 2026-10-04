# Phase 13 — Validation

Validation passed on 2026-10-03. The implementation review passed with no required code changes. Every command in this file was run after that review, from the repository root, on branch `phase/13-tailored-resume-workflow`.

## Acceptance criteria

- PASS — A job with a current analysis gets one stored resume whose claims cite that user's real profile record ids.
- PASS — Generating again replaces that row and leaves the job with one current resume.
- PASS — A result with an unknown source id, a wrong-type source id, or another user's source id is rejected and leaves the previous resume unchanged.
- PASS — A result that cites real records but adds a numeric metric, technology, employer, job title, date, or accomplishment absent from those records is rejected and leaves the previous resume unchanged.
- PASS — A result whose claims stay within the cited records, including a rewritten bullet that only adds an analysis keyword, is saved.
- PASS — A project item accepts `startDate` and `endDate` as a calendar date or `null`. Grounding still requires both fields to equal the cited project record, including `null`.
- PASS — The workflow has no profile data until a tool returns it. The prompt prefix through `MCP tool results:` has no profile dump.
- PASS — `search_candidate_experience` is called for retrieval. `get_candidate_profile` and `get_project_details` are not called.
- PASS — A description change leaves the job without a current resume until generation runs again. A failed analysis leaves the previous resume in place.
- PASS — Another user cannot generate or read the resume.
- PASS — Uploaded resume files are not part of the prompt or the stored document.
- PASS — Only the resume-tailoring workflow calls MCP. Job analysis does not.
- PASS — Existing auth, profile, resume-file, jobs, and MCP behavior still passes.
- PASS — No Phase 14 or later work is included.

## Required automated tests

- PASS — Vitest in `packages/ai`: `tailored-resume.test.ts` 8 tests passed inside root `pnpm test`. Search runs once before the five section tools and `write`. The search query and the prompt prefix through `MCP tool results:` omit `Secret Employer`, and that string appears in the full prompt as tool text. `get_candidate_profile` and `get_project_details` are not called. `{ "extra": true }` and invalid tool JSON reject, and invalid JSON does not call `write`. `GEMINI_API_KEY` is unset. No network call.
- PASS — Vitest in `packages/ai`: the same file rejects an unknown source id and a source id from the wrong section. It rejects an unsupported numeric metric, technology, employer, job title, date, and accomplishment. An exact copy is accepted. `Led the API migration for reliability` is accepted when `reliability` is an analysis keyword. A project whose cited record has `startDate: null` is accepted when the resume item also has `startDate: null`, and rejected when that field is a different calendar date.
- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:tailored-resume` against the Compose database: 9 tests passed. The app uses `createStubResumeModel()` and an injected tool client. `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_URL`, and `MCP_SHARED_SECRET` are unset in that file. Generate stores one document and `tailoredResumePresent` becomes `true`. A second generate replaces that row. Unknown, wrong-type, and cross-user source ids return `502` and `{ "error": "Resume generation failed" }` without replacing the stored document. An added `Kubernetes` technology does the same. The other user receives `404` on generate and read. Missing or stale analysis returns `409` and does not call the tool client. A description change clears the resume. A failed analysis keeps it. A title-only patch keeps it. Job delete removes it. The recorded prompt omits the uploaded file name and `storagePath`.
- PASS — The same API test file asserts `createResumeToolClient` sends `x-jobpilot-mcp-secret` and `x-jobpilot-user-id`, and that the user id is not in the recorded request body.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, and `MCP_SHARED_SECRET` unset: 14 tests passed. API unit tests 2/2 and AI tests 12/12 (`embedding.test.ts` 2, `job-analysis.test.ts` 2, `tailored-resume.test.ts` 8). Exit code 0.
- PASS — `pnpm typecheck` succeeded for the whole monorepo. Exit code 0.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 18 tests passed. Compose was started with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and `GEMINI_API_KEY` empty. The existing jobs case still expects tailored resume text `Not available`. This phase adds no Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `prisma migrate status` reports 8 migrations and the schema is up to date. The migration directories are the earlier seven plus `20261003160000_tailored_resume`. `git diff` shows no changes to the earlier seven migration directories or to `.github/workflows/ci.yml`. `TailoredResume.jobId` is unique and the foreign key is `ON DELETE CASCADE`. `\dt` lists the existing tables plus `TailoredResume`. No plan or attempt table is present.
2. PASS — `GET http://localhost:3000/health` returned `{"status":"ok"}`. A follow-up of the same request with response headers showed `HTTP/1.1 200 OK`.
3. PASS — `docker compose up --build -d` started `postgres`, `api`, `web`, and `portfolio-mcp`. The API has `RESUME_MODEL=stub`, `MCP_URL=http://portfolio-mcp:3010/mcp`, and `MCP_SHARED_SECRET=dev-only-change-me`. `GEMINI_API_KEY` is empty. The web service has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults. It has no Gemini, resume-model, JWT, database, or MCP setting.
4. PASS — `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returned `401` and `{"error":"Unauthorized"}`.
5. PASS — `createResumeToolClient` is called from the tailored-resume service. `packages/ai` does not import `@modelcontextprotocol/sdk`. Job analysis does not call MCP. `<=>` remains only in `apps/portfolio-mcp/src/search.ts`.
6. PASS — The MCP log is `portfolio-mcp listening on port 3010`. The API log is `API listening on port 3000`. Neither log includes `GEMINI_API_KEY`, `MCP_SHARED_SECRET`, profile fields, prompts, or resume documents.

## Commands run

Commands ran from the repository root on 2026-10-03. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset.

- `pnpm install` — already up to date. Prisma Client generated. Exit code 0.
- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u MCP_SHARED_SECRET pnpm test` — 14 tests passed. API 2/2 and AI 12/12. Exit code 0.
- `docker compose up -d postgres` — `jobpilot-postgres-1` was already running. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — 8 migrations found. No pending migrations. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 8 migrations found. Database schema is up to date. Exit code 0.
- `docker compose exec postgres psql -U postgres -c "\d \"TailoredResume\""` — `jobId` is `text NOT NULL` with unique index `TailoredResume_jobId_key`. Foreign key `TailoredResume_jobId_fkey` references `Job(id)` `ON UPDATE CASCADE ON DELETE CASCADE`. `document` is `jsonb NOT NULL`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase13-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed. Exit code 0.
- `docker compose up --build -d` — rebuilt and started `postgres`, `api`, `web`, and `portfolio-mcp`. Exit code 0.
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp` — `HTTP/1.1 401 Unauthorized` and `{"error":"Unauthorized"}`.
- `curl -sS http://localhost:3000/health` — `{"status":"ok"}`. Follow-up with response headers: `HTTP/1.1 200 OK`.
- `docker inspect` of `jobpilot-web-1`, `jobpilot-api-1`, and `jobpilot-portfolio-mcp-1` — web has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus Node image defaults. API has `RESUME_MODEL=stub`, `MCP_URL=http://portfolio-mcp:3010/mcp`, `MCP_SHARED_SECRET=dev-only-change-me`, and empty `GEMINI_API_KEY`.
- `docker logs jobpilot-portfolio-mcp-1` — `portfolio-mcp listening on port 3010`.
- `docker logs jobpilot-api-1` — `API listening on port 3000`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 18 tests passed. Exit code 0.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright, the MCP suite, the tailored-resume suite, or PostgreSQL.
- Live Gemini was not called. `createGeminiResumeModel` is not invoked by the automated tests.
- `prisma migrate deploy` found the tailored-resume migration already applied, so this run did not execute that SQL again. `migrate status` reports the schema is up to date, and `\d "TailoredResume"` matches the migration.

## Completion checklist

- [x] PASS — A current analysis can generate one stored resume that cites real profile record ids.
- [x] PASS — Generating again replaces that row.
- [x] PASS — Unknown, wrong-type, and other-user source ids are rejected and do not replace the stored resume.
- [x] PASS — An unsupported numeric metric, technology, employer, job title, date, or accomplishment is rejected and does not replace the stored resume.
- [x] PASS — A grounded resume, including a bullet that only adds an analysis keyword, is saved.
- [x] PASS — A project `startDate` or `endDate` may be a calendar date or `null`, and grounding still requires exact equality with the cited project.
- [x] PASS — The initial prompt has no profile data. Search runs before the model.
- [x] PASS — `get_candidate_profile` is not called. Only resume tailoring calls MCP.
- [x] PASS — A description change clears the resume. A failed analysis does not.
- [x] PASS — Another user cannot generate or read the resume.
- [x] PASS — Uploaded resume files are not sent to the workflow.
- [x] PASS — `tailoredResumePresent` is true only when the row exists. The dashboard label stays `Not available`.
- [x] PASS — Compose uses the stub resume model unless `RESUME_MODEL` is set.
- [x] PASS — The web service does not receive Gemini, resume-model, JWT, database, or MCP secrets.
- [x] PASS — `pnpm --filter @jobpilot/api test:tailored-resume` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, and `MCP_SHARED_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — `.github/workflows/ci.yml` is unchanged.
- [x] PASS — No Phase 14 or later work is included.
