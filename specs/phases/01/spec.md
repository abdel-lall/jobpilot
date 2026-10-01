# Phase 1 — Monorepo and local runtime

## Objective

Boot a strict TypeScript monorepo locally and in CI.

## Scope

This phase adds only the monorepo layout and the local runtime described in the Phase 1 section of `specs/roadmap.md`:

- pnpm workspaces for the three apps and three packages: `apps/web`, `apps/api`, `apps/portfolio-mcp`, `packages/ai`, `packages/database`, and `packages/shared`.
- TypeScript strict mode.
- An Express API with a health route.
- Vite, React, Tailwind CSS, and shadcn/ui, with one page that calls the health route through TanStack Query.
- Placeholder `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` that typecheck.
- Docker Compose for the API, web app, and PostgreSQL using a pgvector-capable image.
- Environment variables for secrets. The Gemini key is defined only for the API.
- GitHub Actions that install dependencies, typecheck, and run Vitest.

`apps/web` and `apps/api` are the only applications with behavior in this phase: one page and one health route. The other workspace members exist so the layout typechecks.

## Affected subsystems

- Monorepo and tooling
- `apps/web`
- `apps/api`
- `apps/portfolio-mcp`
- `packages/shared`
- `packages/database`
- `packages/ai`
- Local Docker runtime
- GitHub Actions

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 1:

- Prisma schema, Prisma client, migrations, and enabling the `vector` extension. Phase 2 owns those. This phase only starts PostgreSQL from a pgvector-capable image.
- Product tables. Phase 2 still has none.
- Authentication: register, log in, log out, refresh, JWT access tokens, refresh cookies, and Argon2id. Phases 3 and 4.
- Candidate profile records and profile UI. Phases 5 and 6.
- Resume file upload, download, delete, local disk storage, and database metadata for those files. Phase 7. AWS deployment and the S3 adapter are outside this roadmap.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, or Gemini calls. Those start at Phase 10. `packages/ai` is a typecheck placeholder only.
- MCP tools, Streamable HTTP serving, and the API acting as an MCP client. Phase 11. `apps/portfolio-mcp` is a typecheck placeholder only.
- Embeddings and `search_candidate_experience`. Phase 12. This phase does not query pgvector.
- Playwright tests. The first Playwright requirement is in Phase 4. This phase's required automated test is the Supertest health-route test run by Vitest.
- Queues, a worker process, or a job runner. The MVP does not add them.

## Dependencies

None.

## Implementation constraints

These constraints come from Phase 1, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

- Use pnpm workspaces and TypeScript.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Keep the repository layout as `apps/web`, `apps/api`, `apps/portfolio-mcp`, `packages/ai`, `packages/database`, and `packages/shared`.
- `apps/api` is a Node.js Express REST API. Its only route in this phase is the health route. Keep business logic outside controllers. Validate API inputs with Zod when an input exists.
- `apps/web` uses React, TypeScript, Vite, Tailwind CSS, shadcn/ui, and TanStack Query. The single page calls the health route through TanStack Query.
- `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` must typecheck and must not contain later-phase behavior. In particular, `packages/ai` does not call Gemini and does not gain a workflow or a model client in this phase.
- Secrets come from environment variables. The Gemini key is defined only for the API. Never expose Gemini API keys to the frontend. The web app has no Gemini API key.
- Docker Compose starts the API, the web app, and PostgreSQL. The database image must be pgvector-capable. In Phase 1, PostgreSQL only needs to start and be reachable/healthy. Schema, Prisma connectivity, migrations, and vector-extension verification belong to Phase 2.
- GitHub Actions installs dependencies, typechecks, and runs Vitest. That Vitest run includes the Supertest health-route test.
- Do not add a queue, a worker process, or a job runner.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless Phase 1 directly requires them.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
