# Phase 2 — Database foundation

## Objective

Give every later phase a migrated Prisma database on the Compose PostgreSQL instance.

## Scope

This phase adds only the database foundation described in the Phase 2 section of `specs/roadmap.md`:

- `packages/database` owns the Prisma schema, the Prisma client, and the migrations.
- The first migration enables the `vector` extension on the Compose PostgreSQL instance from Phase 1 (`pgvector/pgvector:pg16`).
- The schema contains no product tables.
- `apps/api` can import the shared Prisma client from `@jobpilot/database`.
- A `@jobpilot/database` Vitest integration test proves the Prisma client connects to that database and that the `vector` extension is installed.

Phase 1 already starts PostgreSQL, the API, and the web app. This phase uses that Compose database. It does not add a second database service.

## Affected subsystems

- `packages/database`
- Local Docker runtime

`apps/api` is changed only enough to import the shared Prisma client. That import is required by the Phase 2 acceptance criteria. It does not add a route, a new subsystem, or a database connection during API startup.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 2:

- Product tables and Prisma models for users, refresh sessions, skills, education, work experience, projects, certifications, resume-file metadata, jobs, job analyses, tailored resumes, interview plans, attempts, questions, answers, scores, or embeddings. Those tables arrive with the phases that own them, starting at Phase 3.
- Authentication: register, log in, log out, refresh, JWT access tokens, refresh cookies, Argon2id, and shared user or session schemas. Phase 3 owns the authentication API. Phase 4 owns the authentication UI.
- Candidate profile records and profile UI. Phases 5 and 6.
- Resume file upload, download, delete, local disk storage, and database metadata for those files. Phase 7.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, or Gemini calls. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools, Streamable HTTP serving, and the API acting as an MCP client. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and queries. Phase 12. `search_candidate_experience` is the only feature that queries pgvector. This phase only enables the `vector` extension.
- Playwright tests. The first Playwright requirement is in Phase 4.
- A GitHub Actions PostgreSQL service. Phase 1 CI already typechecks and runs the API Vitest suite. This phase does not add CI infrastructure.
- Queues, a worker process, or a job runner. The MVP does not add them.
- Changes to `apps/web`.

## Dependencies

Phase 1.

Phase 1 provides the pnpm workspace, TypeScript strict mode, the `@jobpilot/database` placeholder, the Express health route, and Docker Compose with `pgvector/pgvector:pg16` published on port `5432`. The Compose database user is `postgres` and the password is `jobpilot`.

## Implementation constraints

These constraints come from Phase 2, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

- Use Prisma ORM inside `packages/database`. The package owns the Prisma schema, the Prisma 7 config file, the generated client, and the migration history.
- Pin `prisma` and `@prisma/client` to the same exact Prisma 7 version. Do not install an unpinned `latest` Prisma version.
- Use the Prisma 7 config filename supported by that exact version. If the chosen version is Prisma 7.10 or later, prefer `prisma7.config.ts`.
- Use the `prisma-client` generator with an explicit output path. Export that generated client from `@jobpilot/database`.
- `packages/database` must use ESM as required by Prisma 7, including `"type": "module"` in its package configuration. Its TypeScript configuration must remain compatible with the existing monorepo: keep extending `tsconfig.base.json` with `NodeNext` module settings. The package must typecheck successfully with the generated Prisma 7 client.
- `PrismaClient` must use the PostgreSQL driver adapter required by Prisma 7, `@prisma/adapter-pg`.
- The first migration is the only migration in this phase. Enable `vector` through a customized SQL migration containing `CREATE EXTENSION IF NOT EXISTS vector;`. Prisma migration bookkeeping, including `_prisma_migrations`, is allowed. Application product tables are not.
- `apps/api` only needs to import the shared Prisma client in this phase. Do not add a database connection during API startup. Importing the client must not open a connection. The health route stays `GET /health` returning `200` and `{ "status": "ok" }`.
- Apply migrations to the existing Compose PostgreSQL service. Keep the image `pgvector/pgvector:pg16`.
- Read the database URL from an environment variable. Document it in `.env.example`. The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`, taken from the Compose service published on `localhost:5432`.
- The Gemini key stays defined only for the API. The web app has no Gemini API key and no database URL in frontend code.
- Database connectivity remains validated only by the `@jobpilot/database` Vitest integration test. That test constructs `PrismaClient` with `@prisma/adapter-pg`, connects to the Compose database, and reads `pg_extension` to assert that `vector` is installed. The test uses a real database connection. A mocked extension check does not meet this requirement.
- Root `pnpm test` continues to run the Phase 1 API health-route Vitest. The database connection test has its own command, because Phase 1 CI runs `pnpm test` without PostgreSQL. This phase does not add a database service to GitHub Actions.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless this phase directly requires them.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
