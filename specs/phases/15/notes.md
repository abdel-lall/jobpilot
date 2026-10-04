# Notes

The implementation review passed with no blocking, high, medium, or low issues and no required code changes. Validation then passed on 2026-10-04.

These choices match the approved spec:

- `planInterview` is one LangGraph workflow with a single node and no checkpointer. It reads the stored job analysis, builds the specified prompt, and parses categories with `interviewPlanModelOutputSchema`. Interview topics are copied from that analysis. It does not call MCP, job analysis, or resume tailoring, and it does not read environment variables.
- The plan model is resolved at the start of `POST /jobs/:id/interview-plan` when `createApp` was not given `interviewPlanModel`. `stub` uses the stub model. Unset or `gemini` with a non-empty `GEMINI_API_KEY` uses Gemini. Any other case fails with `502` and writes nothing. `GET` and `GET /health` do not resolve a model.
- The model call finishes before the upsert. No database transaction stays open across the model call. A failed generate writes nothing and keeps an existing row.
- A job has one `InterviewPlan` row. `jobId` is unique, and generate upserts that row. A description change deletes it in the same transaction that stores the new analysis and deletes the tailored resume. Job delete cascades to the plan.
- `interviewPlanPresent` is a boolean derived from that row. Jobs created before the migration are not backfilled.
- The job screen is a panel on the Phase 9 dashboard row. There is no routing library and no plan URL. At most one of the interview-plan panel and the tailored-resume panel is mounted.
- The plan query key is `["interview-plan", userId, jobId]`. The query reads the current in-memory access token and runs only while the panel is mounted and a token is present.
- `404` with `{ "error": "Not found" }` is the empty state `No interview plan yet.` Any other failed GET shows the API error string, or `Request failed`.
- The response envelope is a strict `{ plan: interviewPlanSchema }` object. The plan schema comes from `@jobpilot/shared`. A body that fails parsing shows `Request failed` and leaves the previous panel body.
- `Generate plan` posts `{}`. A successful response replaces the open panel and refetches `GET /jobs`. A failed POST, including `502` with `{ "error": "Interview plan generation failed" }`, leaves the previous body in place.
- Signed-out removes interview-plan queries from the in-memory TanStack Query client, and a user-id change removes the previous user's queries. The cache is not persisted.
- Compose sets `INTERVIEW_PLAN_MODEL` to `stub` on the API when that variable is unset. `.env.example` documents it as API-only. The web service does not receive it.
- No dependency was added. `.github/workflows/ci.yml` is unchanged.

Accepted deviations:

- The Playwright case reloads after the in-place replace, confirms the profile view, then opens the dashboard and the same stored plan before the description edit. That covers the acceptance criterion for a new dashboard visit. The specified generate, replace, clear, and `502` checks are still in that file.
- The plan query uses `retry: false` and `refetchOnWindowFocus: false`, the same settings as the jobs query.
- `{ plan: interviewPlanSchema }` is checked with a strict Zod object in the web app. The plan schema itself still comes from `@jobpilot/shared`.
- `readJsonBody` is local to the plan client, in the same form as the jobs client.
- Generate and load errors render as plain text inside the panel. The empty state is a `<p>`, not an alert.

The review noted these non-blocking gaps:

- No test asserts that interview-plan query keys were removed on sign-out or on a user-id change.
- The browser suite does not assert the loading line, an empty topic list rendering `None`, opening `Tailored resume` while the plan panel is open, or a title-only save in the open panel.
- The API case that leaves the previous row unchanged uses an unknown category. Duplicate categories, an empty category list, and extra keys are rejected in the workflow unit test on the same path before the write.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
