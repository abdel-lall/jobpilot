# Phase 1 — Validation

Validation has not been run. Phase 1 implementation has not started.

## Acceptance criteria

- `pnpm` install and typecheck succeed.
- Compose starts PostgreSQL, the API, and the web app.
- The health route returns success.
- The web page shows that health result.
- CI runs typecheck and Vitest.
- The web app has no Gemini API key.

## Required automated tests

- Supertest: health route.
- Vitest runs that test in GitHub Actions.

No other automated test is required for this phase. Playwright is not required until a later phase. Gemini is not called, so this phase does not add a stubbed model client.

## Manual verification steps

1. Run `pnpm install` and confirm it succeeds.
2. Run `pnpm typecheck` and confirm it succeeds for every workspace in scope, including `apps/web`, `apps/api`, and the placeholders `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp`.
3. Run `docker compose up` and confirm PostgreSQL, the API, and the web app are running. The PostgreSQL image is pgvector-capable. In Phase 1, PostgreSQL only needs to start and be reachable/healthy. Schema, Prisma connectivity, migrations, and vector-extension verification belong to Phase 2.
4. Call the health route and confirm it returns success.
5. Open the web page and confirm it shows that health result. The page loads the result through TanStack Query.
6. Confirm the Gemini key is defined only for the API, and that the web app has no Gemini API key.
7. Confirm GitHub Actions runs `pnpm typecheck` and `pnpm test`. `pnpm test` runs Vitest and includes the Supertest health-route test.

## Commands

Phase 1 implementation must create these root package scripts:

- `pnpm typecheck` typechecks every workspace in scope.
- `pnpm test` runs Vitest and includes the Supertest health-route test.

Required commands:

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `docker compose up`

GitHub Actions must run the same `pnpm typecheck` and `pnpm test`.

`docker compose up` starts PostgreSQL, the API, and the web app. In Phase 1, PostgreSQL only needs to start and be reachable/healthy.

## Completion checklist

- [ ] `pnpm install` succeeds.
- [ ] Root `pnpm typecheck` exists and typechecks every workspace in scope, including the placeholders.
- [ ] `pnpm typecheck` succeeds.
- [ ] `docker compose up` starts PostgreSQL, the API, and the web app.
- [ ] PostgreSQL uses a pgvector-capable image, starts, and is reachable/healthy. Schema, Prisma connectivity, migrations, and vector-extension verification belong to Phase 2.
- [ ] The health route returns success.
- [ ] Supertest covers the health route.
- [ ] Root `pnpm test` exists, runs Vitest, and includes the Supertest health-route test.
- [ ] GitHub Actions runs `pnpm typecheck` and `pnpm test`.
- [ ] The one web page shows the health result and calls the health route through TanStack Query.
- [ ] Secrets are read from environment variables.
- [ ] The Gemini key is defined only for the API.
- [ ] The web app has no Gemini API key.
- [ ] `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` typecheck and stay placeholders.
- [ ] No Phase 2 or later work is included.
