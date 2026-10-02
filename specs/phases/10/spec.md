# Phase 10 — Job analysis

## Objective

Analyze a job description in the same request that creates the job or changes that description, and show the dashboard analysis as current when the stored analysis matches the description.

## Scope

This phase adds only the job-analysis behavior described in the Phase 10 section of `specs/roadmap.md`:

- `packages/ai` contains one single-purpose LangGraph workflow for job analysis.
- The workflow reads the job description only. It returns required skills, preferred skills, responsibilities, experience requirements, technologies, interview topics in relevance order, and keywords.
- `POST /jobs` and `PATCH /jobs/:id` stay the only create and update endpoints. This phase changes what those existing operations do. It does not add a second create or update route.
- Creating a job runs analysis in that request. The job and its analysis are stored together. If analysis fails, the job is not stored.
- Changing the description replaces the analysis in that same request. If analysis fails, the previous description and analysis stay as they were.
- Changing other job fields leaves the analysis current and does not call the model.
- The dashboard reports analysis as current only when a stored analysis matches the current description.
- The API waits for the workflow. There is no queue or worker.

The roadmap names the extracted fields and the request rules. It does not name the table, the JSON shape, the failure status, the model id, or the words shown for a current analysis. The contract below closes those gaps.

### Analysis document

The shared schema `jobAnalysisSchema` in `packages/shared` is a `.strict()` object:

| Field | Type |
| --- | --- |
| `requiredSkills` | string array |
| `preferredSkills` | string array |
| `responsibilities` | string array |
| `experienceRequirements` | string array |
| `technologies` | string array |
| `interviewTopics` | string array, relevance order |
| `keywords` | string array |

Each item is trimmed, then length 1 through 200. Each array allows 0 through 50 items. Empty arrays are valid. Item order is the model order. The API does not sort, dedupe, or rewrite items. An item that is empty after trim, an item longer than 200 characters, an array longer than 50 items, a missing field, or an unknown key makes the whole document invalid.

`packages/ai` imports this schema from `@jobpilot/shared`. The web app and the API use the same schema.

### Stored row

`packages/database` gains one model, `JobAnalysis`, in one new migration. `Job` gains the relation. Do not edit the Phase 2, Phase 3, Phase 5, Phase 7, or Phase 8 migrations. Do not add columns to `Job` for the extracted fields or for a current flag.

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `jobId` | foreign key to `Job`, `@unique`, `onDelete: Cascade` |
| `analyzedDescription` | `String` |
| `requiredSkills` | `Json` |
| `preferredSkills` | `Json` |
| `responsibilities` | `Json` |
| `experienceRequirements` | `Json` |
| `technologies` | `Json` |
| `interviewTopics` | `Json` |
| `keywords` | `Json` |
| `createdAt` | `DateTime`, `@default(now())` |
| `updatedAt` | `DateTime`, `@updatedAt` |

`analyzedDescription` is the exact `jobDescription` string that was analyzed, after the existing create and update trim. It is not part of the public JSON. A job has at most one analysis row.

`analysisCurrent` is derived, not stored. It is `true` only when an analysis row exists and `analyzedDescription` equals the job's current `jobDescription`. Any other case is `false`.

Deleting a job deletes its analysis row through `onDelete: Cascade`. Deleting a user still deletes that user's jobs, and those deletes remove the analysis rows. This phase does not add plan, resume, or attempt tables.

Jobs already stored before this migration have no analysis row. Do not backfill them and do not call the model for them during migration. They stay `analysisCurrent: false` with `analysis: null` until a later description change succeeds.

### Public job JSON

Create, list, get, and update still return the Phase 8 job object. Two parts change:

- `status.analysisCurrent` is a boolean. The other four status fields stay the Phase 8 literals: `tailoredResumePresent` and `interviewPlanPresent` are `false`, and `latestOverallScore` and `readinessBadge` are `null`.
- Each job includes `analysis`. It is the seven-field document, or `null` when the job has no analysis row.

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "companyName": "Example Co",
  "jobTitle": "Engineer",
  "jobDescription": "Build APIs.",
  "jobLocation": "Remote",
  "jobUrl": "https://example.com/jobs/engineer",
  "status": {
    "analysisCurrent": true,
    "tailoredResumePresent": false,
    "interviewPlanPresent": false,
    "latestOverallScore": null,
    "readinessBadge": null
  },
  "analysis": {
    "requiredSkills": ["stub-required"],
    "preferredSkills": ["stub-preferred"],
    "responsibilities": ["stub-responsibility"],
    "experienceRequirements": ["stub-experience"],
    "technologies": ["stub-technology"],
    "interviewTopics": ["stub-topic-1", "stub-topic-2"],
    "keywords": ["Build APIs."]
  },
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them. A body that includes `analysis`, `status`, `id`, `userId`, `createdAt`, `updatedAt`, or any other unknown key is still `400`.

List order stays `createdAt` ascending, then `id` ascending. Ownership and the `401`, `400`, and `404` bodies stay as Phase 8 defined them.

### Workflow

`packages/ai` exports one workflow function:

```ts
analyzeJobDescription(jobDescription: string, model: JobAnalysisModel): Promise<JobAnalysis>
```

`JobAnalysisModel` is:

```ts
type JobAnalysisModelInput = {
  jobDescription: string;
  prompt: string;
};

type JobAnalysisModel = {
  analyze(input: JobAnalysisModelInput): Promise<unknown>;
};
```

The LangGraph graph has one node. The node builds the prompt, calls `model.analyze`, and parses the result with `jobAnalysisSchema`. The graph starts at that node and ends. It has no tools, no checkpointer, and no second node. It does not call another workflow.

The prompt is exactly this string, with the description appended as given:

```text
Analyze this job description. Return required skills, preferred skills, responsibilities, experience requirements, technologies, interview topics in relevance order, and keywords. Use only this description.

Job description:
<jobDescription>
```

`jobDescription` on the model input is that same string. The prompt and the model input contain nothing else: no profile records, no resume file text, no other job, and no user id.

The Gemini client sends that prompt to Gemini with structured output bound to `jobAnalysisSchema`. It returns the provider value to the workflow. The workflow parses that value again with `jobAnalysisSchema`. A provider error or a schema failure rejects the workflow result.

The Gemini model id is `gemini-2.5-flash` unless `GEMINI_MODEL` is a non-empty string. `createGeminiJobAnalysisModel(apiKey: string, modelName: string)` receives both values from the API. The workflow module does not read environment variables.

### Stub model

`createStubJobAnalysisModel()` returns a model that does not call the network. For a description `jobDescription`, its result is:

| Field | Value |
| --- | --- |
| `requiredSkills` | `["stub-required"]` |
| `preferredSkills` | `["stub-preferred"]` |
| `responsibilities` | `["stub-responsibility"]` |
| `experienceRequirements` | `["stub-experience"]` |
| `technologies` | `["stub-technology"]` |
| `interviewTopics` | `["stub-topic-1", "stub-topic-2"]` |
| `keywords` | `[jobDescription.slice(0, 200)]` |

Topic order is fixed as listed. The keyword makes a replaced analysis observable.

### When the API calls the workflow

Validate the body and authenticate before any model call. A `400` or `401` does not call the model. A get, list, or delete does not call the model. A patch of a missing or another user's job returns `404` and does not call the model.

`POST /jobs` calls the workflow with the trimmed description. On success, one database transaction inserts the `Job` and its `JobAnalysis`. `analyzedDescription` is that trimmed description. On failure, it inserts nothing and returns `502` with `{ "error": "Job analysis failed" }`.

A description change is a patch whose trimmed `jobDescription` differs from the stored description. That request calls the workflow with the new trimmed description. On success, one transaction stores the new job fields and replaces the analysis row contents, including `analyzedDescription`. A job that had no analysis row gets one. On failure, the transaction does not run: the previous description, the other job fields, and the previous analysis stay as they were, and the response is `502` with `{ "error": "Job analysis failed" }`.

A patch that omits `jobDescription`, or sends a description that equals the stored description after trim, does not call the model. Other fields update. The analysis row is untouched. A legacy job with no analysis row stays without one, so `analysisCurrent` stays `false`.

Run the model before opening the write transaction. Do not hold a database transaction open across the model call.

Map every workflow failure to that same `502` body. Do not return the provider message, the prompt, or the API key. Do not log the job description, the prompt, the model output, access tokens, refresh tokens, passwords, or `JWT_SECRET`.

### Model selection

`createApp` accepts the existing auth options plus an optional `jobAnalysisModel`. Constructing the app does not call Gemini and does not require `GEMINI_API_KEY`.

When `jobAnalysisModel` is provided, job create and description update use it and do not read `GEMINI_API_KEY`.

When it is omitted, resolve the model at the start of a create or description update:

| `JOB_ANALYSIS_MODEL` | `GEMINI_API_KEY` | Client |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubJobAnalysisModel()` |
| unset or `gemini` | non-empty | Gemini, using `GEMINI_MODEL` or `gemini-2.5-flash` |
| unset or `gemini` | empty | no client |
| any other value | any | no client |

No client is an analysis failure: `502` and no write. `GET /health` does not resolve a model.

Compose sets `JOB_ANALYSIS_MODEL` to `stub` when that variable is unset in the shell, so local Playwright does not call Gemini. A live manual run sets `JOB_ANALYSIS_MODEL=gemini` and a real `GEMINI_API_KEY`. Document `JOB_ANALYSIS_MODEL`, `GEMINI_MODEL`, and `GEMINI_API_KEY` in `.env.example` as API-only. The web service still does not receive them.

### Dashboard

The dashboard still lists the Phase 9 row. It reads `status.analysisCurrent` from the parsed job. The analysis value text is exactly `Current` when that boolean is `true`, and exactly `Not available` when it is `false`. `data-testid="job-analysis"` stays. The other four status values stay `Not available`. Do not render the seven analysis arrays.

The Phase 9 jobs Playwright case creates a job through the real API. After this phase that create stores a stub analysis, so that case expects `Current` for analysis and `Not available` for the other four statuses, including after reload and after the title edit. Add a description edit in that case from `Build APIs.` to `Build reliable APIs.` and expect analysis to stay `Current`.

Forms, routes, query keys, and the profile view stay as Phase 9 left them. The web app parses `analysis` with `jobSchema` and does not send it.

## Affected subsystems

- Job analysis
- Jobs
- Dashboard
- `packages/ai`
- `apps/api`
- `packages/database`
- `packages/shared`
- `apps/web`

`apps/portfolio-mcp` stays a typecheck placeholder.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 10:

- MCP tools, Streamable HTTP, and calling the MCP server from this workflow. Phase 11. Only resume tailoring may call MCP, and that workflow is Phase 13.
- Embeddings, vector writes, and vector queries. Phase 12. Job analysis does not embed the description or the extracted fields.
- Tailored resume generation, resume JSON, and clearing a resume when the description changes. Phases 13 and 14. Those rows do not exist yet.
- Interview plans, clearing a plan when the description changes, question generation, answer evaluation, retakes, scores, and the readiness badge. Phases 15 through 18.
- Showing a present resume, a present plan, a numeric score, or `Interview Ready` on the dashboard.
- A job-analysis screen, a second analysis endpoint, and rendering the seven arrays in the browser.
- Backfilling analysis for jobs created before this migration.
- Re-ranking interview topics in application code.
- A queue, a worker process, a job runner, or a background retry.
- Changing auth token lifetimes, hashing, session rotation, or auth response bodies.
- Changing the Phase 5 profile contract or the Phase 6 and Phase 7 profile UI.
- Changing create and update field validation, job URL rules, or the `401` / `400` / `404` job error bodies.
- A routing library, a `/dashboard` path, or a `/jobs` path.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests stay local against Compose. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phase 9.

Phase 8 provides `POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, `DELETE /jobs/:id`, and the shared job schemas. Phase 9 provides the dashboard shell that reads `status.analysisCurrent`. Phase 4 provides the bearer token those requests already send.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 10, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Workflow package

- Add `@langchain/core`, `@langchain/langgraph`, and `@langchain/google-genai` to `packages/ai`. Add a workspace dependency on `@jobpilot/shared`.
- Add Vitest to `packages/ai` and a `test` script. Root `pnpm test` runs the existing `@jobpilot/api` unit tests and `@jobpilot/ai` tests. Do not add integration tests or Playwright to root `pnpm test`.
- The workflow file exports `analyzeJobDescription`, `createStubJobAnalysisModel`, and `createGeminiJobAnalysisModel`.
- `apps/api` depends on `@jobpilot/ai`. `apps/web` does not import `@jobpilot/ai` and does not receive `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `JWT_SECRET`, or `DATABASE_URL`.
- Keep TypeScript strict. Avoid `any` unless justified.

### API

- Keep route handlers thin. Zod parsing and HTTP status mapping stay at the controller boundary. The jobs service owns the model call, the current-analysis comparison, and the transaction.
- Thread `jobAnalysisModel` from `createApp` into the jobs router and service. The server entrypoint still calls `createApp()` with no model override.
- `createApp()` still succeeds when `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `RESUME_STORAGE_DIR` are unset. `GET /health` stays `200` and `{"status":"ok"}`.
- Update `apps/api/src/jobs.integration.test.ts` in place. Create the happy-path app with the stub model. Unset `GEMINI_API_KEY` and `JOB_ANALYSIS_MODEL` in that file. Add a second app with a model that rejects, and a third app with no override, for the failure cases.
- Supertest covers:
  - create stores the stub analysis, `analysisCurrent` is `true`, and `keywords` is `["Build APIs."]`
  - list and get return that same analysis and do not call the model again
  - a description patch to `Build reliable APIs.` replaces `keywords` with `["Build reliable APIs."]` and leaves one analysis row
  - a title-only patch does not call the model and leaves the analysis document and `analyzedDescription` unchanged
  - a patch that repeats the current description and changes the title does not call the model
  - a rejecting model on create returns `502` with `{ "error": "Job analysis failed" }` and leaves no `Job` or `JobAnalysis` row
  - a rejecting model on description update returns that same `502` and leaves the previous description, title, and analysis unchanged
  - a patch that changes the title and the description rolls back the title when the model rejects
  - `createApp()` with no model, and with both env vars unset, returns `502` on create and leaves no row
  - invalid input, a missing token, and another user's job do not call the model
  - a Prisma-inserted job with no analysis row returns `analysis: null` and `analysisCurrent: false`; a title patch keeps it that way; a description patch then stores analysis and returns `analysisCurrent: true`
  - setting `analyzedDescription` to a different string through Prisma makes a later get return the stored arrays with `analysisCurrent: false`
  - delete removes the job and its analysis row
  - `tailoredResumePresent`, `interviewPlanPresent`, `latestOverallScore`, and `readinessBadge` stay the Phase 8 empty values
- The sample job remains `Example Co` / `Engineer` / `Build APIs.` / `Remote` / `https://example.com/jobs/engineer`.
- Each test deletes the users it created. Cascade removes jobs and analyses.
- `pnpm --filter @jobpilot/api test:auth`, `test:profile`, and `test:resumes` still pass.

### Workflow tests

- Add `packages/ai/src/job-analysis.test.ts`. It uses the stub model and does not read `GEMINI_API_KEY`.
- Assert the returned document matches `jobAnalysisSchema`, including interview topic order `stub-topic-1` then `stub-topic-2`.
- Assert the recorded model input's `jobDescription` is the description passed in, and its `prompt` is exactly the prompt template plus that description.
- Call the workflow with a description that does not contain `Secret Employer` or `Secret Skill`, and assert those strings are absent from the prompt and from `jobDescription`.
- A stub that returns `{ "extra": true }` or an empty string item causes the workflow to reject.
- The Gemini factory is not called in this test.

### Web tests

- Update the Phase 9 Playwright jobs case in place. Compose for that run uses `JOB_ANALYSIS_MODEL=stub` and leaves `GEMINI_API_KEY` unset.
- The created row shows `Current` on `job-analysis` and `Not available` on the other four status test ids. Reload, open `Dashboard`, and see the same labels.
- The title edit to `Senior Engineer` keeps `Current`.
- The description edit to `Build reliable APIs.` keeps `Current` and shows the new description.
- The cleared URL, delete, loading, list error, form validation, and cross-user cases stay as Phase 9 defined them.
- The Phase 4, Phase 6, and Phase 7 Playwright cases still pass in the same `test:e2e` run.
- `pnpm test` and `pnpm typecheck` still pass with `DATABASE_URL`, `JWT_SECRET`, and `GEMINI_API_KEY` unset. The new workflow unit tests are part of `pnpm test`.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Prefer this one workflow and the existing jobs service over a new analysis framework.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
