# Notes

The implementation review passed with no blocking, high, medium, or low issues and no required code changes. An earlier review found two races; both were closed in the existing transactions before that passing review. Validation then passed on 2026-10-04.

These choices match the approved spec:

- `evaluateAnswer` is one LangGraph workflow with a single node and no checkpointer. It reads the stored question text, the stored rubric, and the trimmed answer, and it parses feedback and score with `answerEvaluationModelOutputSchema`. It does not call MCP, job analysis, resume tailoring, interview planning, or question generation, and it does not read environment variables.
- The evaluation model is resolved inside `submitInterviewAnswer` when `createApp` was not given `answerEvaluationModel`, and only after the 404 and 409 checks. `stub` uses the stub model. Unset or `gemini` with a non-empty `GEMINI_API_KEY` uses Gemini. Any other case fails with `502` and writes nothing. `GET`, `POST /jobs/:id/interview-attempts`, and `GET /health` do not resolve it.
- The model call finishes before the write. No database transaction stays open across the model call. A failed evaluation writes nothing and leaves that question unanswered.
- The score write updates that question only while `answer`, `feedback`, and `score` are all null. The eighth stored score sets the attempt to `completed` in the same transaction. Otherwise the status stays `in_progress`.
- Overlapping score writes lock `InterviewAttempt` with `SELECT ... FOR UPDATE` before the update and the scored-count check, so two commits cannot both see fewer than eight scores. A start that is still generating locks `Job`, then applies the in-progress check and the completed-attempt check before insert.
- A completed attempt does not occupy `InterviewAttempt_one_in_progress_per_job`. A later start returns `409` with `{ "error": "Interview attempt already completed" }` and does not call the question model.
- The new migration is only `ALTER TYPE "InterviewAttemptStatus" ADD VALUE 'completed';`. No column, overall score, category score, or readiness field was added. Job delete still cascades. A description change, a title-only patch, and a plan replace do not delete attempts or stored answers.
- `latestOverallScore` and `readinessBadge` stay null. The dashboard score and readiness stay `Not available`.
- The attempt screen stays the Phase 16 panel on the Phase 9 dashboard row. There is no routing library. The query key stays `["interview-attempt", userId, jobId]`.
- An unanswered question shows a textarea and `Submit answer`. A scored question shows the stored answer, feedback, and score, and hides those controls. A failed POST, including `502` with `{ "error": "Answer evaluation failed" }`, leaves the previous questions and the textarea in place.
- The response envelope is a strict `{ attempt: interviewAttemptSchema }` object. The attempt schema comes from `@jobpilot/shared`. A body that fails parsing shows `Request failed` and leaves the previous panel body.
- Signed-out removes interview-attempt queries from the in-memory TanStack Query client, and a user-id change removes the previous user's queries. The cache is not persisted.
- Compose sets `ANSWER_EVALUATION_MODEL` to `stub` on the API when that variable is unset. `.env.example` documents it as API-only. The web service does not receive it.
- No dependency was added. `.github/workflows/ci.yml` is unchanged.

Accepted deviations:

- The evaluation client is chosen inside `submitInterviewAnswer` after the 404 and 409 checks. A missing token, an invalid body, a missing question, and an already-answered question do not resolve `ANSWER_EVALUATION_MODEL`. A valid unanswered question with no client still returns `502` and writes nothing.
- The panel parses the textarea with `submitInterviewAnswerBodySchema` before POST, so the sent `answer` is the trimmed value. An empty or over-long value fails in the browser with `Request failed` and does not call the model. The API still enforces the same schema.
- Row locks use parameterized `SELECT ... FOR UPDATE` inside the existing transactions. The answer transaction locks `InterviewAttempt`. The start transaction locks `Job`, then applies the same in-progress check and the same completed-attempt check. Status codes and response bodies stay the ones in the spec.

The review noted these non-blocking gaps:

- No browser test asserts that interview-attempt query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs, tailored-resume, and interview-plan queries.
- Some database-backed API runs printed a Node deprecation from `pg` about `client.query()` during an open query. Every suite still exited 0.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
