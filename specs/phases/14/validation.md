# Phase 14 — Validation

Validation passed on 2026-10-04. The implementation review passed with no required code changes. Every command in this file was run after that review, from the repository root, on branch `phase/14-tailored-resume-ui`.

## Acceptance criteria

- PASS — A signed-in user can open `Tailored resume` on a dashboard job row. The panel is not a new URL. Reload still returns to the profile view.
- PASS — Before generation, the panel shows `No tailored resume yet.` and the row's `job-tailored-resume` text is `Not available`.
- PASS — `Generate resume` calls `POST /jobs/:id/tailored-resume` with `{}`. The open panel then shows the stored document, including the profile skill name. The row flag becomes `Present`.
- PASS — Generating again, after a new profile skill exists, replaces the document on the open panel. The new skill appears and the previous skill remains. The panel does not close.
- PASS — A description edit clears the current resume. The row flag returns to `Not available`. The open panel shows `No tailored resume yet.` until the user generates again.
- PASS — A failed generate shows the API `error` string and leaves the previous panel body in place. A failure before any resume exists leaves the empty state.
- PASS — Analysis stays `Current` or `Not available`. Interview plan, score, and readiness stay `Not available`.
- PASS — The resume query key is `["tailored-resume", userId, jobId]`. The GET does not run until the panel is open. Entering `signed-out` removes cached tailored-resume queries. The query cache is not persisted.
- PASS — The web app parses the response with `tailoredResumeSchema` from `@jobpilot/shared`. It does not import `@jobpilot/ai` and has no Gemini key, database URL, MCP secret, or `JWT_SECRET`.
- PASS — No API route, schema, migration, workflow, or MCP tool changes.

## Required automated tests

- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 21 tests passed. Compose was running with `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and an empty `GEMINI_API_KEY`. `portfolio-mcp` was running.
- PASS — The new tailored-resume case registers a unique `phase14-` user, adds the skill `TypeScript`, creates `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, and sees analysis `Current` and tailored resume `Not available`.
- PASS — That case opens the panel, sees `No tailored resume yet.`, generates, and sees `TypeScript` with the flag `Present`. The POST body is a JSON object with no keys.
- PASS — That case adds the skill `Go`, reopens the panel, sees `TypeScript` without `Go`, generates again on the open panel, and sees both names with the flag still `Present`.
- PASS — That case changes the description to `Build reliable APIs.`. Analysis stays `Current`. The flag becomes `Not available`. The panel shows `No tailored resume yet.` and does not show `TypeScript`. Generating again shows `TypeScript` and `Go`, and the flag becomes `Present`.
- PASS — The same `test:e2e` run stubs `POST /jobs/:id/tailored-resume` to `502` with `{ "error": "Resume generation failed" }` before a resume exists. The panel shows that string and `No tailored resume yet.`.
- PASS — The same `test:e2e` run generates a resume that shows `TypeScript`, then stubs the next POST to that same `502`. The panel still shows `TypeScript`, and the flag stays `Present`.
- PASS — The existing jobs case still expects `Not available` on `job-tailored-resume`. The Phase 4, Phase 6, and Phase 7 browser cases passed in the same run. The new test deletes its `phase14-` users through Prisma.
- PASS — `pnpm --filter @jobpilot/api test:tailored-resume`: 9 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:jobs`: 14 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:profile`: 45 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:resumes`: 7 tests passed.
- PASS — `pnpm --filter @jobpilot/api test:auth`: 11 tests passed.
- PASS — `pnpm --filter @jobpilot/portfolio-mcp test`: 6 tests passed.
- PASS — Root `pnpm test` with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset: 14 tests passed. API unit tests 2/2 and AI tests 12/12. Exit code 0.
- PASS — `pnpm typecheck` succeeded for the whole monorepo, including the web app and `tsconfig.e2e.json`. Exit code 0.

Gemini was not called. GitHub Actions was not given a PostgreSQL service or a Playwright job.

## Manual verification

1. PASS — `docker compose up --build -d` left `postgres`, `api`, `web`, and `portfolio-mcp` running. `GET http://localhost:3000/health` returned `{"status":"ok"}`. A follow-up with response headers showed `HTTP/1.1 200 OK`. The API has `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and an empty `GEMINI_API_KEY`.
2. PASS — The Playwright jobs case still starts on the profile view, and `job-tailored-resume` is `Not available` before that case generates a resume. The tailored-resume case asserts `Not available` before it opens the panel. The resume query is created inside the panel component, which is mounted only while that row is open.
3. PASS — The tailored-resume case opens the panel, sees `No tailored resume yet.`, and after generate sees `TypeScript`. The jobs case reloads and returns to the profile view. Opening `Dashboard` again in the tailored-resume case shows the stored skill and `Present`.
4. PASS — The tailored-resume case adds `Go`, generates again on the open panel, and sees both skills. Editing the description to `Build reliable APIs.` sets the row to `Not available` and the panel to `No tailored resume yet.`
5. PASS — The auth case logs out and shows `signed-out`, which unmounts the signed-in shell and the panel. The jobs case still rejects another user's cached jobs. `JobsQueryCache` removes tailored-resume queries when the session is `signed-out` and when the user id changes.
6. PASS — `http://localhost:5173/src/main.tsx`, `/src/jobs/tailored-resume.ts`, and `/src/jobs/tailored-resume-panel.tsx` each returned `200` and contained none of `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_SHARED_SECRET`, `MCP_URL`, or `@jobpilot/ai`. The web container environment has `VITE_API_ORIGIN` and `API_PROXY_TARGET` only, plus the Node image defaults.

## Commands run

Commands ran from the repository root on 2026-10-04. `DATABASE_URL` and `JWT_SECRET` were set only for Prisma and the database-backed API tests. `MCP_SHARED_SECRET` was set only for the MCP test. `GEMINI_API_KEY` stayed unset for the root test.

- `pnpm typecheck` — succeeded for shared, database, AI, web, portfolio-mcp, and API. Exit code 0.
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test` — 14 tests passed. API 2/2 and AI 12/12. Exit code 0.
- `docker compose up -d postgres` — `jobpilot-postgres-1` was already running. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status` — 8 migrations found. Database schema is up to date. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:auth` — 11 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:profile` — 45 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:resumes` — 7 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:jobs` — 14 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:tailored-resume` — 9 tests passed. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase14-validation-secret pnpm --filter @jobpilot/portfolio-mcp test` — 6 tests passed. Exit code 0.
- `docker compose up --build -d` — built and left `postgres`, `api`, `web`, and `portfolio-mcp` running. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — 21 tests passed. Exit code 0.
- `curl -sS http://localhost:3000/health` — `{"status":"ok"}`. Follow-up with response headers: `HTTP/1.1 200 OK`.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright or start PostgreSQL.
- Live Gemini was not called. Compose has `RESUME_MODEL=stub` and an empty `GEMINI_API_KEY`.
- `prisma migrate status` found 8 migrations already applied. This run did not add a migration.
- No Playwright assertion counts requests to prove `GET /jobs/:id/tailored-resume` is absent before the panel opens. The query component is mounted only while the panel is open.
- No Playwright case logs out with the panel open and then signs in as a second user. Logout unmounts the signed-in shell, and the jobs case still isolates cached jobs.

## Completion checklist

- [x] PASS — The dashboard job row shows `Present` or `Not available` for the tailored resume, and leaves plan, score, and readiness as `Not available`.
- [x] PASS — `Tailored resume` opens one panel on that row and loads `GET /jobs/:id/tailored-resume` only while the panel is open.
- [x] PASS — The empty state is `No tailored resume yet.` A `404` from that GET is the empty state, not an alert.
- [x] PASS — `Generate resume` posts `{}` and renders the stored sections in the open panel.
- [x] PASS — Generating again replaces the document in place.
- [x] PASS — A description edit clears the flag and the open panel until the user generates again.
- [x] PASS — A failed generate shows the API error and keeps the previous panel body.
- [x] PASS — Signed-out removes cached tailored-resume queries. The query key includes the user id and job id.
- [x] PASS — The document is parsed with `tailoredResumeSchema`. The web app does not call Gemini or MCP.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4, Phase 6, Phase 7, and existing jobs cases, and deletes its users.
- [x] PASS — `pnpm --filter @jobpilot/api test:tailored-resume` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:jobs` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — No migration is added. The resume API contract and `packages/shared` stay as Phase 13 defined them.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [x] PASS — GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [x] PASS — No Phase 15 or later work is included.

## Result

PASS
