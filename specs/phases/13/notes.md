# Notes

The implementation review passed with no blocking, high, medium, or low issues and no required code changes. Validation then passed on 2026-10-03.

These choices match the approved spec:

- `tailorResume` is one LangGraph workflow with `retrieve`, `load_sections`, and `draft`. It calls `search_candidate_experience` once, then the five section tools, then the model. It does not call `get_candidate_profile` or `get_project_details`.
- The API is the MCP client. `packages/ai` does not depend on `@modelcontextprotocol/sdk`. `apps/api` depends on `@modelcontextprotocol/sdk` `1.32.0`.
- The resume model and MCP client are resolved on `POST` only after authentication, the empty-body check, job ownership, and a current analysis. An injected client or model skips the matching environment variables.
- Grounding reads the owner's profile rows from the database after the workflow returns. It does not trust the tool payload. The workflow finishes before the upsert. No database transaction stays open across MCP or the model.
- A job has one `TailoredResume` row. `jobId` is unique, and generate upserts that row. A description change deletes it in the same transaction that stores the new analysis.
- `tailoredResumePresent` is derived from that row. The dashboard helper accepts a boolean and still renders `Not available`.
- `calendarDateSchema` is exported from `packages/shared` so the resume document uses the Phase 5 date rule. The date rule is unchanged. Prisma stores `document` as `JSONB`, the same mapping it uses for `Json` on `JobAnalysis`.
- Root `pnpm test` includes the new AI unit tests and excludes the database-backed tailored-resume suite. `.github/workflows/ci.yml` is unchanged.
- Compose sets `RESUME_MODEL` to `stub` on the API when that variable is unset, sets `MCP_URL` to `http://portfolio-mcp:3010/mcp`, passes `MCP_SHARED_SECRET`, and depends on `portfolio-mcp`. The web service does not receive those values.

The review noted one residual race that the spec allows. `POST` checks that analysis is current, then calls MCP and the model, then upserts. A description update that commits during that wait deletes the resume, and the in-flight upsert can write it back for the previous analysis. The spec says not to hold a database transaction across MCP or the model, and it does not require a second currency check before the upsert.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
