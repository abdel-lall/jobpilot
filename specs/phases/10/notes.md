# Notes

No behavior departs from the approved spec. These choices match that spec and the approved plan:

- Job authentication stays at the jobs route. The route passes the verified `userId` into the jobs service. The service decides whether analysis is required, calls the workflow, persists by that user id, derives `analysisCurrent`, and owns the database transaction. It does not read or verify bearer tokens. Profile and resume services still take the `Authorization` header. `401` behavior is unchanged, and authentication still happens before any model call.
- `packages/ai` adds `@types/node` so its typecheck matches the other packages. `@langchain/core`, `@langchain/langgraph`, `@langchain/google-genai`, `@jobpilot/shared`, and Vitest are the dependencies the phase specifies.
- The model runs before the write transaction. Create stores the job and one analysis row together. A description change replaces that row. A model failure does not write.
- `analysisCurrent` is derived by comparing `analyzedDescription` with the current `jobDescription`. It is not a column. Existing jobs are not backfilled.
- Compose sets `JOB_ANALYSIS_MODEL=stub` when that variable is unset. The web service does not receive `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `JWT_SECRET`, or `DATABASE_URL`.

The review found no required code changes and no non-blocking defects.

Unresolved:

- The optional live Gemini check was not run.
- No pre-migration job was available on the dashboard. The jobs API test covers a job with no analysis row.
