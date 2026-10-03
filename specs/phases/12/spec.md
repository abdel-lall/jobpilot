# Phase 12 — Embeddings and candidate search

## Objective

Make `search_candidate_experience` the only RAG path.

## Scope

This phase adds only the embedding and search behavior described in the Phase 12 section of `specs/roadmap.md`:

- Creating or updating work experience or a project writes a 768-dimension embedding in that same request.
- Deleting one of those records deletes its embedding.
- If embedding generation fails, the profile write is not committed. A failed create leaves no row and no embedding. A failed update leaves the previous row and its previous embedding unchanged.
- `search_candidate_experience` embeds the query, queries pgvector, and returns matching experience and projects for the context user only.
- Skills, education, certifications, uploaded files, and interview questions are not embedded.
- No workflow queries pgvector directly. Embeddings are not a LangGraph workflow.

The roadmap names the write, delete, and search rules. It does not name the column, the vector size, the embedded text, the tool arguments, or the result JSON. The contract below closes those gaps.

### Stored vector

`WorkExperience` and `Project` each gain one nullable column, `embedding`, in one new migration. Do not edit these migrations:

- `20260930120000_enable_vector`
- `20261001050000_user_refresh_session`
- `20261001140000_candidate_profile`
- `20261001180000_resume_file`
- `20261001220000_job`
- `20261002120000_job_analysis`

The column type is `vector(768)`. It stays nullable. Rows saved before this migration keep `NULL` until a later successful update. Do not backfill them and do not call Gemini during migration.

Prisma stores the column as `Unsupported("vector(768)")?`. Profile JSON and the seven Phase 11 tools never select it and never return it.

There is no separate embedding table and no approximate-nearest-neighbor index. Each user has only their own experience and project rows, so the search tool scans that user's non-null vectors.

Deleting a work-experience or project row deletes its embedding because the vector is a column on that row. Deleting a user still cascades to those rows. Deleting a job, a skill, an education row, a certification, or a resume file does not touch these columns.

### Text that is embedded

The embedding input is one document built from the record that will be stored. Dates use the UTC calendar date `YYYY-MM-DD`, the same conversion the profile API uses. Accomplishments and technologies keep stored order. Lines are separated by `\n`. There is no trailing newline.

Work experience:

```text
Employer: <employer>
Job title: <jobTitle>
Start date: <YYYY-MM-DD>
End date: <YYYY-MM-DD or Present>
Accomplishments:
- <accomplishment>
Technologies: <technologies joined by ", ", or none>
```

`End date` is `Present` when the stored end date is null. One accomplishment is required, so the accomplishment lines are always `- ` bullets. `Technologies` is `none` when that array is empty.

Project:

```text
Name: <name>
Description: <description>
URL: <url or none>
Start date: <YYYY-MM-DD or none>
End date: <YYYY-MM-DD or none>
Accomplishments:
- <accomplishment>
Technologies: <technologies joined by ", ", or none>
```

`URL`, `Start date`, and `End date` use `none` when null. When accomplishments are empty, the accomplishments section is the single line `none` instead of bullets:

```text
Accomplishments:
none
```

A create embeds the body that passed validation, with omitted optional nulls treated as null. An update embeds the merged record: patched fields override the stored row, and omitted fields stay as stored. The client receives that full document, not a diff.

The document does not include `id`, `userId`, email, timestamps, resume text, job text, or other profile sections.

### Embedding client

`packages/ai` exports an embedding client. This is not a sixth workflow. It does not use LangGraph, does not read the database, and does not query pgvector.

```ts
type EmbeddingClient = {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
};
```

`createStubEmbeddingClient()` does not use the network and does not read environment variables. Both methods return the same 768-number vector for every string: index 0 is `1`, and every other index is `0`.

`createGeminiEmbeddingClient(apiKey: string, modelName: string)` calls the Gemini embeddings API through `@langchain/google-genai`. `embedDocument` uses task type `RETRIEVAL_DOCUMENT`. `embedQuery` uses task type `RETRIEVAL_QUERY`. The model id is the given `modelName`. Output dimensionality is always `768`. `gemini-embedding-001` does not normalize truncated vectors, so the client L2-normalizes the returned vector before resolving. A provider error, a vector whose length is not 768, a non-finite component, or a zero vector rejects.

The workflow module does not read environment variables. Callers pass the key and the model id.

### When the API writes a vector

Validate the body and authenticate before any embedding call. A `400` or `401` does not embed. A get or list does not embed. Skill, education, certification, resume, and job routes do not embed.

`POST /profile/experience` and `POST /profile/projects` embed the create document. On success, one database transaction inserts the row and sets `embedding`. On failure, it inserts nothing and returns `502` with `{ "error": "Embedding failed" }`.

`PATCH /profile/experience/:id` and `PATCH /profile/projects/:id` load the owned row first. A missing id or another user's id returns `404` and does not embed. An invalid merged date range returns `400` and does not embed. Otherwise the request embeds the merged document. On success, one transaction stores the new fields and replaces `embedding`. On failure, that transaction does not run: the previous fields and the previous embedding stay as they were, and the response is `502` with `{ "error": "Embedding failed" }`.

`DELETE /profile/experience/:id` and `DELETE /profile/projects/:id` do not embed. They delete the owned row. The embedding disappears with the row. A missing id is still `404`.

Run the embedding call before opening the write transaction. Do not hold a database transaction open across the embedding call.

The public JSON for experience and projects stays the Phase 5 object. It does not gain an embedding field. List order, ownership, and the `401`, `400`, and `404` bodies stay as they are.

Map every embedding failure to that same `502` body. That includes a missing client, a thrown client, a vector that is not 768 finite numbers, and a zero vector. Do not return the provider message, the document, or the API key. Do not log profile field values, the document, the vector, access tokens, refresh tokens, passwords, or `JWT_SECRET`.

The API may set the column with a parameterized `UPDATE ... SET embedding = ...::vector`. That statement is a write. It must not use `<=>`, `<->`, or `<#>`.

### Model selection

`createApp` accepts the existing options plus an optional `embeddingClient`. Constructing the app does not call Gemini and does not require `GEMINI_API_KEY`.

When `embeddingClient` is provided, experience and project creates and updates use it and do not read `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, or `EMBEDDING_MODEL`.

When it is omitted, resolve the client at the start of an experience or project create or update, after authentication, validation, the `404` check, and the merged date check:

| `EMBEDDING_MODEL` | `GEMINI_API_KEY` | Client |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubEmbeddingClient()` |
| unset or `gemini` | non-empty | Gemini, model `GEMINI_EMBEDDING_MODEL` or else `gemini-embedding-001` |
| unset or `gemini` | empty | no client |
| any other value | any | no client |

No client is an embedding failure: `502` and no write. `GET /health` does not resolve a client. Job analysis still uses `JOB_ANALYSIS_MODEL` only.

Compose sets `EMBEDDING_MODEL` to `stub` on the API when that variable is unset in the shell, so local Playwright can save experience and projects without calling Gemini. A live manual run sets `EMBEDDING_MODEL=gemini` and a real `GEMINI_API_KEY`.

Document `EMBEDDING_MODEL` and `GEMINI_EMBEDDING_MODEL` in `.env.example`. `EMBEDDING_MODEL` is `stub` or `gemini`. `GEMINI_EMBEDDING_MODEL` overrides the embedding model id. The web service still does not receive `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `JWT_SECRET`, `DATABASE_URL`, or `MCP_SHARED_SECRET`.

### Search tool

`apps/portfolio-mcp` registers `search_candidate_experience` next to the seven Phase 11 tools. Those seven tools stay as Phase 11 defined them, including their JSON, and they still do not query pgvector.

The search tool takes the user only from `x-jobpilot-user-id` after the shared secret matches. Its schema has no `userId`, `email`, or other identity field. Unknown keys are stripped. A caller-supplied identity does not change the filter.

| Argument | Rule |
| --- | --- |
| `query` | required string, trimmed, length 1 through 2000 |

A missing `query`, a non-string `query`, or a trimmed value outside that length is a tool error: `isError: true`, text `Invalid input`. Do not embed and do not query vectors.

On a valid query, call `embedQuery` with the trimmed query. Then run one similarity query. The only database code that uses a vector distance operator is this tool. The operator is cosine distance, `<=>`. The query reads `WorkExperience` and `Project` rows whose `userId` is the context user and whose `embedding` is not null. It orders by distance ascending, then `createdAt` ascending, then `id` ascending, and keeps 8 rows. Rows with a null embedding are absent. Another user's rows are absent, including a row whose vector is nearer than the context user's rows.

A successful tool returns `isError: false` and one text content part. The text is `JSON.stringify` of:

```json
{
  "matches": [
    { "kind": "experience", "experience": {} },
    { "kind": "project", "project": {} }
  ]
}
```

`experience` is the Phase 11 public work-experience object. `project` is the Phase 11 public project object. A match contains `kind` and exactly one of those two objects. Order is the similarity order. The JSON does not include distance, the vector, `userId`, email, password hashes, resume files, jobs, or job analysis.

If the search client is missing, throws, or returns a vector that cannot be used, the tool returns `isError: true` and text `Search failed`. It does not query vectors. The text does not include the provider message, the query, or the API key. Do not log the query, profile fields, the vector, `MCP_SHARED_SECRET`, access tokens, or `JWT_SECRET`.

`startHttpServer` accepts an optional embedding client. When the test or caller provides one, search uses it and does not read `EMBEDDING_MODEL` or `GEMINI_API_KEY`. When it is omitted, resolve the client when the search tool runs, using the same table as the API. Process start does not require an embedding client. The seven exact tools still run when the client cannot be resolved.

Compose sets `EMBEDDING_MODEL` to `stub` on `portfolio-mcp` when that variable is unset. The MCP service also receives `GEMINI_API_KEY` and `GEMINI_EMBEDDING_MODEL` so a live search can embed the query. It still does not receive `JWT_SECRET`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, or `RESUME_STORAGE_DIR`.

The image build installs the workspace, then builds `@jobpilot/shared`, `@jobpilot/database`, `@jobpilot/ai`, and `@jobpilot/portfolio-mcp`. `apps/portfolio-mcp` depends on `@jobpilot/ai` for this client only. It still does not run job analysis or any LangGraph workflow.

No AI workflow calls the server. Phase 13 is when the API attaches the session user and calls this tool.

## Affected subsystems

- RAG and embeddings
- MCP
- Candidate profile
- `apps/portfolio-mcp`
- `packages/database`
- `packages/ai`
- `apps/api`

`packages/database` gains the two columns and the migration. It does not export a search function. `packages/ai` gains the embedding client and does not query vectors. `apps/api` writes vectors on experience and project saves. `apps/portfolio-mcp` is the only code that queries vectors, and only inside `search_candidate_experience`.

`apps/web` stays as Phase 9 and Phase 10 left it. The profile UI already shows the API `error` string, so a `502` is visible without a new screen.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 12:

- The API acting as an MCP client, attaching the session user, and any LangGraph workflow calling this server. Phase 13. Only resume tailoring may call MCP.
- Tailored resume generation and UI. Phases 13 and 14.
- Interview plans, question generation, answer evaluation, retakes, scores, and the readiness badge. Phases 15 through 18.
- New profile fields, new profile routes, and edits to the Phase 5 HTTP contract other than the `502` embedding failure on experience and project writes.
- A profile UI change, a jobs UI change, or a dashboard change.
- Reading, parsing, or embedding uploaded resume files. Phase 7 files stay stored and unused.
- Embedding skills, education, certifications, jobs, job analyses, or interview questions.
- A backfill, a queue, a worker, or a background repair for rows whose embedding is null or whose embedding call failed.
- An approximate-nearest-neighbor index.
- Changing auth token lifetimes, hashing, session rotation, or auth response bodies.
- Changing job create, update, analysis, or the `502` analysis failure body.
- A new product table, or a change to an existing migration.
- A GitHub Actions PostgreSQL service or a Playwright job. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phases 5 and 11.

Phase 5 provides work experience and projects and their write routes. Phase 11 provides the MCP server, the trusted headers, and the public profile JSON this search result reuses. Phase 10 is merged and provides the Gemini client pattern in `packages/ai`. This phase does not change job analysis.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 12, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Packages

- Add the embedding client to `packages/ai`. Add `packages/ai/src/embedding.test.ts`. The stub test is part of root `pnpm test`. It does not read `GEMINI_API_KEY` and does not call the network.
- Keep TypeScript strict. Avoid `any` unless justified.
- Do not add a LangGraph graph for embeddings. Do not add a queue, a worker, or a job runner.
- `apps/api` already depends on `@jobpilot/ai`. Pass the client into the profile service from `createApp`.
- `apps/portfolio-mcp` may depend on `@jobpilot/ai` for the embedding client. Do not add a second Gemini SDK.

### Tests

- Update `apps/api/src/profile.integration.test.ts`. The main app receives `createStubEmbeddingClient()`. Unset `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL`, and `EMBEDDING_MODEL` in that file. Existing profile assertions still pass, and experience and project JSON still has no embedding field.
- Assert a stubbed create stores a 768-dimension vector on that row, a stubbed update replaces it, and a delete removes the row. Assert the create and the update call `embedDocument` with the document defined above, and do not call `embedQuery`.
- Assert a stubbed embedding failure on create leaves no new row. Assert a failure on update leaves the previous fields and the previous vector unchanged. Both responses are `502` and `{ "error": "Embedding failed" }`.
- Assert skill, education, and certification creates do not call the embedding client.
- Assert an experience create with no injected client, and with `EMBEDDING_MODEL` and `GEMINI_API_KEY` unset, returns `502` and writes nothing.
- Update `apps/portfolio-mcp/src/mcp.test.ts`. The existing seven tools still pass. `tools/list` is those seven tools plus `search_candidate_experience`. The search schema has no `userId` or `email`.
- Seed two users. Store two vectors for the first user, one experience and one project, and one nearer vector for the second user's experience. Inject an embedding client whose `embedQuery` returns the query vector. Assert the first match is the first user's nearer record, the second match is the first user's farther record, and the second user's fact text is absent.
- Assert an extra `userId` argument set to the second user does not change that order.
- Assert a missing or overlong `query` returns `Invalid input` and does not call the client.
- Assert a client that rejects returns `Search failed` and no matches JSON.
- Set `DATABASE_URL` and `MCP_SHARED_SECRET` for the MCP run. Do not set `GEMINI_API_KEY` for that run.
- Each test deletes the users it created.
- `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, and `test:jobs` still pass.
- Do not add a Playwright case. The existing profile cases create and edit experience and projects, so Compose must use the stub client for those saves to succeed.

### Runtime

- `pnpm typecheck` includes the new client and the MCP search tool.
- `pnpm test` and `pnpm typecheck` still pass with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, and `MCP_SHARED_SECRET` unset.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
