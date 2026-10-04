# Phase 15 — Interview plan

## Objective

Store one category plan for a job from its current analysis, let the signed-in user generate and read that plan, and show on the dashboard whether it exists.

## Scope

This phase adds only the interview-plan behavior described in the Phase 15 section of `specs/roadmap.md`:

- `packages/ai` contains one single-purpose LangGraph workflow that reads the stored job analysis only.
- The workflow selects relevant categories, in relevance order, from: data structures and algorithms, frontend, backend, system design, machine learning, AI/LLM systems, and behavioral questions.
- The stored plan keeps those categories and the analysis interview topics.
- A job has one current plan. Generating again replaces it.
- The workflow requires a current analysis and does not call MCP.
- Changing the job description clears the current plan when the new analysis is stored.
- The job screen can generate and show the plan. The dashboard shows whether a current plan exists.

The roadmap names the category list, the storage rule, and the two screens. It does not name the route, the table, the JSON shape, the failure status, or the panel. The contract below closes those gaps.

### Plan document

`interviewPlanCategorySchema` in `packages/shared` is a Zod enum of these strings, in this order:

1. `Data structures and algorithms`
2. `Frontend`
3. `Backend`
4. `System design`
5. `Machine learning`
6. `AI/LLM systems`
7. `Behavioral questions`

`interviewPlanModelOutputSchema` is a `.strict()` object with one field, `categories`: an array of that enum, length 1 through 7. The values must be unique. Order is the model order. The API does not sort categories.

`interviewPlanSchema` is a `.strict()` object:

| Field | Type |
| --- | --- |
| `categories` | the same unique category array as the model output |
| `interviewTopics` | string array, the Phase 10 analysis item rule: each item trimmed, length 1 through 200, at most 50 items |

`interviewTopics` are copied from the current analysis. The model does not supply them. A missing field, an unknown key, a category outside the enum, a duplicate category, an empty category array, or an array longer than 7 makes that document invalid.

`packages/ai` imports these schemas from `@jobpilot/shared`. The API and the web app use the same schemas.

### Stored row

`packages/database` gains one model, `InterviewPlan`, in one new migration named `20261004120000_interview_plan`. `Job` gains the relation. Do not edit these migrations:

- `20260930120000_enable_vector`
- `20261001050000_user_refresh_session`
- `20261001140000_candidate_profile`
- `20261001180000_resume_file`
- `20261001220000_job`
- `20261002120000_job_analysis`
- `20261003120000_experience_project_embedding`
- `20261003160000_tailored_resume`

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `jobId` | foreign key to `Job`, `@unique`, `onDelete: Cascade` |
| `document` | `Json` |
| `createdAt` | `DateTime`, `@default(now())` |
| `updatedAt` | `DateTime`, `@updatedAt` |

A job has at most one interview-plan row. `document` is the parsed plan object. Deleting a job deletes that row. Deleting a user still deletes that user's jobs, and those deletes remove the plan rows. This phase does not add an attempt table or a question table.

`interviewPlanPresent` is derived, not stored. It is `true` only when that row exists. Jobs created before this migration have no row. Do not backfill them.

### Public job JSON

Create, list, get, and update still return the Phase 13 job object. One part changes:

- `status.interviewPlanPresent` becomes `z.boolean()`. `status.latestOverallScore` and `status.readinessBadge` stay `null`. `status.analysisCurrent` and `status.tailoredResumePresent` stay as Phase 13 defined them.

The job object does not gain a plan field. Clients read the document from the routes below.

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them. A body that includes `plan`, `resume`, `analysis`, `status`, or any other unknown key is still `400`.

Creating a job does not generate a plan. Until `POST /jobs/:id/interview-plan` succeeds, `interviewPlanPresent` is `false`.

### Routes

Both routes require the access token. A missing or invalid token is `401` with `{ "error": "Unauthorized" }` and does not call the model.

| Method and path | Behavior |
| --- | --- |
| `POST /jobs/:id/interview-plan` | Generate or replace the current plan |
| `GET /jobs/:id/interview-plan` | Read the current plan |

`POST` has no fields. A JSON object with any key is `400` with `{ "error": "Invalid input" }` and does not call the model. An empty object is valid.

A missing job, or another user's job, is `404` with `{ "error": "Not found" }` on both methods. `GET` uses that same `404` when the job exists and has no plan row.

A job whose analysis is not current is `409` on `POST` with `{ "error": "Job analysis is not current" }`. Analysis is current only when an analysis row exists and `analyzedDescription` equals the job's current `jobDescription`. That response does not call the model. `GET` does not use `409`.

A successful `POST` or `GET` returns `200` and `{ "plan": <interviewPlanSchema> }`. `POST` uses `200` for the first generate and for every replace. `GET` parses the stored `document` with `interviewPlanSchema` before sending it.

### Workflow

`packages/ai` exports:

```ts
type InterviewPlanModelInput = {
  analysis: JobAnalysis;
  prompt: string;
};

type InterviewPlanModel = {
  plan(input: InterviewPlanModelInput): Promise<unknown>;
};

planInterview(analysis: JobAnalysis, model: InterviewPlanModel): Promise<InterviewPlan>
```

The LangGraph graph has one node and no checkpointer. It does not call another workflow. The model has no tools. The graph does not call MCP.

The node builds the prompt, calls `model.plan` with that prompt and the analysis, and parses the model value with `interviewPlanModelOutputSchema`. The workflow then returns `interviewPlanSchema` for `{ categories, interviewTopics }`, where `interviewTopics` is `analysis.interviewTopics` in that same order. A provider error, a schema failure, or a plan that fails `interviewPlanSchema` rejects the workflow result.

The graph starts at that node and ends. State at the start is the analysis only.

The prompt is exactly this string. Each list is the analysis array joined with `", "`. An empty array leaves the label with nothing after the colon.

```text
Select the relevant interview categories for this job analysis, in relevance order. Choose only from: Data structures and algorithms, Frontend, Backend, System design, Machine learning, AI/LLM systems, Behavioral questions. Return categories only. Use only this analysis.

Required skills: <requiredSkills>
Preferred skills: <preferredSkills>
Responsibilities: <responsibilities>
Experience requirements: <experienceRequirements>
Technologies: <technologies>
Interview topics: <interviewTopics>
Keywords: <keywords>
```

`analysis` on the model input is that same job analysis. The prompt and the model input contain nothing else: no profile records, no resume file text, no tailored resume, no user id, and no other job.

The Gemini client sends that prompt to Gemini with structured output bound to `interviewPlanModelOutputSchema`. It returns the provider value to the workflow. The workflow parses that value again with `interviewPlanModelOutputSchema`. The Gemini model id is `gemini-2.5-flash` unless `GEMINI_MODEL` is a non-empty string. `createGeminiInterviewPlanModel(apiKey: string, modelName: string)` receives both values from the API. The workflow module does not read environment variables.

### Stub model

`createStubInterviewPlanModel()` returns a model that does not call the network. Its result is always:

```json
{ "categories": ["Backend", "Behavioral questions"] }
```

The stored topics still come from the analysis passed to `planInterview`. With the Phase 10 stub analysis, those topics are `stub-topic-1` and `stub-topic-2`, in that order.

### When the API calls the workflow

Validate the body and authenticate before any model call. A `400` or `401` does not call the model. A get, a job create, a job list, or a job delete does not call the plan model. A missing job or another user's job returns `404` and does not call the model.

`POST /jobs/:id/interview-plan` loads the owner's job and its analysis. When the analysis is current, it calls `planInterview` with that stored analysis. On success, upsert the one `InterviewPlan` row for that `jobId`: create it on the first success, and on a later success update `document` on that same row. The row id stays. A second row is not inserted. On failure, write nothing. A job that already has a plan keeps that row and that document. The response is `502` with `{ "error": "Interview plan generation failed" }`.

Run the model before opening the write. Do not hold a database transaction open across the model call.

Map every workflow failure to that same `502` body. Do not return the provider message, the prompt, or the API key. Do not log the analysis, the prompt, the model output, access tokens, refresh tokens, passwords, or `JWT_SECRET`.

A successful description change already deletes the tailored resume in the same transaction that stores the new analysis. That transaction also deletes the interview plan. A failed analysis does not open that transaction, so the previous description, analysis, tailored resume, and interview plan stay as they were. A patch that omits `jobDescription`, or sends a description equal to the stored description after trim, does not delete the plan and does not call the plan model.

### Model selection

`createApp` accepts the existing options plus an optional `interviewPlanModel`. Constructing the app does not call Gemini and does not require `GEMINI_API_KEY`.

When `interviewPlanModel` is provided, plan generation uses it and does not read `GEMINI_API_KEY`, `GEMINI_MODEL`, or `INTERVIEW_PLAN_MODEL`.

When it is omitted, resolve the model at the start of `POST /jobs/:id/interview-plan`:

| `INTERVIEW_PLAN_MODEL` | `GEMINI_API_KEY` | Client |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubInterviewPlanModel()` |
| unset or `gemini` | non-empty | Gemini, using `GEMINI_MODEL` or `gemini-2.5-flash` |
| unset or `gemini` | empty | no client |
| any other value | any | no client |

No client is a generation failure: `502` and no write. `GET /health` does not resolve a model. `GET /jobs/:id/interview-plan` does not resolve a model.

Compose sets `INTERVIEW_PLAN_MODEL` to `stub` on the API when that variable is unset in the shell. A live manual run sets `INTERVIEW_PLAN_MODEL=gemini` and a real `GEMINI_API_KEY`.

Document `INTERVIEW_PLAN_MODEL` in `.env.example` as API-only. The web service still does not receive it.

### Job screen

The signed-in shell stays the Phase 9 view switcher. Do not add a routing library. There is no `/jobs` URL and no plan URL. Reload still returns to the profile view.

The job screen is a panel on the dashboard job row, beside the Phase 14 tailored-resume panel. At most one of those panels is mounted. Opening `Tailored resume` unmounts any interview-plan panel. Opening `Interview plan` unmounts any tailored-resume panel. Opening either panel on another row unmounts the previous panel. Switching to `Profile`, logging out, or deleting that job unmounts the panel.

Each row has a button named `Interview plan` with `data-testid="open-interview-plan"`. It is not a heading. Clicking it opens that row's plan panel. While that plan panel is open, that button is not shown, and `Tailored resume` is shown. While the tailored-resume panel is open, `open-tailored-resume` stays absent and `Interview plan` is shown. `Close` with `data-testid="close-interview-plan"` closes the plan panel and sends no generate request. The row's company, title, location, description, URL, status lines, `Edit job`, and `Delete job` stay visible while the plan panel is open.

The panel heading is `Interview plan`. `data-testid="interview-plan-panel"` is present only while the panel is mounted. Opening the panel starts `GET /jobs/:id/interview-plan`. The query key is `["interview-plan", userId, jobId]`. The query function reads the current in-memory access token. Disable the query when the panel is not mounted or the access token is missing. Do not run that GET from the profile view, from a closed row, from the tailored-resume panel, or while authentication is `loading` or `signed-out`.

While that GET is pending and the panel has no successful plan data yet, show `Loading plan…` on `data-testid="interview-plan-loading"`. Do not show the empty state, the plan, or `Generate plan` during that wait.

`404` with `{ "error": "Not found" }` is the empty state for a job row that is still on screen. The text is exactly `No interview plan yet.` on `data-testid="interview-plan-empty"`. Do not show that string as an alert. Any other failed GET shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show the empty state or the plan.

A `200` body must match `{ plan: interviewPlanSchema }` from `@jobpilot/shared`. A body that does not match shows `Request failed` and does not render a partial plan. Render the parsed `plan` only.

### Generate

`Generate plan` with `data-testid="generate-interview-plan"` is shown after the GET has settled as a `404` empty state or as a parsed plan. It sends `POST /jobs/:id/interview-plan` with a JSON body of `{}`. The same button is the first generate and every later replace.

Disable the button while that POST is in flight. Leave the current panel body in place during the request. Do not close the panel and do not switch views.

A successful POST returns `200` and `{ plan: interviewPlanSchema }`. Parse that body with `interviewPlanSchema`. Show the parsed plan in the open panel. Hide the empty state. Refetch `GET /jobs` so the row flag follows the stored row. A second click, after the first request settles, sends another POST and replaces the plan already on screen.

A failed POST shows the API `error` string, or `Request failed`, inside the panel and leaves the previous panel body in place. A `502` with `{ "error": "Interview plan generation failed" }` does not clear a plan already shown and does not create the empty state's plan. A `200` body that fails `interviewPlanSchema` shows `Request failed`, leaves the previous panel body, and does not change the dashboard flag from that body.

A successful job update refetches the open panel's plan query along with `GET /jobs`. A title-only save still shows the plan. A description save shows `No interview plan yet.` after the GET `404`, and the row flag is `Not available`. Delete closes the panel and refetches the job list. The Phase 14 resume refetch still runs when the tailored-resume panel is the open panel.

### Plan text

Render two sections in this order: Categories, Interview topics. Each section heading is visible.

Each category is an item with `data-testid="plan-category"`, in stored order, and its text is that category string. The Categories section has at least one item.

Each interview topic is an item with `data-testid="plan-topic"`, in stored order. When `interviewTopics` is empty, the topics section shows `None` and no `plan-topic` item. Hide `None` when there is a topic.

Do not show a raw JSON dump. Do not show `userId`, `createdAt`, `updatedAt`, the rest of the job analysis, the prompt, a password, a refresh token, or an access token.

### Dashboard flag

The row still reads `status.interviewPlanPresent` from the parsed job. The value text is exactly `Present` when that boolean is `true`, and exactly `Not available` when it is `false`. `data-testid="job-interview-plan"` stays.

`job-analysis` stays `Current` or `Not available` from Phase 10. `job-tailored-resume` stays `Present` or `Not available` from Phase 14. `job-score` and `job-readiness` stay `Not available`.

### Cache

When the session transitions to `signed-out`, remove cached interview-plan queries from the in-memory TanStack Query client, along with the existing jobs and tailored-resume query removal. When the authenticated user id changes in the same document, remove the previous user's interview-plan queries. Do not persist the query cache. Do not write the access token to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.

Plan requests send `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` with `credentials: "include"`. They do not go through the Vite `/health` proxy.

## Affected subsystems

- Interview plan
- Job analysis
- Dashboard
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`
- `packages/shared`

`apps/portfolio-mcp` stays as Phase 12 left it. This workflow does not call it. Credentialed CORS on the API already allows `GET` and `POST` with `Content-Type` and `Authorization` from `WEB_ORIGIN`. If a browser on `http://localhost:5173` cannot call the new plan routes on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change resume, job, or auth status codes or response bodies except the `interviewPlanPresent` boolean and the description-change delete described above.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 15:

- Interview question generation, attempts, answer evaluation, retakes, scores, and the readiness badge. Phases 16 through 18.
- Showing a numeric score or `Interview Ready`.
- Letting the user answer questions from the plan panel.
- Editing the plan in the browser or keeping earlier plan versions.
- A second generate endpoint, or a plan workflow that calls MCP, job analysis, or resume tailoring.
- Calling Gemini or `@jobpilot/ai` from the web app.
- Parsing or displaying uploaded resume files.
- A routing library, a `/jobs` path, and restoring the dashboard or the open panel after reload.
- A queue, a worker process, or a job runner.
- A client refresh that runs when a plan request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing auth, profile, embedding, MCP, resume grounding, or the job-analysis prompt.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phase 10. The job screen also depends on Phase 9, and it has to sit on the Phase 14 dashboard without breaking the tailored-resume panel.

Phase 10 provides the stored analysis, `analysisCurrent`, and the description-change transaction. Phase 13 provides the tailored-resume delete inside that transaction. Phase 14 provides the dashboard row, the tailored-resume panel, and `status.tailoredResumePresent`.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 15, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Workflow and API

- Keep business logic outside the route handlers.
- Validate the POST body with Zod from `@jobpilot/shared` or with the same empty-object rule the tailored-resume route already uses. Reject unknown keys.
- `packages/ai` does not import `@modelcontextprotocol/sdk`. `planInterview` does not call `analyzeJobDescription` or `tailorResume`.
- The only database write for a plan is the upsert on a successful generate, the delete inside the successful description-change transaction, and the job-delete cascade.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Do not add a dependency.

### Web

- Keep the profile view, job forms, analysis label, and tailored-resume panel as Phases 9, 10, and 14 left them, except the panel-open rule in the scope above.
- Use the existing Button and TanStack Query patterns. Do not add a dependency.
- Parse the plan response with `interviewPlanSchema` from `@jobpilot/shared`. Do not copy that schema into the web app.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `INTERVIEW_PLAN_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini or MCP from the browser.

### Tests

- Add `packages/ai/src/interview-plan.test.ts`. It runs inside `pnpm --filter @jobpilot/ai test` and root `pnpm test`. The stub result is `Backend` then `Behavioral questions`. A custom model that returns `Behavioral questions` then `Backend` keeps that order, and the result topics equal the analysis topics. The recorded prompt contains each analysis label and value, and it does not contain a profile sentinel that was never placed in the analysis. The model input has the analysis and the prompt only. An unknown category, a duplicate category, an empty category array, and a model object that includes `interviewTopics` or another extra key all reject. `GEMINI_API_KEY` is unset. No network call.
- Add `apps/api/src/interview-plan.integration.test.ts` and `apps/api/vitest.interview-plan.config.ts`, following the tailored-resume config. Add `test:interview-plan` to `apps/api/package.json`. Root `pnpm test` still excludes `*.integration.test.ts`.
- The Supertest file creates the app with an injected plan model. Unset `GEMINI_API_KEY` and `INTERVIEW_PLAN_MODEL` in that file. Generate on a job with a current analysis stores one plan, `interviewPlanPresent` becomes `true`, and `GET` returns the same document. A second generate, with a model that returns a different allowed category list, updates that same row id and leaves `InterviewPlan` count at 1. A model that returns a category outside the enum responds `502` with `{ "error": "Interview plan generation failed" }` and leaves the previous row unchanged. Another user receives `404` on generate and read. A job with no analysis, and a job whose `analyzedDescription` differs from `jobDescription`, return `409` and do not call the model. A description change clears the plan. A failed analysis keeps it. A title-only patch keeps it. Job delete removes it. A keyed POST body is `400`. A missing or invalid token is `401`. `createApp()` with `GEMINI_API_KEY` and `INTERVIEW_PLAN_MODEL` unset returns `502` and writes nothing.
- That description-change case still clears the tailored resume when one exists, and a title-only patch still keeps it. Existing `pnpm --filter @jobpilot/api test:jobs` and `test:tailored-resume` expectations stay valid because those cases do not generate a plan, so `interviewPlanPresent` remains `false`.
- Add `apps/web/e2e/interview-plan.spec.ts`. Do not change the Phase 9 jobs case or the Phase 14 tailored-resume case. Those cases still do not generate a plan, so `job-interview-plan` stays `Not available`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions.
- Compose for that run uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, `RESUME_MODEL=stub`, and `INTERVIEW_PLAN_MODEL=stub`, and leaves `GEMINI_API_KEY` empty. The test does not inject a model.
- The new case registers a unique `phase15-` email and logs in. It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. The row shows analysis `Current`, tailored resume `Not available`, interview plan `Not available`, and score and readiness `Not available`.
- It opens `Interview plan`, sees `No interview plan yet.`, and does not see a `plan-category` item. `Generate plan` sends `POST` with a JSON object that has no keys. The panel stays open and shows `plan-category` text `Backend` and then `Behavioral questions`, plus `plan-topic` text `stub-topic-1` and then `stub-topic-2`. The row flag becomes `Present`.
- A second `Generate plan` on that open panel replaces in place. The panel stays open, those same category and topic strings are shown, and the flag stays `Present`.
- It edits the description to `Build reliable APIs.` and saves. Analysis stays `Current`. The flag becomes `Not available`. The open panel shows `No interview plan yet.` and no longer shows `Backend`. `Generate plan` again shows `Backend`, `Behavioral questions`, `stub-topic-1`, and `stub-topic-2`, and the flag becomes `Present`.
- One case opens the panel and stubs `POST /jobs/:id/interview-plan` to `502` with `{ "error": "Interview plan generation failed" }`. The panel shows that string and `No interview plan yet.`.
- One case generates a plan that shows `Backend`, then stubs the next `POST` to that same `502`. The panel still shows `Backend`, and the flag stays `Present`.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Cascade removes the job, analysis, and plan rows. It does not add a delete-user route.
- The Phase 4, Phase 6, Phase 7, Phase 9, and Phase 14 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, `test:jobs`, and `test:tailored-resume` still pass. `pnpm --filter @jobpilot/portfolio-mcp test` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
