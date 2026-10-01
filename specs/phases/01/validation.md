# Phase 1 — Validation

Validation passed on 2026-09-30. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — `pnpm` install and typecheck succeed.
- PASS — Compose starts PostgreSQL, the API, and the web app.
- PASS — The health route returns success.
- PASS — The web page shows that health result.
- PASS — CI runs typecheck and Vitest. The workflow was validated by inspection. GitHub Actions was not executed remotely because the repository has not been pushed.
- PASS — The web app has no Gemini API key.

## Required automated tests

- PASS — Supertest covers `GET /health` and expects `200` with `{ "status": "ok" }`.
- PASS — `pnpm test` runs that Vitest file. The workflow calls the same `pnpm test`.

No other automated test is required for this phase. Playwright is not required until a later phase. Gemini is not called, so this phase does not add a stubbed model client.

## Commands run

- `pnpm install` — succeeded with pnpm 10.34.6 (224 packages). A follow-up install allowed the esbuild install script.
- `pnpm typecheck` — succeeded for `apps/api`, `apps/web`, `apps/portfolio-mcp`, `packages/shared`, `packages/database`, and `packages/ai`.
- `pnpm test` — succeeded. Vitest ran `apps/api/src/health.test.ts`: 1 file, 1 test passed. No Gemini key was set.
- `docker compose up --build -d` — succeeded with `GEMINI_API_KEY` unset. `jobpilot-postgres-1` (`pgvector/pgvector:pg16`) was healthy. `jobpilot-api-1` and `jobpilot-web-1` were up. The API does not wait on PostgreSQL.
- `GET http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `GET http://localhost:5173/health` — `200` and `{"status":"ok"}` through the Vite proxy.
- Headless Chrome opened `http://localhost:5173` — the page rendered `Health status: ok` inside the shadcn Card. The page loads that result with TanStack Query.
- Gemini check — `GEMINI_API_KEY` is empty on the API container and unset on the web container. `apps/web` source has no Gemini key.

## Completion checklist

- [x] PASS — `pnpm install` succeeds.
- [x] PASS — Root `pnpm typecheck` exists and typechecks every workspace in scope, including the placeholders.
- [x] PASS — `pnpm typecheck` succeeds.
- [x] PASS — `docker compose up` starts PostgreSQL, the API, and the web app.
- [x] PASS — PostgreSQL uses a pgvector-capable image, starts, and is reachable/healthy. Schema, Prisma connectivity, migrations, and vector-extension verification belong to Phase 2.
- [x] PASS — The health route returns success.
- [x] PASS — Supertest covers the health route.
- [x] PASS — Root `pnpm test` exists, runs Vitest, and includes the Supertest health-route test.
- [x] PASS — GitHub Actions runs `pnpm typecheck` and `pnpm test`. Validated by inspection of `.github/workflows/ci.yml`. Not executed remotely because the repository has not been pushed.
- [x] PASS — The one web page shows the health result and calls the health route through TanStack Query.
- [x] PASS — Secrets are read from environment variables. `PORT` is read in the API. `GEMINI_API_KEY` is optional, documented in `.env.example`, and injected only into the API service.
- [x] PASS — The Gemini key is defined only for the API.
- [x] PASS — The web app has no Gemini API key.
- [x] PASS — `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` typecheck and stay placeholders.
- [x] PASS — No Phase 2 or later work is included.
