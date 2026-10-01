# Phase 2 — Validation

Validation passed on 2026-09-30. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — Migrations apply to the Compose database.
- PASS — The `vector` extension is present.
- PASS — The API can import the shared Prisma client and does not connect to the database during startup. The import is type-only. Compiled `apps/api/dist/app.js` does not import `@jobpilot/database`. The API container has no `DATABASE_URL`. After `docker compose up --build -d`, the API log was `API listening on port 3000`.
- PASS — The schema has no product tables.
- PASS — The Phase 1 health route still works. The rendered web page was not browser-exercised in this phase. `GET http://localhost:5173/` returned `200`, and `apps/web` source remained unchanged.
- PASS — The web app has no Gemini API key and no database URL in frontend code.

## Required automated tests

- PASS — `@jobpilot/database` Vitest integration test: `PrismaClient` uses `@prisma/adapter-pg`, connects to the Compose database, and `vector` is installed in `pg_extension`. This test is the only Phase 2 database connectivity check.
- PASS — The Phase 1 Supertest health-route test still passes through root `pnpm test`.

No other automated test is required for this phase. Playwright is not required until Phase 4. Gemini is not called, so this phase does not add a stubbed model client. GitHub Actions is not given a PostgreSQL service in this phase.

## Commands run

Commands ran from the repository root. `DATABASE_URL` was set only in the shell for Prisma migrate and the database test.

- `docker compose up -d postgres` — started `jobpilot-postgres-1` from `pgvector/pgvector:pg16` on port `5432`.
- `docker compose ps` — the Postgres container became healthy. User `postgres`, password `jobpilot`. No second database service.
- `pnpm install` — succeeded. `packages/database` `prepare` ran `prisma generate` and wrote the Prisma 7.10.0 client. A later install reported the lockfile up to date and generated the client again.
- `pnpm --filter @jobpilot/database exec prisma generate` — succeeded. Generated Prisma Client 7.10.0 to `packages/database/src/generated/prisma`.
- `pnpm --filter @jobpilot/database typecheck` — succeeded (`tsc --noEmit`) with the generated client.
- `pnpm typecheck` — succeeded for the whole monorepo.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. Applied `20260930120000_enable_vector`.
- `docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"` — one row, `vector`.
- `docker compose exec postgres psql -U postgres -c "\dt"` — `public._prisma_migrations` only.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` — succeeded. Vitest ran `packages/database/src/client.integration.test.ts`: 1 file, 1 test passed.
- `pnpm test` — succeeded. Vitest ran `apps/api/src/health.test.ts`: 1 file, 1 test passed.
- `docker compose up --build -d` — rebuilt and started the API and web images. Postgres stayed the existing healthy service.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`.
- `curl -sS -o /dev/null -w "%{http_code}" http://localhost:5173/` — `200`. The rendered page was not opened in a browser.

API startup does not connect to the database. The shared client import is `import type`. The emitted API module has no `@jobpilot/database` import. Compose does not set `DATABASE_URL` on the API service. The container log after startup was `API listening on port 3000`.

## Completion checklist

- [x] PASS — `packages/database` owns the Prisma schema, the version-appropriate Prisma 7 config file, generated client, and migration history.
- [x] PASS — `prisma` and `@prisma/client` are pinned to the same exact Prisma 7 version. Neither dependency is `latest`.
- [x] PASS — The config filename is the one that exact version supports. Prisma 7.10 or later uses `prisma7.config.ts`.
- [x] PASS — Client generation uses the `prisma-client` generator with an explicit output path.
- [x] PASS — `packages/database/package.json` has `"type": "module"`.
- [x] PASS — `packages/database/tsconfig.json` still extends `tsconfig.base.json` with `NodeNext` module settings.
- [x] PASS — `pnpm --filter @jobpilot/database typecheck` succeeds with the generated Prisma 7 client.
- [x] PASS — `PrismaClient` uses the PostgreSQL driver adapter `@prisma/adapter-pg`.
- [x] PASS — The first migration SQL contains `CREATE EXTENSION IF NOT EXISTS vector;` and adds no product tables.
- [x] PASS — `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` succeeds against the Compose database.
- [x] PASS — `SELECT extname FROM pg_extension WHERE extname = 'vector'` returns `vector`.
- [x] PASS — `\dt` shows `_prisma_migrations` and no product tables.
- [x] PASS — `@jobpilot/database` exports the generated Prisma client.
- [x] PASS — `apps/api` imports that shared client and does not add a database connection during API startup.
- [x] PASS — Root `pnpm typecheck` succeeds, including `@jobpilot/database` with the generated Prisma 7 client.
- [x] PASS — `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` is the only connectivity check: it uses `@prisma/adapter-pg` and passes the `vector` extension assertion.
- [x] PASS — `pnpm test` still passes the Phase 1 health-route Supertest.
- [x] PASS — `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
- [x] PASS — The database URL is documented in `.env.example` and is not committed as a secret in application source.
- [x] PASS — The Gemini key remains defined only for the API. `apps/web` has no Gemini API key and no database URL.
- [x] PASS — Compose still uses `pgvector/pgvector:pg16`. No second database service was added.
- [x] PASS — Phase 1 CI is unchanged: it runs `pnpm typecheck` and `pnpm test` and does not start PostgreSQL.
- [x] PASS — No Phase 3 or later work is included: no auth API, no product models, no web authentication UI, no AI, no MCP, and no vector queries.
