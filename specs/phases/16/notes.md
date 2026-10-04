# Notes

The implementation review passed with no blocking, high, medium, or low issues and no required code changes. Validation then passed on 2026-10-04.

These choices match the approved spec:

- `generateInterviewQuestions` is one LangGraph workflow with a single node and no checkpointer. It reads the stored plan and the job's stored question texts, calls `interviewQuestionCounts` before the first model call, and asks the model only for a category and the remaining count. The stored category is the TypeScript assignment. It does not call MCP, job analysis, resume tailoring, or interview planning, and it does not read environment variables.
- The question model is resolved at the start of `POST /jobs/:id/interview-attempts` when `createApp` was not given `interviewQuestionModel`. `stub` uses the stub model. Unset or `gemini` with a non-empty `GEMINI_API_KEY` uses Gemini. Any other case fails with `502` and writes nothing. `GET` and `GET /health` do not resolve a model.
- The model call finishes before the write. No database transaction stays open across the model call. A failed generate writes nothing.
- A job has at most one `in_progress` attempt. The partial unique index `InterviewAttempt_one_in_progress_per_job` is raw SQL in `20261004180000_interview_attempt` because Prisma cannot express the `WHERE status = 'in_progress'` clause. The attempt and its 8 questions are inserted together. Job delete cascades to both tables. A description change, a title-only patch, and a plan replace do not delete them.
- `normalizedText` is trimmed, internal whitespace is collapsed, and comparison is case-insensitive. It is not part of the public JSON.
- The attempt screen is a panel on the Phase 9 dashboard row. There is no routing library and no attempt URL. At most one of the attempt, plan, and tailored-resume panels is mounted.
- The attempt query key is `["interview-attempt", userId, jobId]`. The query reads the current in-memory access token and runs only while the panel is mounted and a token is present.
- `404` with `{ "error": "Not found" }` is the empty state `No interview attempt yet.` Any other failed GET shows the API error string, or `Request failed`.
- The response envelope is a strict `{ attempt: interviewAttemptSchema }` object. The attempt schema comes from `@jobpilot/shared`. A body that fails parsing shows `Request failed` and leaves the previous panel body.
- `Start attempt` posts `{}`. A successful response lists the 8 questions and hides the empty state. A failed POST, including `502` with `{ "error": "Interview question generation failed" }`, leaves the previous body in place and does not render questions.
- Signed-out removes interview-attempt queries from the in-memory TanStack Query client, and a user-id change removes the previous user's queries. The cache is not persisted.
- Compose sets `INTERVIEW_QUESTION_MODEL` to `stub` on the API when that variable is unset. `.env.example` documents it as API-only. The web service does not receive it.
- No dependency was added. `.github/workflows/ci.yml` is unchanged.

Accepted deviations:

- `interviewQuestionStructuredSchema` is an extra shared schema. Gemini structured output is bound to valid question items. The workflow still accepts or discards provider output with `interviewQuestionModelOutputSchema` and `interviewQuestionModelItemSchema`. `packages/ai` does not depend on Zod, so that object schema lives in `@jobpilot/shared`.
- The write transaction checks for an in-progress attempt and a normalized-text collision before insert, and still maps the partial unique index to `409` and a `normalizedText` unique failure to `502`.
- The Supertest duplicate case does not pre-insert a stored question. Any stored question belongs to an `in_progress` attempt, and that attempt returns `409` before the model runs. The workflow test covers a pre-supplied `Hello World` with three count-8 calls and a rejection.
- The attempt query uses `retry: false` and `refetchOnWindowFocus: false`, the same settings as the jobs query.
- `{ attempt: interviewAttemptSchema }` is checked with a strict Zod object in the web app. The attempt schema itself still comes from `@jobpilot/shared`.
- `readJsonBody` is local to the attempt client, in the same form as the jobs client.
- Start and load errors render as plain text inside the panel. The empty state is a `<p>`, not an alert.

The review noted these non-blocking gaps:

- No test asserts that interview-attempt query keys were removed on sign-out or on a user-id change.
- The browser suite does not assert Close, opening another panel on the same row, or a description save that keeps the open questions on screen.
- No API test sends a plan document that fails `interviewPlanSchema`, and no test starts two requests at once against the partial unique index.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
