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

1. Install workspace dependencies and confirm the install succeeds.
2. Typecheck the workspace and confirm it succeeds, including `apps/web`, `apps/api`, and the placeholders `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp`.
3. Start Docker Compose and confirm PostgreSQL, the API, and the web app are running. The PostgreSQL image is pgvector-capable. No migration is applied in this phase.
4. Call the health route and confirm it returns success.
5. Open the web page and confirm it shows that health result. The page loads the result through TanStack Query.
6. Confirm the Gemini key is defined only for the API, and that the web app has no Gemini API key.
7. Confirm GitHub Actions installs dependencies, typechecks, and runs Vitest, and that the Vitest run includes the Supertest health-route test.

## Commands

The roadmap and tech stack name these actions. They do not name a `package.json` script. Local checks use the same install, typecheck, and Vitest commands the GitHub Actions workflow runs.

- Install dependencies: `pnpm install`
- Typecheck: the typecheck command CI runs. It must succeed.
- Tests: the Vitest command CI runs. It must run the Supertest health-route test.
- Local runtime: `docker compose up`

`docker compose up` starts PostgreSQL, the API, and the web app.

## Completion checklist

- [ ] `pnpm install` succeeds.
- [ ] Typecheck succeeds for the apps and packages in scope, including the placeholders.
- [ ] Docker Compose starts PostgreSQL, the API, and the web app.
- [ ] PostgreSQL uses a pgvector-capable image, and this phase does not apply a schema or migration.
- [ ] The health route returns success.
- [ ] Supertest covers the health route.
- [ ] Vitest runs that health-route test.
- [ ] GitHub Actions installs dependencies, typechecks, and runs Vitest.
- [ ] The one web page shows the health result and calls the health route through TanStack Query.
- [ ] Secrets are read from environment variables.
- [ ] The Gemini key is defined only for the API.
- [ ] The web app has no Gemini API key.
- [ ] `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` typecheck and stay placeholders.
- [ ] No Phase 2 or later work is included.
