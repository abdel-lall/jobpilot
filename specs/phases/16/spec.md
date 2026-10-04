# Phase 16 — Interview question generation

## Objective

Start one 8-question attempt from the current interview plan without repeating stored questions, and list those questions for the signed-in user. The user cannot answer them yet.

## Scope

This phase adds only the interview-question behavior described in the Phase 16 section of `specs/roadmap.md`:

- `packages/ai` contains one single-purpose LangGraph workflow that reads the stored plan and the job's stored question texts.
- An attempt is created only after 8 unique questions exist.
- TypeScript decides how many questions each category receives before any model call. Counts are as even as possible across the plan's categories. Extra questions go to categories earlier in the relevance order. One category receives all 8.
- Gemini only generates the requested questions for a category TypeScript already assigned. The model does not choose categories or counts. The stored category is the TypeScript assignment.
- Each stored question has text, category, expected concepts, and an evaluation rubric. Answer, feedback, and score are empty.
- Normalized question text is trimmed, internal whitespace is collapsed, and comparison is case-insensitive. A match against any stored question for that user and job is discarded.
- A generation round is one pass that asks the model for the questions still missing. The attempt allows at most 3 generation rounds.
- If 8 unique questions are not available after 3 rounds, the request fails and no attempt is stored.
- A job can have only one in-progress attempt.
- The attempt screen lists the 8 questions. The user cannot answer them yet.

The roadmap names the question count, the distribution rule, the retry rule, and the attempt screen. It does not name the route, the tables, the JSON shape, the failure status, or how the screen sits on the dashboard. The contract below closes those gaps.

### Question document

`normalizeQuestionText` in `packages/shared` is:

```ts
export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
```

Comparison uses that string. `Hello World` and `  hello   world ` match. `Hello World` and `Hello World!` do not.

`interviewQuestionModelItemSchema` is a `.strict()` object:

| Field | Type |
| --- | --- |
| `text` | string, trimmed, length 1 through 2000 |
| `category` | string |
| `expectedConcepts` | array of trimmed strings, length 1 through 200, 1 through 10 items |
| `rubric` | string, trimmed, length 1 through 2000 |

`category` on a model item is not the plan enum. The workflow ignores it.

`interviewQuestionModelOutputSchema` is a `.strict()` object with one field, `questions`: an array of unknown values, maximum length 8. Parse the envelope first. Then parse each element with `interviewQuestionModelItemSchema`. An element that fails is discarded. An envelope that fails yields no questions from that call.

`interviewQuestionSchema` is the stored question returned by the API. It is a `.strict()` object:

| Field | Type |
| --- | --- |
| `id` | string |
| `position` | integer 1 through 8 |
| `text` | the schema-trimmed question text, internal whitespace unchanged |
| `category` | `interviewPlanCategorySchema` |
| `expectedConcepts` | the same concept array as a valid model item |
| `rubric` | the trimmed rubric string |
| `answer` | `null` |
| `feedback` | `null` |
| `score` | `null` |

`interviewAttemptSchema` is a `.strict()` object:

| Field | Type |
| --- | --- |
| `id` | string |
| `jobId` | string |
| `status` | the literal `in_progress` |
| `questions` | an array of `interviewQuestionSchema`, length 8 |

Questions are ordered by `position`. The positions are exactly 1 through 8. `normalizedText` is not part of either public schema.

`packages/ai` imports these schemas and `normalizeQuestionText` from `@jobpilot/shared`. The API and the web app use the same schemas.

### Counts

`packages/ai` exports a pure function:

```ts
interviewQuestionCounts(categories: readonly InterviewPlanCategory[]): number[]
```

`categories` has length 1 through 7, which is the plan rule. For length `n`, question `8`, base `Math.floor(8 / n)`, and extra `8 % n`, index `i` receives `base + (i < extra ? 1 : 0)`. The result length equals `n` and the sum is 8. Earlier categories receive the extra questions. A call with any other length throws before a model call.

Examples that the tests lock in:

| Categories, in order | Counts |
| --- | --- |
| A, B, C | 3, 3, 2 |
| one category | 8 |
| two categories | 4, 4 |

The workflow calls this function and does not call the model until it has returned.

### Stored rows

`packages/database` gains two models, `InterviewAttempt` and `InterviewQuestion`, in one new migration named `20261004180000_interview_attempt`. `Job` gains both relations. Do not edit these migrations:

- `20260930120000_enable_vector`
- `20261001050000_user_refresh_session`
- `20261001140000_candidate_profile`
- `20261001180000_resume_file`
- `20261001220000_job`
- `20261002120000_job_analysis`
- `20261003120000_experience_project_embedding`
- `20261003160000_tailored_resume`
- `20261004120000_interview_plan`

`InterviewAttempt`:

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `jobId` | foreign key to `Job`, `onDelete: Cascade` |
| `status` | Prisma enum `InterviewAttemptStatus` with the single value `in_progress` |
| `createdAt` | `DateTime`, `@default(now())` |
| `updatedAt` | `DateTime`, `@updatedAt` |

The migration also creates this partial unique index:

```sql
CREATE UNIQUE INDEX "InterviewAttempt_one_in_progress_per_job"
ON "InterviewAttempt" ("jobId")
WHERE "status" = 'in_progress';
```

`InterviewQuestion`:

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `attemptId` | foreign key to `InterviewAttempt`, `onDelete: Cascade` |
| `jobId` | foreign key to `Job`, `onDelete: Cascade` |
| `position` | `Int` |
| `text` | `String` |
| `normalizedText` | `String` |
| `category` | `String` |
| `expectedConcepts` | `Json` |
| `rubric` | `String` |
| `answer` | `String?` |
| `feedback` | `String?` |
| `score` | `Int?` |
| `createdAt` | `DateTime`, `@default(now())` |

`@@unique([attemptId, position])`. `@@unique([jobId, normalizedText])`. `question.jobId` is the attempt's `jobId`.

Deleting a job deletes its attempts and questions. Deleting a user still deletes that user's jobs, and those deletes remove the attempt and question rows. This phase writes `answer`, `feedback`, and `score` only as `null`. No route updates them.

A description change still deletes the tailored resume and the interview plan in the existing transaction. That transaction does not delete attempts or questions. A failed analysis does not open that transaction. A title-only patch does not delete the attempt. Replacing the interview plan does not delete the attempt or its questions.

Jobs created before this migration have no attempt rows. Do not backfill them.

### Public job JSON

Create, list, get, and update still return the Phase 15 job object. `status.latestOverallScore` and `status.readinessBadge` stay `null`. `status.analysisCurrent`, `status.tailoredResumePresent`, and `status.interviewPlanPresent` stay as Phase 15 defined them. The job object does not gain an attempt field.

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them. A body that includes `attempt`, `questions`, `plan`, `resume`, `analysis`, `status`, or any other unknown key is still `400`.

Creating a job does not generate questions.

### Routes

Both routes require the access token. A missing or invalid token is `401` with `{ "error": "Unauthorized" }` and does not call the model.

| Method and path | Behavior |
| --- | --- |
| `POST /jobs/:id/interview-attempts` | Start the in-progress attempt |
| `GET /jobs/:id/interview-attempts/current` | Read the in-progress attempt |

`POST` has no fields. A JSON object with any key is `400` with `{ "error": "Invalid input" }` and does not call the model. An empty object is valid.

A missing job, or another user's job, is `404` with `{ "error": "Not found" }` on both methods. `GET` uses that same `404` when the job exists and has no in-progress attempt. `GET` does not use `409` and does not call the model.

`POST` checks, in this order, after the job is found. Each failure skips the model:

| Condition | Status | Body |
| --- | --- | --- |
| No analysis row, or `analyzedDescription` differs from the current `jobDescription` | `409` | `{ "error": "Job analysis is not current" }` |
| No interview-plan row, or its `document` fails `interviewPlanSchema` | `409` | `{ "error": "Interview plan is not current" }` |
| An `in_progress` attempt already exists for that job | `409` | `{ "error": "Interview attempt already in progress" }` |

A successful `POST` or `GET` returns `200` and `{ "attempt": <interviewAttemptSchema> }`. `GET` parses the stored rows with `interviewAttemptSchema` before sending them. `GET` still returns the attempt after a later description change clears the plan.

### Workflow

`packages/ai` exports:

```ts
type InterviewQuestionModelInput = {
  category: InterviewPlanCategory;
  count: number;
  plan: InterviewPlan;
  avoidedQuestionTexts: string[];
  prompt: string;
};

type InterviewQuestionModel = {
  generate(input: InterviewQuestionModelInput): Promise<unknown>;
};

generateInterviewQuestions(
  plan: InterviewPlan,
  storedQuestionTexts: string[],
  model: InterviewQuestionModel,
): Promise<GeneratedInterviewQuestion[]>
```

`GeneratedInterviewQuestion` has `text`, `category`, `expectedConcepts`, and `rubric`. `category` is the TypeScript assignment. The function returns exactly 8 questions or rejects.

The LangGraph graph has one node and no checkpointer. It does not call another workflow. The model has no tools. The graph does not call MCP.

State at the start is the plan and the stored question texts. The node calls `interviewQuestionCounts(plan.categories)` before the first `model.generate`. It then runs at most 3 rounds.

A round looks at the questions still missing. For each plan category whose accepted count is below its assigned count, in plan order, the node calls `model.generate` once. `count` on that call is how many questions that category still needs. Categories that already have their assigned count are not called in that round.

The prompt for a call is exactly this string. Plan categories are joined with `", "`. Interview topics use the same join. An empty topic list leaves nothing after `Interview topics: `. When `avoidedQuestionTexts` is empty, the last line is `Questions to avoid: (none)`. Otherwise each avoided text is on its own line, prefixed with `"- "`, in the array order.

```text
Write interview questions for one category. Return only questions for the requested category and count. Use only this plan and the questions to avoid. Do not use a candidate profile.

Category: <category>
Count: <count>
Plan categories: <categories>
Interview topics: <interviewTopics>
Questions to avoid: <(none) or the bullet list>
```

`plan` on the model input is the stored interview plan. `avoidedQuestionTexts` starts as the stored question texts, in the order the API loaded them: attempts by `createdAt` ascending, and questions in each attempt by `position` ascending. Each accepted question appends its stored `text` to that list before the next model call. The prompt and the model input contain nothing else: no profile records, no resume file text, no tailored resume, no user id, and no job description beyond the plan's categories and topics.

From each response, walk `questions` in order. Keep an item only when it passes `interviewQuestionModelItemSchema`, its normalized text is not already in the avoided set, and the category still needs a question. Store the TypeScript category, not the model's `category`. Keep at most the requested count. Extra valid items are ignored. A thrown error from `model.generate` rejects the workflow immediately. An envelope that fails `interviewQuestionModelOutputSchema` contributes zero questions for that call and does not throw.

When the accepted list reaches 8, the node stops. It does not start another round. The returned order is plan-category order. Inside a category, earlier accepted questions come first. Positions 1 through 8 follow that order.

If the accepted list is still short after round 3, the workflow rejects. A round that needs questions always calls the model for each still-short category, even when every returned text is a duplicate.

### Stub model

`createStubInterviewQuestionModel()` returns a model that does not call the network. For a request with category `C` and count `n`, it returns `n` items. Item `i`, starting at 1, is:

```json
{
  "text": "Stub C question i",
  "category": "Frontend",
  "expectedConcepts": ["stub-concept"],
  "rubric": "stub-rubric"
}
```

The stored category is `C`, not `Frontend`. With the Phase 15 stub plan, the categories are `Backend` then `Behavioral questions`, so the counts are 4 and 4. The stored texts are `Stub Backend question 1` through `Stub Backend question 4`, then `Stub Behavioral questions question 1` through `Stub Behavioral questions question 4`.

### When the API calls the workflow

Validate the body and authenticate before any model call. A `400` or `401` does not call the model. A get, a job create, a job list, a job update, or a job delete does not call the question model. A missing job or another user's job returns `404` and does not call the model.

`POST /jobs/:id/interview-attempts` loads the owner's job, its analysis, its plan, its in-progress attempt, and its stored question texts. When the checks above pass, it calls `generateInterviewQuestions` with the parsed plan and those texts.

On success, open one transaction. Inside it, if an `in_progress` attempt now exists, roll back and return `409` with `{ "error": "Interview attempt already in progress" }`. If any generated normalized text now matches a stored question for that job, roll back and return `502` with `{ "error": "Interview question generation failed" }`. Otherwise insert one `InterviewAttempt` and its 8 `InterviewQuestion` rows, then commit. The response is the parsed attempt.

On workflow failure, write nothing. The response is `502` with `{ "error": "Interview question generation failed" }`. A job that already has an in-progress attempt keeps that attempt. A job with no attempt still has no attempt and no questions.

Run the model before opening the write. Do not hold a database transaction open across the model call.

Map every workflow failure, and a unique-index failure on `normalizedText`, to that same `502` body. Map a partial-unique failure on the in-progress attempt to the `409` body above. Do not return the provider message, the prompt, or the API key. Do not log question text, the prompt, the model output, access tokens, refresh tokens, passwords, or `JWT_SECRET`.

### Model selection

`createApp` accepts the existing options plus an optional `interviewQuestionModel`. Constructing the app does not call Gemini and does not require `GEMINI_API_KEY`.

When `interviewQuestionModel` is provided, question generation uses it and does not read `GEMINI_API_KEY`, `GEMINI_MODEL`, or `INTERVIEW_QUESTION_MODEL`.

When it is omitted, resolve the model at the start of `POST /jobs/:id/interview-attempts`:

| `INTERVIEW_QUESTION_MODEL` | `GEMINI_API_KEY` | Client |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubInterviewQuestionModel()` |
| unset or `gemini` | non-empty | Gemini, using `GEMINI_MODEL` or `gemini-2.5-flash` |
| unset or `gemini` | empty | no client |
| any other value | any | no client |

No client is a generation failure: `502` and no write. `GET /health` does not resolve a model. `GET /jobs/:id/interview-attempts/current` does not resolve a model.

Compose sets `INTERVIEW_QUESTION_MODEL` to `stub` on the API when that variable is unset in the shell. A live manual run sets `INTERVIEW_QUESTION_MODEL=gemini` and a real `GEMINI_API_KEY`.

Document `INTERVIEW_QUESTION_MODEL` in `.env.example` as API-only. The web service still does not receive it.

The Gemini client sends that call's prompt to Gemini with structured output bound to an object schema of valid question items. It returns the provider value to the workflow. The workflow applies the envelope and per-item rules above. `createGeminiInterviewQuestionModel(apiKey: string, modelName: string)` receives both values from the API. The workflow module does not read environment variables.

### Attempt screen

The signed-in shell stays the Phase 9 view switcher. Do not add a routing library. There is no `/jobs` URL and no attempt URL. Reload still returns to the profile view.

The attempt screen is a panel on the dashboard job row, beside the Phase 14 tailored-resume panel and the Phase 15 interview-plan panel. At most one of those three panels is mounted. Opening `Interview attempt` unmounts any resume or plan panel. Opening `Tailored resume` or `Interview plan` unmounts any attempt panel. Opening a panel on another row unmounts the previous panel. Switching to `Profile`, logging out, or deleting that job unmounts the panel.

Each row has a button named `Interview attempt` with `data-testid="open-interview-attempt"`. It is not a heading. Clicking it opens that row's attempt panel. While that panel is open, that button is not shown. `Tailored resume` and `Interview plan` stay available under the Phase 14 and Phase 15 rules. While the plan panel is open, `open-interview-plan` stays absent and `Interview attempt` is shown. While the resume panel is open, `open-tailored-resume` stays absent and `Interview attempt` is shown. `Close` with `data-testid="close-interview-attempt"` closes the attempt panel and sends no start request. The row's company, title, location, description, URL, status lines, `Edit job`, and `Delete job` stay visible while the attempt panel is open.

The panel heading is `Interview attempt`. `data-testid="interview-attempt-panel"` is present only while the panel is mounted. Opening the panel starts `GET /jobs/:id/interview-attempts/current`. The query key is `["interview-attempt", userId, jobId]`. The query function reads the current in-memory access token. Disable the query when the panel is not mounted or the access token is missing. Do not run that GET from the profile view, from a closed row, from the resume or plan panel, or while authentication is `loading` or `signed-out`.

While that GET is pending and the panel has no successful attempt data yet, show `Loading attempt…` on `data-testid="interview-attempt-loading"`. Do not show the empty state, the questions, or `Start attempt` during that wait.

`404` with `{ "error": "Not found" }` is the empty state for a job row that is still on screen. The text is exactly `No interview attempt yet.` on `data-testid="interview-attempt-empty"`. Do not show that string as an alert. Any other failed GET shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show the empty state or the questions.

A `200` body must match `{ attempt: interviewAttemptSchema }` from `@jobpilot/shared`. A body that does not match shows `Request failed` and does not render a partial attempt. Render the parsed `attempt` only.

### Start

`Start attempt` with `data-testid="start-interview-attempt"` is shown after the GET has settled as a `404` empty state. It is not shown while an attempt is on screen. It sends `POST /jobs/:id/interview-attempts` with a JSON body of `{}`.

Disable the button while that POST is in flight. Leave the current panel body in place during the request. Do not close the panel and do not switch views.

A successful POST returns `200` and `{ attempt: interviewAttemptSchema }`. Parse that body with `interviewAttemptSchema`. Show the parsed questions in the open panel. Hide the empty state and hide `Start attempt`.

A failed POST shows the API `error` string, or `Request failed`, inside the panel and leaves the previous panel body in place. A `502` with `{ "error": "Interview question generation failed" }` does not show any question. A `200` body that fails `interviewAttemptSchema` shows `Request failed` and leaves the previous panel body.

The panel lists the 8 questions in position order. Each question is an item with `data-testid="interview-question"`. Its text is on `data-testid="interview-question-text"`. Its category is on `data-testid="interview-question-category"`. Each expected concept is on `data-testid="interview-question-concept"`, in stored order. The rubric is on `data-testid="interview-question-rubric"`.

The panel has no `textarea`, no control named `Submit answer`, and no answer, feedback, or score. Do not show a raw JSON dump. Do not show `normalizedText`, `userId`, `createdAt`, `updatedAt`, the prompt, a password, a refresh token, or an access token.

### Dashboard flag

`job-score` stays `Not available`. `job-readiness` stays `Not available`. An in-progress attempt does not change either line. `job-analysis`, `job-tailored-resume`, and `job-interview-plan` stay as Phases 10, 14, and 15 defined them.

A successful job update refetches the open panel's attempt query along with `GET /jobs`. A description save keeps the questions on screen when the attempt panel is the open panel. The plan flag still becomes `Not available` under the Phase 15 rule. Delete closes the panel and refetches the job list.

### Cache

When the session transitions to `signed-out`, remove cached interview-attempt queries from the in-memory TanStack Query client, along with the existing jobs, tailored-resume, and interview-plan query removal. When the authenticated user id changes in the same document, remove the previous user's interview-attempt queries. Do not persist the query cache. Do not write the access token to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.

Attempt requests send `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` with `credentials: "include"`. They do not go through the Vite `/health` proxy.

## Affected subsystems

- Interview assessment
- Interview plan
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`
- `packages/shared`

`apps/portfolio-mcp` stays as Phase 12 left it. This workflow does not call it. Credentialed CORS on the API already allows `GET` and `POST` with `Content-Type` and `Authorization` from `WEB_ORIGIN`. If a browser on `http://localhost:5173` cannot call the new attempt routes on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change resume, job, auth, plan, or analysis status codes or response bodies except the description-change rule that keeps attempts.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 16:

- Submitting an answer, storing feedback, storing a score, and marking an attempt complete. Phase 17.
- Retakes, the pass rule, the overall score, category scores, the `Interview Ready` badge, and showing a latest score on the dashboard. Phase 18.
- A second in-progress attempt, or a start that succeeds while an `in_progress` attempt exists.
- A completed attempt status. This phase never writes one.
- Semantic deduplication of question text.
- Letting the user edit a question, answer from the panel, or replace questions on an existing attempt.
- A workflow that calls MCP, job analysis, interview planning, resume tailoring, or answer evaluation.
- Calling Gemini or `@jobpilot/ai` from the web app.
- Parsing or displaying uploaded resume files.
- A routing library, a `/jobs` path, and restoring the dashboard or the open panel after reload.
- A queue, a worker process, or a job runner.
- A client refresh that runs when an attempt request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing auth, profile, embedding, MCP, resume grounding, the job-analysis prompt, or the interview-plan prompt.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phase 15.

Phase 15 provides the stored plan, `interviewPlanPresent`, and the description-change transaction that clears that plan. Phase 9 provides the dashboard row. Phase 10 provides `analysisCurrent`.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 16, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Workflow and API

- Keep business logic outside the route handlers.
- Validate the POST body with Zod from `@jobpilot/shared` or with the same empty-object rule the interview-plan route already uses. Reject unknown keys.
- `packages/ai` does not import `@modelcontextprotocol/sdk`. `generateInterviewQuestions` does not call `analyzeJobDescription`, `tailorResume`, `planInterview`, or an answer-evaluation function.
- The only database writes for an attempt are the insert of one attempt plus its 8 questions on success, and the job-delete cascade. Description change, plan replace, and title-only update do not delete them.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Do not add a dependency.

### Web

- Keep the profile view, job forms, analysis label, tailored-resume panel, and interview-plan panel as Phases 9, 10, 14, and 15 left them, except the panel-open rule in the scope above.
- Use the existing Button and TanStack Query patterns. Do not add a dependency.
- Parse the attempt response with `interviewAttemptSchema` from `@jobpilot/shared`. Do not copy that schema into the web app.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `INTERVIEW_QUESTION_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini or MCP from the browser.

### Tests

- Add `packages/ai/src/interview-questions.test.ts`. It runs inside `pnpm --filter @jobpilot/ai test` and root `pnpm test`.
- `interviewQuestionCounts` for three categories returns `[3, 3, 2]`, for one category returns `[8]`, and for two categories returns `[4, 4]`. Those assertions construct no model and make no network call.
- A workflow test with categories A, B, and C records the model calls. The first call is category A with count 3, and it happens only after the counts are fixed. The model labels every item `Frontend`. The stored categories are A, B, and C. The calls are `(A, 3)`, `(B, 3)`, and `(C, 2)`, and there is no later call.
- A one-category workflow whose model returns 8 unique questions calls the model once with that category and count 8.
- A one-category workflow whose stored texts already include `Hello World`, and whose model returns eight copies of `  hello   world ` on every call, calls the model exactly 3 times with count 8 and then rejects. None of those texts are returned.
- A one-category workflow whose first response contains one normalized duplicate of a stored question and 7 unique questions calls the second round with count 1 only. When that item is unique, the result has 8 questions and the duplicate is absent. A third round does not start.
- The recorded prompt contains the category, the count, the plan categories, the plan topics, and an avoided question. It does not contain a profile sentinel that was never placed in the plan. The model input has `category`, `count`, `plan`, `avoidedQuestionTexts`, and `prompt` only. `GEMINI_API_KEY` is unset. No network call.
- Add `apps/api/src/interview-attempt.integration.test.ts` and `apps/api/vitest.interview-attempt.config.ts`, following the interview-plan config. Add `test:interview-attempt` to `apps/api/package.json`. Root `pnpm test` still excludes `*.integration.test.ts`.
- The Supertest file creates the app with an injected question model. Unset `GEMINI_API_KEY` and `INTERVIEW_QUESTION_MODEL` in that file. Start on a job with a current analysis and a plan of three categories stores one attempt and exactly 8 questions, with counts 3, 3, and 2, and stores the TypeScript category when the model sends a different category. `GET` returns that attempt. `latestOverallScore` and `readinessBadge` stay `null`. A second start returns `409` with `{ "error": "Interview attempt already in progress" }` and leaves the attempt count at 1.
- A model that returns only a text already stored for that job uses 3 rounds, responds `502` with `{ "error": "Interview question generation failed" }`, and leaves `InterviewAttempt` and `InterviewQuestion` counts unchanged.
- Another user receives `404` on start and read. A job with no analysis, and a job whose `analyzedDescription` differs from `jobDescription`, return `409` with `{ "error": "Job analysis is not current" }` and do not call the model. A job with a current analysis and no plan returns `409` with `{ "error": "Interview plan is not current" }` and does not call the model.
- A description change clears the plan and keeps the attempt. `GET` still returns the 8 questions. A title-only patch keeps the attempt. Replacing the plan keeps the attempt. Job delete removes the attempt and its questions. A keyed POST body is `400`. A missing or invalid token is `401`. `createApp()` with `GEMINI_API_KEY` and `INTERVIEW_QUESTION_MODEL` unset returns `502` and writes nothing.
- Existing `pnpm --filter @jobpilot/api test:jobs`, `test:tailored-resume`, and `test:interview-plan` expectations stay valid. Those cases do not start an attempt, so `latestOverallScore` and `readinessBadge` remain `null`.
- Add `apps/web/e2e/interview-attempt.spec.ts`. Do not change the Phase 9 jobs case, the Phase 14 tailored-resume case, or the Phase 15 interview-plan case. Those cases still do not start an attempt, so `job-score` and `job-readiness` stay `Not available`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions.
- Compose for that run uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, `INTERVIEW_PLAN_MODEL=stub`, and `INTERVIEW_QUESTION_MODEL=stub`, and leaves `GEMINI_API_KEY` empty. The test does not inject a model.
- The new case registers a unique `phase16-` email and logs in. It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. The row shows analysis `Current`, tailored resume `Not available`, interview plan `Not available`, and score and readiness `Not available`.
- It opens `Interview plan`, generates, and sees category `Backend`. It then opens `Interview attempt`, sees `No interview attempt yet.`, and does not see an `interview-question` item. `Start attempt` sends `POST` with a JSON object that has no keys. The panel stays open and shows 8 `interview-question` items. The first four have category `Backend` and texts `Stub Backend question 1` through `Stub Backend question 4`. The next four have category `Behavioral questions` and texts `Stub Behavioral questions question 1` through `Stub Behavioral questions question 4`. Each question shows `stub-concept` and `stub-rubric`. The panel has no `textarea` and no button named `Submit answer`. `Start attempt` is gone. Score and readiness stay `Not available`. The plan flag stays `Present`.
- One case opens the panel and stubs `POST /jobs/:id/interview-attempts` to `502` with `{ "error": "Interview question generation failed" }`. The panel shows that string and `No interview attempt yet.`, and it shows no `interview-question`.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Cascade removes the job, analysis, plan, attempt, and question rows. It does not add a delete-user route.
- The Phase 4, Phase 6, Phase 7, Phase 9, Phase 14, and Phase 15 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, `test:jobs`, `test:tailored-resume`, and `test:interview-plan` still pass. `pnpm --filter @jobpilot/portfolio-mcp test` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
