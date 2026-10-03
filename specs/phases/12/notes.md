# Notes

One behavior was added after the first review. `@langchain/google-genai` 2.3.2 ignores `stripNewLines: false` in the constructor, so both Gemini embedding instances stayed at the default `true` and would flatten newline-separated documents. `createGeminiEmbeddingClient` still passes `stripNewLines: false` into both constructors, then sets `documents.stripNewLines = false` and `queries.stripNewLines = false` after construction. A unit test builds that client with a dummy key and model name and expects the flag to be false. It does not call the network. The second review found no required code changes.

These other choices match the approved spec and the approved plan:

- `search_candidate_experience` runs one `<=>` query for ids, then loads the Phase 11 public objects by id. That follow-up query does not use a distance operator. `<=>` appears only in `apps/portfolio-mcp/src/search.ts`.
- The model table lives in `selectEmbeddingClient` in `packages/ai`. That function does not read the environment. The API and MCP pass `EMBEDDING_MODEL`, `GEMINI_API_KEY`, and `GEMINI_EMBEDDING_MODEL` when a create, update, or search runs.
- The search schema types `query` as an optional unknown value and checks it in the handler, the same way Phase 11 checks `projectId`. A bad query is the tool error `Invalid input`. Unknown keys are stripped.
- The embedding call runs before the write transaction. A failed create inserts nothing. A failed update does not open the write, so the previous fields and vector stay in place.
- Every vector is checked before it is stored or used for search, including vectors from injected clients. It must be 768 finite numbers and not all zeros.
- `apps/portfolio-mcp` depends on the existing `@jobpilot/ai` package for this client. No new external package was added. The server still starts without an embedding client. Search resolves one only when that tool runs.
- Root `pnpm test` stays the API and AI unit tests. The profile and MCP suites need PostgreSQL and are not part of that command. `.github/workflows/ci.yml` is unchanged.
- Compose sets `EMBEDDING_MODEL=stub` on the API and MCP services when that variable is unset. The web service does not receive Gemini, embedding, JWT, database, or MCP settings.

The second review found no blocking, high, medium, or low issues.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
- The Compose image was built before the newline assignment. Compose uses the stub client. The running containers were not rebuilt.
