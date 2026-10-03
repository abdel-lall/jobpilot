# Phase 13 — Validation

## Result

Not started.

## Acceptance criteria

- A job with a current analysis gets one stored resume whose claims cite that user's real profile record ids.
- Generating again replaces that row and leaves the job with one current resume.
- A result with an unknown source id, a wrong-type source id, or another user's source id is rejected and leaves the previous resume unchanged.
- A result that cites real records but adds a numeric metric, technology, employer, job title, date, or accomplishment absent from those records is rejected and leaves the previous resume unchanged.
- A result whose claims stay within the cited records, including a rewritten bullet that only adds an analysis keyword, is saved.
- A project item accepts `startDate` and `endDate` as a calendar date or `null`. Grounding still requires both fields to equal the cited project record, including `null`.
- The workflow has no profile data until a tool returns it. The prompt prefix through `MCP tool results:` has no profile dump.
- `search_candidate_experience` is called for retrieval. `get_candidate_profile` and `get_project_details` are not called.
- A description change leaves the job without a current resume until generation runs again. A failed analysis leaves the previous resume in place.
- Another user cannot generate or read the resume.
- Uploaded resume files are not part of the prompt or the stored document.
- Only the resume-tailoring workflow calls MCP. Job analysis does not.
- Existing auth, profile, resume-file, jobs, and MCP behavior still passes.
- No Phase 14 or later work is included.

## Required automated tests

- Vitest in `packages/ai`: stubbed model and MCP client prove search is used before the model, the search query and the prompt prefix omit `Secret Employer`, and that string appears in the full prompt only as tool text. `get_candidate_profile` is not called. An invalid model object rejects. `GEMINI_API_KEY` is unset. No network call. This test is part of root `pnpm test`.
- Vitest in `packages/ai`: `assertTailoredResumeGrounded` rejects an unknown source id and a source id from the wrong section. It rejects an unsupported numeric metric, technology, employer, job title, date, and accomplishment. An exact copy is accepted. `Led the API migration for reliability` is accepted when `reliability` is an analysis keyword. A project whose cited record has `startDate: null` is accepted when the resume item also has `startDate: null`, and rejected when that field is a different calendar date.
- Supertest, executed by `pnpm --filter @jobpilot/api test:tailored-resume` against the Compose database. The app uses `createStubResumeModel()` and an injected tool client. `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_URL`, and `MCP_SHARED_SECRET` are unset. Generate stores one document and `tailoredResumePresent` becomes `true`. A second generate replaces that row. Unknown, wrong-type, and cross-user source ids return `502` and `{ "error": "Resume generation failed" }` without replacing the stored document. An added `Kubernetes` technology does the same. The other user receives `404` on generate and read. Missing or stale analysis returns `409` and does not call the tool client. A description change clears the resume. A failed analysis keeps it. A title-only patch keeps it. Job delete removes it. The recorded prompt omits the uploaded file name and `storagePath`.
- The same API test file asserts `createResumeToolClient` sends `x-jobpilot-mcp-secret` and `x-jobpilot-user-id`, and that the user id is not in the request body.
- `pnpm --filter @jobpilot/api test:auth` passes.
- `pnpm --filter @jobpilot/api test:profile` passes.
- `pnpm --filter @jobpilot/api test:resumes` passes.
- `pnpm --filter @jobpilot/api test:jobs` passes.
- `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- Root `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, and `MCP_SHARED_SECRET` unset.
- `pnpm typecheck` passes.
- Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and `GEMINI_API_KEY` unset. The existing jobs case still shows tailored resume as `Not available`. This phase adds no Playwright case.

Live Gemini is not required. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. `prisma migrate status` reports 8 migrations, including `20261003160000_tailored_resume`, and the schema is up to date. The earlier seven migrations are unchanged. `TailoredResume.jobId` is unique and cascades on job delete. No plan or attempt table is present.
2. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
3. `docker compose up --build -d` starts `postgres`, `api`, `web`, and `portfolio-mcp`. The API has `RESUME_MODEL=stub`, `MCP_URL=http://portfolio-mcp:3010/mcp`, and `MCP_SHARED_SECRET`. The web service has no Gemini, resume-model, JWT, database, or MCP secret.
4. `POST http://localhost:3010/mcp` without `x-jobpilot-mcp-secret` returns `401` and `{"error":"Unauthorized"}`.
5. Inspection: the resume workflow is the only caller of the MCP tool client. `packages/ai` does not import the MCP SDK. Job analysis does not call MCP. `<=>` remains only in `search_candidate_experience`.
6. The API log and the MCP log do not include `GEMINI_API_KEY`, `MCP_SHARED_SECRET`, profile fields, prompts, or resume documents.

## Commands

Run these from the repository root during validation. Set `DATABASE_URL` and `JWT_SECRET` only for Prisma and the database-backed API tests. Set `MCP_SHARED_SECRET` only for the MCP test and the header test's own fixture. Leave `GEMINI_API_KEY` unset.

- `pnpm install`
- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY -u EMBEDDING_MODEL -u RESUME_MODEL -u MCP_SHARED_SECRET pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `docker compose exec postgres psql -U postgres -c "\d \"TailoredResume\""`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase13-validation-secret pnpm --filter @jobpilot/api test:tailored-resume`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase13-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `curl -sS -D - -o - -X POST http://localhost:3010/mcp`
- `curl -sS http://localhost:3000/health`
- `docker inspect` of `jobpilot-web-1`, `jobpilot-api-1`, and `jobpilot-portfolio-mcp-1`
- `docker logs jobpilot-portfolio-mcp-1`
- `docker logs jobpilot-api-1`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`

## Completion checklist

- [ ] A current analysis can generate one stored resume that cites real profile record ids.
- [ ] Generating again replaces that row.
- [ ] Unknown, wrong-type, and other-user source ids are rejected and do not replace the stored resume.
- [ ] An unsupported numeric metric, technology, employer, job title, date, or accomplishment is rejected and does not replace the stored resume.
- [ ] A grounded resume, including a bullet that only adds an analysis keyword, is saved.
- [ ] A project `startDate` or `endDate` may be a calendar date or `null`, and grounding still requires exact equality with the cited project.
- [ ] The initial prompt has no profile data. Search runs before the model.
- [ ] `get_candidate_profile` is not called. Only resume tailoring calls MCP.
- [ ] A description change clears the resume. A failed analysis does not.
- [ ] Another user cannot generate or read the resume.
- [ ] Uploaded resume files are not sent to the workflow.
- [ ] `tailoredResumePresent` is true only when the row exists. The dashboard label stays `Not available`.
- [ ] Compose uses the stub resume model unless `RESUME_MODEL` is set.
- [ ] The web service does not receive Gemini, resume-model, JWT, database, or MCP secrets.
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, and `MCP_SHARED_SECRET` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] `.github/workflows/ci.yml` is unchanged.
- [ ] No Phase 14 or later work is included.
