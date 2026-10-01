# JobPilot AI — Technical Stack

## Monorepo

- pnpm workspaces
- TypeScript

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Hook Form
- Zod

## Backend

- Node.js
- TypeScript
- Express
- REST API
- Zod

AI workflows run synchronously inside the API request that starts them. The MVP does not add a queue, a worker process, or a job runner.

## Authentication

- JWT access tokens sent as `Authorization` bearer tokens
- Access token lifetime: 15 minutes
- Refresh tokens
- Refresh token lifetime: 7 days
- Refresh tokens stored only in HttpOnly cookies, never in frontend-readable storage
- Server-side refresh sessions
- Refresh rotates the refresh token and revokes the previous session
- Logout revokes the server-side refresh session
- Argon2id password hashing
- Secure refresh cookies in production
- CORS credentials enabled so the browser sends the refresh cookie to the API

The web app and API may be different origins during local Docker development. Cookie `SameSite` and CORS must still allow the refresh request. The access token stays in the `Authorization` header.

## Database

- PostgreSQL
- Prisma ORM
- pgvector

pgvector stores embeddings for work experience and project records. Those embeddings are written when the records are created or updated. Only the MCP tool `search_candidate_experience` queries them. Uploaded resume files are not embedded. Interview questions are not embedded.

## AI

- Google Gemini API
- LangChain.js
- LangGraph.js
- Structured outputs
- Embeddings for work experience and projects
- RAG only inside `search_candidate_experience`

Keep these workflows separate and single-purpose. One LangGraph workflow must not invoke another:

1. Job analysis.
2. Resume tailoring.
3. Interview plan.
4. Interview question generation.
5. Answer evaluation.

The API calls one workflow per request and waits for it to finish.

## MCP

- Official Model Context Protocol TypeScript SDK
- Custom portfolio/candidate MCP server
- Streamable HTTP transport

`apps/api` is the MCP client. It calls `apps/portfolio-mcp` over Streamable HTTP.

The API attaches the authenticated user to the MCP request context before any tool runs. Tool schemas must not include a user id or other identity argument. `portfolio-mcp` must take identity only from that server context and must ignore identity supplied by the model.

MCP is the only AI-facing interface to candidate data. In the MVP, only resume tailoring may call it.

## File Storage

Development:
- Local storage where practical

Production:
- AWS S3

Stored resume uploads are files plus database metadata. The MVP does not parse or embed them.

Tailored resumes are JSON rows in PostgreSQL, one current row per job. They are not files.

## Testing

- Vitest
- Supertest
- Playwright

## Infrastructure

- Docker
- Docker Compose
- GitHub Actions

## Deployment

Initial:
- Local Docker environment

Later:
- AWS

## Architecture

Repository structure:

apps/
- web
- api
- portfolio-mcp

packages/
- ai
- database
- shared

specs/
- requirements.md
- tech-stack.md

`packages/ai` holds the five single-purpose workflows. `packages/database` holds Prisma and pgvector access. `packages/shared` holds schemas shared by the web app, API, and workflows. Vector queries stay in the MCP server's search tool, not in the workflows.

## Engineering Rules

- TypeScript strict mode.
- Avoid `any` unless justified.
- Validate API inputs with Zod.
- Keep business logic outside controllers.
- Use environment variables for secrets.
- Never expose Gemini API keys to the frontend.
- AI outputs should use structured schemas when possible.
- AI-generated resume claims must be grounded in candidate data and must reference source profile record ids.
- Candidate facts reach a model only as MCP tool results during resume tailoring.
- Never let the model choose the user id for an MCP call.
- Do not add queues or background workers in the MVP.
- Prefer simple implementations over unnecessary abstractions.
