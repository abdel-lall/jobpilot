# Phase 17 — Answer evaluation

## Objective

Score one answer at a time on the open interview attempt, store the feedback and integer score on that question, and mark the attempt complete only after all 8 questions have scores.

## Scope

This phase adds only the answer-evaluation behavior described in the Phase 17 section of `specs/roadmap.md`:

- The user submits one answer at a time.
- `packages/ai` contains one single-purpose LangGraph workflow that reads that question, its rubric, and the answer. It does not call MCP.
- The workflow returns structured feedback and an integer score from 0 through 100.
- The API stores the answer, feedback, and score on that question.
- The attempt stays in progress until all 8 questions have scores. The write that stores the eighth score marks the attempt complete.
- The dashboard still ignores the attempt. `latestOverallScore` and `readinessBadge` stay null during an in-progress attempt and after it is complete.

The roadmap names the per-answer workflow, the score range, the completion rule, and the dashboard freeze. It does not name the route, the request body, the widened question JSON, the failure status, or how the attempt panel accepts an answer. The contract below closes those gaps.

### Evaluation document

`answerEvaluationModelOutputSchema` in `packages/shared` is a `.strict()` object:

| Field | Type |
| --- | --- |
| `feedback` | string, trimmed, length 1 through 4000 |
| `score` | integer from 0 through 100 |

`packages/ai` imports that schema from `@jobpilot/shared`. The API does not parse the model output itself. The web app does not import it.

`submitInterviewAnswerBodySchema` is a `.strict()` object with one field, `answer`: a string, trimmed, length 1 through 4000. The API and the web app use this schema. A missing field, a non-string, an empty string after trim, a string longer than 4000 after trim, or any unknown key is invalid.

### Stored question and attempt JSON

`interviewQuestionSchema` in `packages/shared` no longer requires `answer`, `feedback`, and `score` to be null. It is a union of two `.strict()` objects that share `id`, `position`, `text`, `category`, `expectedConcepts`, and `rubric` as Phase 16 defined them.

Unanswered branch:

| Field | Type |
| --- | --- |
| `answer` | `null` |
| `feedback` | `null` |
| `score` | `null` |

Scored branch:

| Field | Type |
| --- | --- |
| `answer` | string, trimmed, length 1 through 4000 |
| `feedback` | string, trimmed, length 1 through 4000 |
| `score` | integer from 0 through 100 |

A question with only some of `answer`, `feedback`, and `score` set does not match either branch. Score `0` is scored. Score `null` is unanswered.

`interviewAttemptSchema` keeps `id`, `jobId`, and `questions`. `questions` is still length 8, ordered by `position`, and the positions are still exactly 1 through 8. `status` becomes the enum `in_progress` or `completed`.

- If any question is unanswered, `status` must be `in_progress`.
- If all 8 questions are scored, `status` must be `completed`.

`normalizedText` stays off the public schema. A fresh attempt from `POST /jobs/:id/interview-attempts` still matches this schema: status `in_progress`, and every question unanswered.

### Stored rows

Do not add a table or a column. `InterviewQuestion.answer`, `feedback`, and `score` already exist. This phase writes them.

`packages/database` changes `InterviewAttemptStatus` in one new migration named `20261004220000_interview_attempt_completed`. The migration SQL is only:

```sql
ALTER TYPE "InterviewAttemptStatus" ADD VALUE 'completed';
```

Do not insert a row in that migration. Do not edit these migrations:

- `20260930120000_enable_vector`
- `20261001050000_user_refresh_session`
- `20261001140000_candidate_profile`
- `20261001180000_resume_file`
- `20261001220000_job`
- `20261002120000_job_analysis`
- `20261003120000_experience_project_embedding`
- `20261003160000_tailored_resume`
- `20261004120000_interview_plan`
- `20261004180000_interview_attempt`

The Prisma enum gains the value `completed` after `in_progress`. The partial unique index `InterviewAttempt_one_in_progress_per_job` stays. A completed attempt does not occupy it.

Deleting a job still deletes its attempts and questions. A description change still deletes the tailored resume and the interview plan and still does not delete attempts, questions, answers, feedback, or scores. A failed analysis does not open that transaction. A title-only patch does not delete the attempt. Replacing the interview plan does not delete the attempt or its answers.

This phase does not add an overall-score column, a category-score column, or a readiness column.

### Public job JSON

Create, list, get, and update still return the Phase 16 job object. `status.latestOverallScore` and `status.readinessBadge` stay `null` while the attempt is in progress and after it is complete. `status.analysisCurrent`, `status.tailoredResumePresent`, and `status.interviewPlanPresent` stay as Phase 16 defined them. The job object does not gain an attempt field.

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them.

### Routes

All three routes require the access token. A missing or invalid token is `401` with `{ "error": "Unauthorized" }` and does not call a model.

| Method and path | Behavior |
| --- | --- |
| `POST /jobs/:id/interview-attempts` | Start the attempt, unchanged except the completed-attempt check below |
| `GET /jobs/:id/interview-attempts/current` | Read that job's attempt, including a completed one |
| `POST /jobs/:id/interview-attempts/current/questions/:questionId/answer` | Score one answer |

`GET` returns `200` and `{ "attempt": <interviewAttemptSchema> }` for the job's attempt whether `status` is `in_progress` or `completed`. The response uses the stored status and the stored `answer`, `feedback`, and `score`. It does not replace those fields with null or force `in_progress`. `GET` uses `404` with `{ "error": "Not found" }` when the job is missing, the job belongs to another user, or the job has no attempt. `GET` does not call a model.

`POST /jobs/:id/interview-attempts` keeps the Phase 16 checks, in the same order, for a missing or stale analysis, a missing or invalid plan, and an existing `in_progress` attempt. The in-progress failure stays `409` with `{ "error": "Interview attempt already in progress" }`. After that check, if the job already has an attempt, the response is `409` with `{ "error": "Interview attempt already completed" }` and the question-generation model is not called. Retakes stay in Phase 18. This check is what keeps a completed attempt from becoming a second attempt.

The answer route reads `:questionId` as the stored question id. A successful response is `200` and `{ "attempt": <interviewAttemptSchema> }`.

Checks run in this order. Authenticate first. Validate the JSON body second. A `401` or `400` does not call the evaluation model and does not read the job for the model. After the body is valid:

| Condition | Status | Body |
| --- | --- | --- |
| Missing job, another user's job, no attempt on that job, or `questionId` is not a question on that attempt | `404` | `{ "error": "Not found" }` |
| That question already has a score, an answer, or feedback | `409` | `{ "error": "Question already answered" }` |
| The attempt status is not `in_progress` | `409` | `{ "error": "Interview attempt already completed" }` |

Each of those failures skips the model and writes nothing. Any other question on the attempt stays as it was.

### Workflow

`packages/ai` exports:

```ts
type AnswerEvaluationModelInput = {
  questionText: string;
  rubric: string;
  answer: string;
  prompt: string;
};

type AnswerEvaluationModel = {
  evaluate(input: AnswerEvaluationModelInput): Promise<unknown>;
};

evaluateAnswer(
  questionText: string,
  rubric: string,
  answer: string,
  model: AnswerEvaluationModel,
): Promise<{ feedback: string; score: number }>
```

`evaluateAnswer` returns the parsed feedback and score or rejects. The LangGraph graph has one node and no checkpointer. It does not call another workflow. The model has no tools. The graph does not call MCP. It does not call `analyzeJobDescription`, `tailorResume`, `planInterview`, or `generateInterviewQuestions`.

The node calls `model.evaluate` once. There is no second round. The prompt is exactly this string. `questionText`, `rubric`, and `answer` are the three function arguments, already trimmed.

```text
Evaluate this interview answer. Return feedback and an integer score from 0 through 100. Use only the question, the rubric, and the answer. Do not use a candidate profile.

Question: <questionText>
Rubric: <rubric>
Answer: <answer>
```

`questionText` is the stored question text. `rubric` is the stored rubric. `answer` is the trimmed submitted answer. The model input is `questionText`, `rubric`, `answer`, and `prompt` only. It does not include expected concepts, the category, the job description, the plan, other questions, profile records, resume file text, the tailored resume, or the user id.

A thrown error from `model.evaluate` rejects the workflow. A value that fails `answerEvaluationModelOutputSchema` rejects the workflow. That includes a missing field, an unknown key, a non-integer score, a score below 0, a score above 100, and feedback that is empty after trim. The workflow does not clamp an out-of-range score.

### Stub model

`createStubAnswerEvaluationModel()` returns a model that does not call the network. For every input it returns:

```json
{ "feedback": "stub-feedback", "score": 80 }
```

### When the API calls the workflow

Validate the body and authenticate before any model call. A `400` or `401` does not call the evaluation model. A get, a job create, a job list, a job update, a job delete, or `POST /jobs/:id/interview-attempts` does not call the evaluation model. A `404` or `409` from the table above does not call it.

On a valid unanswered question, trim `answer` and call `evaluateAnswer` with the stored question text, the stored rubric, and that trimmed answer.

Run the model before opening the write. Do not hold a database transaction open across the model call.

On workflow failure, write nothing. The response is `502` with `{ "error": "Answer evaluation failed" }`. That question stays unanswered. The other questions stay as they were. The attempt status stays `in_progress`.

On success, open one transaction. Inside it, update that question only when its `answer`, `feedback`, and `score` are all null, setting them to the trimmed answer, the workflow feedback, and the workflow score. If that update matches no row, roll back and return `409` with `{ "error": "Question already answered" }`. If the attempt is no longer `in_progress`, roll back and return `409` with `{ "error": "Interview attempt already completed" }`. If all 8 questions on the attempt now have scores, set the attempt status to `completed` in that same transaction. Otherwise leave the status `in_progress`. Then commit. The response is the parsed attempt.

Map every workflow failure to that same `502` body. Do not return the provider message, the prompt, or the API key. Do not log the answer, the feedback, the question text, the rubric, the prompt, the model output, access tokens, refresh tokens, passwords, or `JWT_SECRET`.

### Model selection

`createApp` accepts the existing options plus an optional `answerEvaluationModel`. Constructing the app does not call Gemini and does not require `GEMINI_API_KEY`.

When `answerEvaluationModel` is provided, answer evaluation uses it and does not read `GEMINI_API_KEY`, `GEMINI_MODEL`, or `ANSWER_EVALUATION_MODEL`.

When it is omitted, resolve the model at the start of `POST /jobs/:id/interview-attempts/current/questions/:questionId/answer`:

| `ANSWER_EVALUATION_MODEL` | `GEMINI_API_KEY` | Client |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubAnswerEvaluationModel()` |
| unset or `gemini` | non-empty | Gemini, using `GEMINI_MODEL` or `gemini-2.5-flash` |
| unset or `gemini` | empty | no client |
| any other value | any | no client |

No client is an evaluation failure: `502` and no write. `GET /health` does not resolve this model. `GET /jobs/:id/interview-attempts/current` and `POST /jobs/:id/interview-attempts` do not resolve it.

Compose sets `ANSWER_EVALUATION_MODEL` to `stub` on the API when that variable is unset in the shell. A live manual run sets `ANSWER_EVALUATION_MODEL=gemini` and a real `GEMINI_API_KEY`.

Document `ANSWER_EVALUATION_MODEL` in `.env.example` as API-only. The web service still does not receive it.

The Gemini client sends that call's prompt to Gemini with structured output bound to `answerEvaluationModelOutputSchema`. It returns the provider value to the workflow. `createGeminiAnswerEvaluationModel(apiKey: string, modelName: string)` receives both values from the API. The workflow module does not read environment variables.

### Attempt screen

The signed-in shell stays the Phase 9 view switcher. Do not add a routing library. The attempt panel stays the Phase 16 panel on the dashboard job row. Opening, closing, and unmounting rules stay as Phase 16 defined them. The query key stays `["interview-attempt", userId, jobId]`.

`GET /jobs/:id/interview-attempts/current` still runs only while the panel is mounted and the access token is present. A `404` is still the empty state `No interview attempt yet.` A later `200` for a completed attempt is the attempt, not the empty state.

Each unanswered question shows a textarea, `data-testid="interview-question-answer-input"`, and a button named `Submit answer` with `data-testid="interview-question-submit"`. Use the existing `Textarea` and `Button` components. The textarea and the button sit in that question's `interview-question` item. A scored question does not show the textarea or `Submit answer`.

`Submit answer` sends `POST /jobs/:id/interview-attempts/current/questions/:questionId/answer` with `{ "answer": <textarea value> }`. `:questionId` is that question's `id`. Disable every `Submit answer` button on the panel while one such POST is in flight. Leave the questions on screen during the request. Do not close the panel and do not switch views. Do not clear the textarea when the request fails.

A successful POST returns `200` and `{ attempt: interviewAttemptSchema }`. Parse that body with `interviewAttemptSchema`. Show the parsed attempt. The submitted question shows its stored answer on `data-testid="interview-question-answer"`, its feedback on `data-testid="interview-question-feedback"`, and its score as a decimal integer string on `data-testid="interview-question-score"`. The other questions stay as the parsed attempt describes them. Hide the empty state and hide `Start attempt` while any attempt is on screen, including a completed one.

A failed POST shows the API `error` string, or `Request failed` when the body has no `error` string, inside the panel and leaves the previous questions in place. A `502` does not show feedback or a score for that question. A `200` body that fails `interviewAttemptSchema` shows `Request failed` and leaves the previous questions in place.

The panel still lists question text, category, expected concepts, and rubric as Phase 16 defined them. Do not show a raw JSON dump. Do not show `normalizedText`, `userId`, `createdAt`, `updatedAt`, the prompt, a password, a refresh token, or an access token. Do not show an overall score or a readiness badge inside the panel.

### Dashboard flag

`job-score` stays `Not available`. `job-readiness` stays `Not available`. An in-progress attempt does not change either line. A completed attempt does not change either line. `job-analysis`, `job-tailored-resume`, and `job-interview-plan` stay as Phases 10, 14, and 15 defined them.

A successful answer does not change the job list payload. A description save keeps the open attempt, including any stored answers, when the attempt panel is the open panel. Delete still closes the panel.

### Cache

Attempt answer requests use the same client rules as the Phase 16 attempt requests: `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` with `credentials: "include"`. They do not go through the Vite `/health` proxy. On success, write the parsed attempt into the existing `["interview-attempt", userId, jobId]` cache entry.

When the session transitions to `signed-out`, the existing removal of interview-attempt queries still runs. A user-id change still removes the previous user's interview-attempt queries. Do not persist the query cache. Do not write the access token to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.

## Affected subsystems

- Interview assessment
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`
- `packages/shared`

`apps/portfolio-mcp` stays as Phase 12 left it. This workflow does not call it. Credentialed CORS on the API already allows `POST` with `Content-Type` and `Authorization` from `WEB_ORIGIN`. If a browser on `http://localhost:5173` cannot call the answer route on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change resume, job, auth, plan, or analysis status codes or response bodies.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 17:

- The overall score, category scores, the pass rule, the `Interview Ready` badge, and showing a latest score on the dashboard. Phase 18.
- Starting another attempt after a pass or a fail. Phase 18. This phase rejects that start.
- Replacing an answer that already has feedback and a score.
- Semantic scoring, a retry loop, or a second model call after a schema failure.
- A workflow that calls MCP, job analysis, interview planning, resume tailoring, or question generation.
- Calling Gemini or `@jobpilot/ai` from the web app.
- Parsing or displaying uploaded resume files.
- A routing library, a `/jobs` path, and restoring the dashboard or the open panel after reload.
- A queue, a worker process, or a job runner.
- A client refresh that runs when an answer request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing auth, profile, embedding, MCP, resume grounding, the job-analysis prompt, the interview-plan prompt, or the interview-question prompt.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phase 16.

Phase 16 provides the in-progress attempt, the 8 stored questions, the null answer fields, and the attempt panel. Phase 9 provides the dashboard row.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 17, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Workflow and API

- Keep business logic outside the route handlers.
- Validate the answer body with `submitInterviewAnswerBodySchema` from `@jobpilot/shared`. Reject unknown keys.
- `packages/ai` does not import `@modelcontextprotocol/sdk`. `evaluateAnswer` does not call `analyzeJobDescription`, `tailorResume`, `planInterview`, or `generateInterviewQuestions`.
- The only new database write is the question update, plus the attempt status update on the eighth score. Job delete still cascades. Description change, plan replace, and title-only update do not delete answers.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Do not add a dependency.

### Web

- Keep the profile view, job forms, analysis label, tailored-resume panel, and interview-plan panel as Phases 9, 10, 14, and 15 left them.
- Keep the attempt panel mount rules from Phase 16. Add the answer control only inside an unanswered question.
- Use the existing Button, Textarea, and TanStack Query patterns. Do not add a dependency.
- Parse the attempt response with `interviewAttemptSchema` from `@jobpilot/shared`. Do not copy that schema into the web app.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `ANSWER_EVALUATION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini or MCP from the browser.

### Tests

- Add `packages/ai/src/answer-evaluation.test.ts`. It runs inside `pnpm --filter @jobpilot/ai test` and root `pnpm test`.
- The stubbed evaluation returns `{ feedback: "stub-feedback", score: 80 }`. `answerEvaluationModelOutputSchema` accepts scores 0, 80, and 100, and rejects -1, 101, and 1.5.
- A workflow test records one `evaluate` call. The input keys are `questionText`, `rubric`, `answer`, and `prompt` only. The prompt contains the question text, the rubric, and the answer, and it does not contain a profile sentinel that was never placed in those three strings. It does not contain an expected-concept sentinel or a category sentinel that was never placed in those three strings. `GEMINI_API_KEY` is unset. No network call.
- A model that returns `{ feedback: "too high", score: 101 }` rejects. A model that returns an extra key rejects. Neither result is returned.
- Extend `apps/api/src/interview-attempt.integration.test.ts`. It keeps running under `pnpm --filter @jobpilot/api test:interview-attempt`. Root `pnpm test` still excludes `*.integration.test.ts`. Do not add a package script.
- The Supertest file creates the app with an injected evaluation model for the new cases. Unset `GEMINI_API_KEY` and `ANSWER_EVALUATION_MODEL` in that file. Submitting one answer on an in-progress attempt stores that trimmed answer, `stub-feedback`, and score 80 on that question only. The other seven questions stay unanswered. The attempt status stays `in_progress`. `GET /jobs/:id` still has `latestOverallScore` and `readinessBadge` null. `GET /jobs/:id/interview-attempts/current` returns the same scored question.
- A second submit of that same question returns `409` with `{ "error": "Question already answered" }` and does not call the model. The stored feedback and score stay as they were.
- A model that returns score 101 responds `502` with `{ "error": "Answer evaluation failed" }` and leaves that question's answer, feedback, and score null.
- Submitting the other seven answers, each accepted, leaves the attempt `in_progress` through the seventh stored score and sets `completed` only on the eighth. `GET` then returns status `completed` and eight scores. `latestOverallScore` and `readinessBadge` stay null. `POST /jobs/:id/interview-attempts` then returns `409` with `{ "error": "Interview attempt already completed" }` and does not call the question model. The attempt count stays 1.
- Another user receives `404` on the answer route. A missing question id receives `404`. A whitespace-only answer, a missing `answer`, and a body with an unknown key are `400` and do not call the model. A missing or invalid token is `401`. `createApp()` with `GEMINI_API_KEY` and `ANSWER_EVALUATION_MODEL` unset returns `502` and writes nothing.
- Existing start, conflict, and question-generation cases in that file stay valid. An unanswered attempt still has null answer, feedback, and score.
- Update `apps/web/e2e/interview-attempt.spec.ts` only where it asserts that the panel has no textarea and no `Submit answer`. After start, each unanswered question has `interview-question-answer-input` and `Submit answer`. Score and readiness stay `Not available`. The rest of that case stays.
- Add `apps/web/e2e/interview-answer.spec.ts`. Do not change the Phase 9 jobs case, the Phase 14 tailored-resume case, or the Phase 15 interview-plan case. Those cases still do not start an attempt, so `job-score` and `job-readiness` stay `Not available`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions.
- Compose for that run uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, `INTERVIEW_QUESTION_MODEL=stub`, and `ANSWER_EVALUATION_MODEL=stub`, and leaves `GEMINI_API_KEY` empty. The test does not inject a model.
- The new case registers a unique `phase17-` email and logs in. It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. It generates the interview plan, starts the attempt, and sees 8 questions.
- It fills the first question's textarea with `I would add an index.` and clicks that question's `Submit answer`. The panel stays open. That question shows `I would add an index.`, `stub-feedback`, and `80`, and it has no textarea and no `Submit answer`. The other seven questions still have a textarea and `Submit answer`, and they do not show `stub-feedback`. Score and readiness stay `Not available`.
- One case starts an attempt and stubs that answer POST to `502` with `{ "error": "Answer evaluation failed" }`. The panel shows that string. The submitted question still has a textarea and does not show `stub-feedback` or `80`.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Cascade removes the job, analysis, plan, attempt, and question rows. It does not add a delete-user route.
- The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, Phase 15, and Phase 16 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, `test:jobs`, `test:tailored-resume`, `test:interview-plan`, and `test:interview-attempt` still pass. `pnpm --filter @jobpilot/portfolio-mcp test` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
