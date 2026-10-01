# Phase 2 — Validation

Not started. Complete this checklist during implementation. Leave items unchecked until the command or inspection passes.

## Acceptance criteria

- Migrations apply to the Compose database.
- The `vector` extension is present.
- The API can import the shared Prisma client and does not connect to the database during startup.
- The schema has no product tables.
- The Phase 1 health route and web page still work.
- The web app has no Gemini API key and no database URL in frontend code.

## Required automated tests

- `@jobpilot/database` Vitest integration test: `PrismaClient` uses `@prisma/adapter-pg`, connects to the Compose database, and `vector` is installed in `pg_extension`. This test is the only Phase 2 database connectivity check.
- The Phase 1 Supertest health-route test still passes through root `pnpm test`.

No other automated test is required for this phase. Playwright is not required until Phase 4. Gemini is not called, so this phase does not add a stubbed model client. GitHub Actions is not given a PostgreSQL service in this phase.

## Manual verification steps

1. Confirm the Compose PostgreSQL service is the Phase 1 service: image `pgvector/pgvector:pg16`, user `postgres`, password `jobpilot`, port `5432`.
2. Confirm `packages/database` pins `prisma` and `@prisma/client` to the same exact Prisma 7 version. The config filename is the one that version supports; Prisma 7.10 or later uses `prisma7.config.ts`. The generator is `prisma-client` with an explicit output path. `PrismaClient` uses `@prisma/adapter-pg`. Neither dependency is `latest`. Confirm `packages/database/package.json` has `"type": "module"` and that `packages/database/tsconfig.json` still extends `tsconfig.base.json` with `NodeNext` module settings.
3. Apply the Phase 2 migration to that database. Confirm the migration SQL contains `CREATE EXTENSION IF NOT EXISTS vector;`.
4. Query `pg_extension` and confirm a row for `vector`.
5. List relations and confirm the only new relation is Prisma migration bookkeeping. No user, session, profile, resume, job, analysis, or embedding tables are present.
6. Confirm `apps/api` imports the shared Prisma client from `@jobpilot/database` and does not add a database connection during API startup. Confirm `GET /health` still returns `200` with `{ "status": "ok" }`.
7. Confirm the Prisma schema declares no product models.
8. Confirm `.env.example` documents the database URL, the Gemini key remains API-only, and `apps/web` source contains neither a Gemini key nor a database URL.
9. Run the `@jobpilot/database` Vitest integration test against the Compose database, and run the existing API Vitest suite. The database integration test is the only connectivity check. API startup does not connect.

## Commands

Run these from the repository root after implementation. Set the database URL only in the shell for Prisma and the database test.

Start the existing Compose database and wait until it is healthy:

```bash
docker compose up -d postgres
docker compose ps
```

Install, generate the client, and typecheck:

```bash
pnpm install
pnpm --filter @jobpilot/database exec prisma generate
pnpm --filter @jobpilot/database typecheck
pnpm typecheck
```

`pnpm --filter @jobpilot/database typecheck` must succeed with the generated Prisma 7 client. Root `pnpm typecheck` must still succeed for the whole monorepo.

Apply migrations to the Compose database:

```bash
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy
```

Confirm the extension and that no product tables exist:

```bash
docker compose exec postgres psql -U postgres -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
docker compose exec postgres psql -U postgres -c "\dt"
```

Expected extension result: one row, `vector`.

Expected relation list: `_prisma_migrations` only.

Run the required Vitest files:

```bash
DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test
pnpm test
```

`pnpm --filter @jobpilot/database test` is the only database connectivity check. It must construct `PrismaClient` with `@prisma/adapter-pg`, connect, and assert that `vector` is installed.

`pnpm test` must pass the existing `GET /health` Supertest.

Confirm the running API health route:

```bash
docker compose up --build -d
curl -sS http://localhost:3000/health
```

Expected health body: `{"status":"ok"}`.

## Completion checklist

- [ ] `packages/database` owns the Prisma schema, the version-appropriate Prisma 7 config file, generated client, and migration history.
- [ ] `prisma` and `@prisma/client` are pinned to the same exact Prisma 7 version. Neither dependency is `latest`.
- [ ] The config filename is the one that exact version supports. Prisma 7.10 or later uses `prisma7.config.ts`.
- [ ] Client generation uses the `prisma-client` generator with an explicit output path.
- [ ] `packages/database/package.json` has `"type": "module"`.
- [ ] `packages/database/tsconfig.json` still extends `tsconfig.base.json` with `NodeNext` module settings.
- [ ] `pnpm --filter @jobpilot/database typecheck` succeeds with the generated Prisma 7 client.
- [ ] `PrismaClient` uses the PostgreSQL driver adapter `@prisma/adapter-pg`.
- [ ] The first migration SQL contains `CREATE EXTENSION IF NOT EXISTS vector;` and adds no product tables.
- [ ] `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` succeeds against the Compose database.
- [ ] `SELECT extname FROM pg_extension WHERE extname = 'vector'` returns `vector`.
- [ ] `\dt` shows `_prisma_migrations` and no product tables.
- [ ] `@jobpilot/database` exports the generated Prisma client.
- [ ] `apps/api` imports that shared client and does not add a database connection during API startup.
- [ ] Root `pnpm typecheck` succeeds, including `@jobpilot/database` with the generated Prisma 7 client.
- [ ] `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database test` is the only connectivity check: it uses `@prisma/adapter-pg` and passes the `vector` extension assertion.
- [ ] `pnpm test` still passes the Phase 1 health-route Supertest.
- [ ] `GET http://localhost:3000/health` returns `200` and `{"status":"ok"}`.
- [ ] The database URL is documented in `.env.example` and is not committed as a secret in application source.
- [ ] The Gemini key remains defined only for the API. `apps/web` has no Gemini API key and no database URL.
- [ ] Compose still uses `pgvector/pgvector:pg16`. No second database service was added.
- [ ] Phase 1 CI is unchanged: it runs `pnpm typecheck` and `pnpm test` and does not start PostgreSQL.
- [ ] No Phase 3 or later work is included: no auth API, no product models, no web authentication UI, no AI, no MCP, and no vector queries.
