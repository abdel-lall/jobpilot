# Phase 14 — Validation

Validation has not been run.

## Acceptance criteria

- A signed-in user can open `Tailored resume` on a dashboard job row. The panel is not a new URL. Reload still returns to the profile view.
- Before generation, the panel shows `No tailored resume yet.` and the row's `job-tailored-resume` text is `Not available`.
- `Generate resume` calls `POST /jobs/:id/tailored-resume` with `{}`. The open panel then shows the stored document, including the profile skill name. The row flag becomes `Present`.
- Generating again, after a new profile skill exists, replaces the document on the open panel. The new skill appears and the previous skill remains. The panel does not close.
- A description edit clears the current resume. The row flag returns to `Not available`. The open panel shows `No tailored resume yet.` until the user generates again.
- A failed generate shows the API `error` string and leaves the previous panel body in place. A failure before any resume exists leaves the empty state.
- Analysis stays `Current` or `Not available`. Interview plan, score, and readiness stay `Not available`.
- The resume query key is `["tailored-resume", userId, jobId]`. The GET does not run until the panel is open. Entering `signed-out` removes cached tailored-resume queries. The query cache is not persisted.
- The web app parses the response with `tailoredResumeSchema` from `@jobpilot/shared`. It does not import `@jobpilot/ai` and has no Gemini key, database URL, MCP secret, or `JWT_SECRET`.
- No API route, schema, migration, workflow, or MCP tool changes.

## Required automated tests

- Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose. Compose uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and an empty `GEMINI_API_KEY`. `portfolio-mcp` is running.
- The new tailored-resume case registers a unique `phase14-` user, adds the skill `TypeScript`, creates `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`, and sees analysis `Current` and tailored resume `Not available`.
- That case opens the panel, sees `No tailored resume yet.`, generates, and sees `TypeScript` with the flag `Present`. The POST body is a JSON object with no keys.
- That case adds the skill `Go`, reopens the panel, sees `TypeScript` without `Go`, generates again on the open panel, and sees both names with the flag still `Present`.
- That case changes the description to `Build reliable APIs.`. Analysis stays `Current`. The flag becomes `Not available`. The panel shows `No tailored resume yet.` and does not show `TypeScript`. Generating again shows `TypeScript` and `Go`, and the flag becomes `Present`.
- The same `test:e2e` run stubs `POST /jobs/:id/tailored-resume` to `502` with `{ "error": "Resume generation failed" }` before a resume exists. The panel shows that string and `No tailored resume yet.`.
- The same `test:e2e` run generates a resume that shows `TypeScript`, then stubs the next POST to that same `502`. The panel still shows `TypeScript`, and the flag stays `Present`.
- The existing jobs case still expects `Not available` on `job-tailored-resume` because it does not generate. The Phase 4, Phase 6, and Phase 7 browser cases still pass. The new test deletes its `phase14-` users through Prisma.
- `pnpm --filter @jobpilot/api test:tailored-resume` still passes.
- `pnpm --filter @jobpilot/api test:jobs` still passes.
- `pnpm --filter @jobpilot/api test:profile` still passes.
- `pnpm --filter @jobpilot/api test:resumes` still passes.
- `pnpm --filter @jobpilot/api test:auth` still passes.
- `pnpm --filter @jobpilot/portfolio-mcp test` still passes.
- Root `pnpm test` still passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset.
- `pnpm typecheck` still passes.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job.

## Manual verification

1. Compose is up. `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
2. After login, the profile view is unchanged. Opening `Dashboard` on a new job shows tailored resume `Not available` before the panel is opened, and `GET /jobs/:id/tailored-resume` has not run.
3. Opening `Tailored resume` shows `No tailored resume yet.` Generate shows the skill that was saved on the profile. Reload returns to the profile view. Opening `Dashboard` and the panel again shows the same skill, and the row says `Present`.
4. Adding another skill and generating again updates the open panel. Editing the job description changes the row to `Not available` and the panel to `No tailored resume yet.`
5. Log out removes the panel. The next user does not see the previous user's job or resume.
6. The Vite-served web modules have no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.

## Commands

Run these from the repository root after implementation. Do not treat this file as a pass until each command has been executed.

- `pnpm typecheck`
- `env -u DATABASE_URL -u JWT_SECRET -u GEMINI_API_KEY pnpm test`
- `docker compose up -d postgres`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate status`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:auth`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:profile`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:resumes`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:jobs`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase14-validation-secret pnpm --filter @jobpilot/api test:tailored-resume`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres MCP_SHARED_SECRET=phase14-validation-secret pnpm --filter @jobpilot/portfolio-mcp test`
- `docker compose up --build -d`
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e`
- `curl -sS http://localhost:3000/health`

## Completion checklist

- [ ] The dashboard job row shows `Present` or `Not available` for the tailored resume, and leaves plan, score, and readiness as `Not available`.
- [ ] `Tailored resume` opens one panel on that row and loads `GET /jobs/:id/tailored-resume` only while the panel is open.
- [ ] The empty state is `No tailored resume yet.` A `404` from that GET is the empty state, not an alert.
- [ ] `Generate resume` posts `{}` and renders the stored sections in the open panel.
- [ ] Generating again replaces the document in place.
- [ ] A description edit clears the flag and the open panel until the user generates again.
- [ ] A failed generate shows the API error and keeps the previous panel body.
- [ ] Signed-out removes cached tailored-resume queries. The query key includes the user id and job id.
- [ ] The document is parsed with `tailoredResumeSchema`. The web app does not call Gemini or MCP.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4, Phase 6, Phase 7, and existing jobs cases, and deletes its users.
- [ ] `pnpm --filter @jobpilot/api test:tailored-resume` passes.
- [ ] `pnpm --filter @jobpilot/api test:jobs` passes.
- [ ] `pnpm --filter @jobpilot/api test:profile` passes.
- [ ] `pnpm --filter @jobpilot/api test:resumes` passes.
- [ ] `pnpm --filter @jobpilot/api test:auth` passes.
- [ ] `pnpm --filter @jobpilot/portfolio-mcp test` passes.
- [ ] `pnpm test` passes with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset.
- [ ] `pnpm typecheck` passes.
- [ ] `GET /health` still returns `200` and `{"status":"ok"}`.
- [ ] No migration is added. The resume API contract and `packages/shared` stay as Phase 13 defined them.
- [ ] The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL`.
- [ ] GitHub Actions is unchanged and does not run Playwright or start PostgreSQL.
- [ ] No Phase 15 or later work is included.

## Result

Not started.
