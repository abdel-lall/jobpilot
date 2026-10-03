# Phase 11 — MCP exact tools

## Objective

Expose the authenticated user's structured profile through Streamable HTTP, without vector search.

## Scope

This phase adds only the MCP exact tools described in the Phase 11 section of `specs/roadmap.md`:

- `apps/portfolio-mcp` serves the official MCP TypeScript SDK over Streamable HTTP.
- Tools: `get_candidate_profile`, `get_skills`, `get_experience`, `get_projects`, `get_project_details`, `get_education`, and `get_certifications`.
- Each tool reads the application database through `packages/database`.
- Tool schemas include no user id or other identity field.
- The server takes the user only from the trusted request context set by the caller. It ignores identity supplied in tool arguments.
- Compose starts the MCP server beside the API.
- No AI workflow calls the server yet.

The roadmap names the tools and the identity rule. It does not name the port, the request headers, the result JSON, or the missing-project result. The contract below closes those gaps.

### Process

`apps/portfolio-mcp` is an HTTP server. It uses Node's `http` module and the official `@modelcontextprotocol/sdk` Streamable HTTP transport. It does not use Express.

The listen port is `MCP_PORT` when that value is a non-empty integer from 1 through 65535. Otherwise it is `3010`. It does not read `PORT`.

`POST /mcp` is the only MCP route. `GET /mcp` and `DELETE /mcp` return `405` with `{ "error": "Method not allowed" }`. Any other path returns `404` with `{ "error": "Not found" }`.

There is no session store. Each `POST /mcp` reads the trusted headers on that request and uses that user for every tool call in that request. A later request does not reuse the previous user.

If `DATABASE_URL` is missing or blank, the process exits before it listens. Construct `PrismaClient` from `@jobpilot/database` with the `PrismaPg` adapter and that connection string, the same way `apps/api/src/db.ts` does. Do not add a new database package API.

### Trusted context

The caller sets two headers on `POST /mcp`:

| Header | Required value |
| --- | --- |
| `x-jobpilot-mcp-secret` | exactly `MCP_SHARED_SECRET` |
| `x-jobpilot-user-id` | one UUID, the user whose rows the tools may read |

Compare the secret with a timing-safe equality check. A length mismatch is a failure, not an exception. If `MCP_SHARED_SECRET` is missing or blank, every `POST /mcp` fails the secret check. An empty caller secret does not match a blank server secret.

The user id matches `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$` in lowercase. A mixed-case UUID is invalid.

A failed secret or an invalid user id returns `401` with `{ "error": "Unauthorized" }` and does not run a tool. The body does not say which check failed. It does not include the secret, the user id, or profile fields.

The user id does not have to exist in `User`. A valid id with no rows returns empty arrays. `get_project_details` then returns not found.

The user id is not read from the query string, the JSON-RPC body, or tool arguments.

### Tool arguments

Input schemas are Zod objects. They do not declare `userId`, `email`, or any other identity field. Unknown keys are stripped. The handlers never read an identity field from arguments.

| Tool | Arguments |
| --- | --- |
| `get_candidate_profile` | none |
| `get_skills` | none |
| `get_experience` | none |
| `get_projects` | none |
| `get_education` | none |
| `get_certifications` | none |
| `get_project_details` | `projectId`, a UUID in the same form as the user-id header |

A `get_project_details` call whose `projectId` is missing or is not that UUID form is a tool error. The text is `Invalid input`. No database row is required for that rejection.

`search_candidate_experience` is not registered.

### Tool results

A successful tool returns `isError: false` and one text content part. The text is `JSON.stringify` of the object below, with no surrounding prose. Dates are `YYYY-MM-DD` using the UTC calendar date, the same conversion the profile API uses. Timestamps are `toISOString()`. List order is `createdAt` ascending, then `id` ascending. Accomplishments and technologies keep stored order.

Each record is the Phase 5 public JSON for that type with `userId` removed. The fields that remain are `id`, the Phase 5 fact fields, `createdAt`, and `updatedAt`.

| Tool | JSON |
| --- | --- |
| `get_skills` | `{ "skills": Skill[] }` |
| `get_experience` | `{ "experience": WorkExperience[] }` |
| `get_projects` | `{ "projects": Project[] }` |
| `get_project_details` | `{ "project": Project }` |
| `get_education` | `{ "education": Education[] }` |
| `get_certifications` | `{ "certifications": Certification[] }` |
| `get_candidate_profile` | `{ "skills", "experience", "projects", "education", "certifications" }` using those same arrays |

`get_candidate_profile` uses the same rows and order as the five section tools. It does not add email, password hash, refresh sessions, jobs, job analysis, or resume files.

Queries filter on the context user id only. `get_project_details` loads a project only when both `id` and `userId` match. A missing id and another user's id produce the same tool error: `isError: true`, text `Not found`, and no project JSON.

These tools do not create, update, or delete rows.

### What a result must not contain

Do not return `userId`, account email, `passwordHash`, refresh-session fields, `ResumeFile` fields, `storagePath`, file bytes, job rows, or job-analysis rows. Do not query `pgvector`.

A caller that passes `userId` of another user still receives only the context user's rows. Passing another user's `projectId` to `get_project_details` returns `Not found`.

Do not log `MCP_SHARED_SECRET`, profile field values, resume storage paths, access tokens, or `JWT_SECRET`.

### Compose

Compose starts `portfolio-mcp` beside `api` and `web`. It depends on `postgres` only. The API service does not call it and does not gain `MCP_SHARED_SECRET`.

| Setting | Value |
| --- | --- |
| Dockerfile | `apps/portfolio-mcp/Dockerfile` |
| Host port | `3010:3010` |
| `MCP_PORT` | `3010` |
| `DATABASE_URL` | `postgresql://postgres:jobpilot@postgres:5432/postgres` |
| `MCP_SHARED_SECRET` | `${MCP_SHARED_SECRET:-dev-only-change-me}` |

The image build installs the workspace, then builds `@jobpilot/shared`, `@jobpilot/database`, and `@jobpilot/portfolio-mcp`. It does not receive `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `JWT_SECRET`, or `RESUME_STORAGE_DIR`.

Document `MCP_PORT` and `MCP_SHARED_SECRET` in `.env.example` as portfolio-mcp only. The web service still does not receive them, and it still does not receive `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`, or `JOB_ANALYSIS_MODEL`.

`apps/api` routes, models, and workflows stay as Phase 10 left them. The Vitest MCP client is the caller in this phase. Phase 13 is when the API attaches the session user and calls this server.

## Affected subsystems

- MCP
- Candidate profile
- `apps/portfolio-mcp`
- `packages/database`
- Local Docker runtime

`packages/database` is used through the existing Prisma client. This phase adds no model and no migration.

`apps/api` and `apps/web` stay as Phase 10 left them. The roadmap lists `apps/api` because `specs/tech-stack.md` names the API as the MCP client. Phase 13 is the phase that attaches the session user and calls this server. This phase does not add that client.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 11:

- `search_candidate_experience`, embeddings, vector writes, and vector queries. Phase 12.
- The API acting as an MCP client, attaching the session user from an access token, and any LangGraph workflow calling this server. Phase 13. Only resume tailoring may call MCP.
- Tailored resume generation and UI. Phases 13 and 14.
- Interview plans, question generation, answer evaluation, retakes, scores, and the readiness badge. Phases 15 through 18.
- New profile fields, new profile routes, and edits to the Phase 5 HTTP contract.
- Reading, parsing, or returning uploaded resume files. Phase 7 files stay stored and unused.
- A profile UI change, a jobs UI change, or a dashboard change.
- A queue, a worker process, or a background retry.
- Changing auth token lifetimes, hashing, session rotation, or auth response bodies.
- Changing job create, update, analysis, or the `502` analysis failure body.
- A new product table or a change to an existing migration.
- A GitHub Actions PostgreSQL service or a Playwright job. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phases 5 and 7.

Phase 5 provides the five profile models and their fact fields. Phase 7 provides `ResumeFile`, which these tools must not return. Phase 10 is merged and provides job analysis, which these tools must not return.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 11, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Server package

- Add `@modelcontextprotocol/sdk` and `zod` to `apps/portfolio-mcp`. Add workspace dependencies on `@jobpilot/database` and `@jobpilot/shared`. Add `@prisma/adapter-pg` the same way `apps/api` does.
- Add Vitest, a `test` script, and a `build` script. Root `pnpm test` stays `@jobpilot/api` unit tests and `@jobpilot/ai` tests. Do not add the MCP tests to root `pnpm test`. They need PostgreSQL.
- Keep TypeScript strict. Avoid `any` unless justified.
- Do not add LangChain, LangGraph, or a Gemini client to `apps/portfolio-mcp`.
- Parse tool results with Zod schemas derived from the Phase 5 public schemas by omitting `userId`. `packages/shared` stays the source of those fields. Do not duplicate a second profile contract.

### Tests

- Add `apps/portfolio-mcp/src/mcp.test.ts`. It starts the server in-process on an ephemeral port and talks to it with the official MCP client over Streamable HTTP. It does not call tool functions directly.
- Set `DATABASE_URL` and `MCP_SHARED_SECRET` in that run. Do not set `GEMINI_API_KEY`.
- Seed two users through Prisma. Give each user one skill, one education row, one work-experience row, two projects, and one certification, with distinct fact text. Give the first user one `ResumeFile` row. Do not write a file on disk.
- Assert each of the seven tools, under the first user's header, returns only that user's rows and the Phase 11 JSON above.
- Assert `get_candidate_profile` matches the five section-tool arrays.
- Assert `get_project_details` returns one project owned by that user.
- Call `get_skills` with an extra `userId` argument set to the second user, and assert the result is still the first user's skills.
- Call `get_project_details` for the first user's project while also passing the second user's id, and assert the returned project is the first user's.
- Call `get_project_details` for the second user's project id under the first user's header, and assert `Not found`.
- Assert the second user's fact text, the resume file name, `storagePath`, and both password hashes are absent from every successful result.
- A second client request with the second user's header returns that user's skill and does not return the first user's skill.
- `POST /mcp` without the secret, and `POST /mcp` with the secret and a non-UUID user id, each return `401` and `{ "error": "Unauthorized" }`.
- Each test deletes the users it created. Cascade removes profile rows and the resume-file row.
- `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, and `test:jobs` still pass.

### Runtime

- `pnpm typecheck` includes `@jobpilot/portfolio-mcp`.
- `pnpm test` and `pnpm typecheck` still pass with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `MCP_SHARED_SECRET` unset.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
