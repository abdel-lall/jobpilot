# Phase 13 — Tailored resume workflow

## Objective

Generate one grounded resume JSON document for a job, and replace it when generation runs again.

## Scope

This phase adds only the tailored-resume workflow described in the Phase 13 section of `specs/roadmap.md`:

- `packages/ai` contains one single-purpose LangGraph workflow for resume tailoring.
- The workflow reads the stored job analysis and calls MCP tools through a client the API supplies.
- The API attaches the session user to the MCP request context before the workflow runs.
- Retrieval uses `search_candidate_experience`. Supporting facts use the section tools `get_skills`, `get_experience`, `get_projects`, `get_education`, and `get_certifications`.
- The initial prompt does not contain the candidate profile. `get_candidate_profile` is not called.
- The structured result includes skills, experience, projects, education, and certifications. Each item includes its source profile record id.
- The API rejects a result that cites a missing record, another user's record, or the wrong record type, and it does not save that result.
- Each claim must be supported by its cited candidate record. The resume must not introduce numeric metrics, technologies, employers, job titles, dates, or accomplishments that are absent from that cited record.
- The API rejects a result that adds any of those unsupported facts, and it does not save that result.
- A job stores one current resume JSON. Generating again replaces that row.
- The workflow requires a current analysis.
- Changing the job description clears the current resume when the new analysis is stored.
- Only this workflow may call MCP.

The roadmap names the grounding rule and the storage rule. It does not name the route, the table, the JSON shape, the failure status, or how a rewritten bullet is judged. The contract below closes those gaps.

### Resume document

`tailoredResumeSchema` in `packages/shared` is a `.strict()` object. `packages/ai` imports it from `@jobpilot/shared`. The API uses the same schema. The web app does not render it in this phase.

`sourceId` is a lowercase UUID matching `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`. Each array allows 0 through 50 items. Item order is the model order. The API does not sort or dedupe items.

| Section | Fields besides `sourceId` | String rules |
| --- | --- | --- |
| `skills` | `name` | trimmed, length 1 through 80 |
| `experience` | `employer`, `jobTitle`, `startDate`, `endDate`, `accomplishments`, `technologies` | employer and job title trimmed, length 1 through 200. Accomplishments: 0 through 20 items, each trimmed, length 1 through 500. Technologies: 0 through 30 items, each trimmed, length 1 through 80 |
| `projects` | `name`, `description`, `url`, `startDate`, `endDate`, `accomplishments`, `technologies` | name trimmed, length 1 through 200. Description trimmed, length 1 through 2000. `url` is an `http` or `https` URL of length 1 through 500, or `null` |
| `education` | `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate` | each text field trimmed, length 1 through 200 |
| `certifications` | `name`, `issuer`, `issuedOn`, `expiresOn` | name and issuer trimmed, length 1 through 200 |

Dates use the Phase 5 calendar-date schema. `endDate` and `expiresOn` are nullable. A missing field, an unknown key, an empty trimmed string, or an array over its limit makes the whole document invalid.

An empty document, with all five arrays empty, is valid. It cites nothing and adds nothing.

### Stored row

`packages/database` gains one model, `TailoredResume`, in one new migration named `20261003160000_tailored_resume`. `Job` gains the relation. Do not edit these migrations:

- `20260930120000_enable_vector`
- `20261001050000_user_refresh_session`
- `20261001140000_candidate_profile`
- `20261001180000_resume_file`
- `20261001220000_job`
- `20261002120000_job_analysis`
- `20261003120000_experience_project_embedding`

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `jobId` | foreign key to `Job`, `@unique`, `onDelete: Cascade` |
| `document` | `Json` |
| `createdAt` | `DateTime`, `@default(now())` |
| `updatedAt` | `DateTime`, `@updatedAt` |

A job has at most one tailored-resume row. `document` is the parsed resume object. Deleting a job deletes that row. Deleting a user still deletes that user's jobs, and those deletes remove the resume rows. This phase does not add plan or attempt tables.

`tailoredResumePresent` is derived, not stored. It is `true` only when that row exists. Jobs created before this migration have no row. Do not backfill them.

### Public job JSON

Create, list, get, and update still return the Phase 10 job object. Two parts change:

- `status.tailoredResumePresent` becomes a boolean. `status.interviewPlanPresent` stays `false`. `status.latestOverallScore` and `status.readinessBadge` stay `null`.
- The job object does not gain a resume field. Clients read the document from the routes below.

`createJobBodySchema` and `updateJobBodySchema` stay as Phase 8 defined them. A body that includes `resume`, `analysis`, `status`, or any other unknown key is still `400`.

### Routes

Both routes require the access token. A missing or invalid token is `401` with `{ "error": "Unauthorized" }` and does not call MCP or the model.

| Method and path | Behavior |
| --- | --- |
| `POST /jobs/:id/tailored-resume` | Generate or replace the current resume |
| `GET /jobs/:id/tailored-resume` | Read the current resume |

`POST` has no fields. A JSON object with any key is `400` with `{ "error": "Invalid input" }` and does not call MCP or the model. An empty object is valid.

A missing job, or another user's job, is `404` with `{ "error": "Not found" }` on both methods. `GET` uses that same `404` when the job exists and has no resume row.

A job whose analysis is not current is `409` on `POST` with `{ "error": "Job analysis is not current" }`. Analysis is current only when an analysis row exists and `analyzedDescription` equals the job's current `jobDescription`. That response does not call MCP or the model. `GET` does not use `409`.

A successful `POST` or `GET` returns `200` and `{ "resume": <tailoredResumeSchema> }`. `POST` uses `200` for the first generate and for every replace.

### Workflow

`packages/ai` exports:

```ts
type ResumeToolClient = {
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
};

type ResumeToolResults = {
  search: string;
  skills: string;
  experience: string;
  projects: string;
  education: string;
  certifications: string;
};

type ResumeTailoringModelInput = {
  prompt: string;
  toolResults: ResumeToolResults;
};

type ResumeTailoringModel = {
  write(input: ResumeTailoringModelInput): Promise<unknown>;
};

tailorResume(
  analysis: JobAnalysis,
  tools: ResumeToolClient,
  model: ResumeTailoringModel,
): Promise<TailoredResume>
```

The LangGraph graph has three nodes and no checkpointer. It does not call another workflow. The model has no tools. The graph is the only caller of `callTool`.

1. `retrieve` calls `search_candidate_experience` once with `{ query }`. The query is built only from the analysis, as defined below. This node runs before any section tool and before the model.
2. `load_sections` calls `get_skills`, `get_experience`, `get_projects`, `get_education`, and `get_certifications`, in that order, each once, with `{}`.
3. `draft` builds the prompt, parses each tool text with `JSON.parse`, calls `model.write`, and parses the model value with `tailoredResumeSchema`.

The graph starts at `retrieve` and ends at `draft`. State at the start is the analysis only. Profile text enters state only as tool text.

The workflow must not call `get_candidate_profile` or `get_project_details`. `get_projects` already returns the project facts this resume can cite. A tool error rejects the workflow. `callTool` rejects instead of returning `isError` text. Invalid JSON rejects the workflow before `model.write`.

The search query is these seven lines joined by `\n`, then sliced to 2000 characters and trimmed. Lists use `", "` between items. An empty array leaves the label with nothing after the colon.

```text
Required skills: <requiredSkills>
Preferred skills: <preferredSkills>
Responsibilities: <responsibilities>
Experience requirements: <experienceRequirements>
Technologies: <technologies>
Interview topics: <interviewTopics>
Keywords: <keywords>
```

If that trimmed value is empty, the query is `job`. The query does not include the job description, profile records, resume-file text, a user id, or an email.

The prompt is exactly this string. `JSON.stringify(analysis)` uses the seven analysis keys in schema order. Each tool text is the raw `callTool` string.

```text
Write one tailored resume for this job analysis. Use only the MCP tool results below. Do not add numeric metrics, technologies, employers, job titles, dates, or accomplishments that are absent from those results. Each item must cite the source profile record id from the tool results.

Job analysis:
<JSON.stringify(analysis)>

MCP tool results:
search_candidate_experience:
<search text>
get_skills:
<skills text>
get_experience:
<experience text>
get_projects:
<projects text>
get_education:
<education text>
get_certifications:
<certifications text>
```

The prefix through the line `MCP tool results:` is the initial prompt. It contains the analysis and none of the tool text. `toolResults` on the model input carries the same six raw strings. The Gemini client sends `prompt` only.

`createGeminiResumeModel(apiKey: string, modelName: string)` binds structured output to `tailoredResumeSchema`. The workflow module does not read environment variables.

### Stub model

`createStubResumeModel()` does not use the network and does not read environment variables. It parses the five section JSON strings and copies every returned record into the resume. It parses the search JSON and does not copy matches.

| Tool JSON | Resume item |
| --- | --- |
| `{ "skills": [...] }` | `{ sourceId: id, name }` |
| `{ "experience": [...] }` | `sourceId` plus `employer`, `jobTitle`, `startDate`, `endDate`, `accomplishments`, `technologies` |
| `{ "projects": [...] }` | `sourceId` plus `name`, `description`, `url`, `startDate`, `endDate`, `accomplishments`, `technologies` |
| `{ "education": [...] }` | `sourceId` plus `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate` |
| `{ "certifications": [...] }` | `sourceId` plus `name`, `issuer`, `issuedOn`, `expiresOn` |

Section records are the Phase 11 public objects: fact fields, `id`, `createdAt`, and `updatedAt`, without `userId`. The stub ignores timestamps. A missing key, a non-array section, or invalid JSON throws. The copied document must satisfy `tailoredResumeSchema`.

### MCP client

`apps/api` is the MCP client. `packages/ai` does not depend on `@modelcontextprotocol/sdk` and does not open a socket.

`createResumeToolClient({ url, secret, userId })` uses the official SDK Streamable HTTP client. Every request sends `x-jobpilot-mcp-secret` and `x-jobpilot-user-id`. Tool arguments do not include a user id, an email, or the secret. The client reads `callTool` text content. `isError`, a transport failure, or a missing text part rejects.

`createApp` accepts the existing options plus optional `resumeToolClient` and `resumeModel`. Constructing the app does not call Gemini, does not connect to MCP, and does not require `GEMINI_API_KEY` or `MCP_SHARED_SECRET`.

When `resumeToolClient` is provided, generation uses it and does not read `MCP_URL` or `MCP_SHARED_SECRET`. When `resumeModel` is provided, generation uses it and does not read `GEMINI_API_KEY`, `GEMINI_MODEL`, or `RESUME_MODEL`.

When a value is omitted, resolve it at the start of `POST`, after authentication, the `400` body check, the `404` check, and the `409` check. If either the client or the model cannot be resolved, return `502` and call neither.

| `RESUME_MODEL` | `GEMINI_API_KEY` | Model |
| --- | --- | --- |
| `stub` | any value, including empty | `createStubResumeModel()` |
| unset or `gemini` | non-empty | Gemini, model `GEMINI_MODEL` or else `gemini-2.5-flash` |
| unset or `gemini` | empty | no model |
| any other value | any | no model |

The HTTP client is available only when `MCP_SHARED_SECRET` is non-empty. `MCP_URL` defaults to `http://127.0.0.1:3010/mcp` when unset or blank. The user id is the access-token user.

Compose sets `RESUME_MODEL` to `stub` on the API when that variable is unset in the shell. Compose sets `MCP_URL` to `http://portfolio-mcp:3010/mcp` and passes `MCP_SHARED_SECRET` to the API. The API service `depends_on` `portfolio-mcp`. A live manual run sets `RESUME_MODEL=gemini` and a real `GEMINI_API_KEY`.

Document `RESUME_MODEL` and `MCP_URL` in `.env.example`. `MCP_SHARED_SECRET` is now used by the API and by `portfolio-mcp`. The web service still does not receive `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `JWT_SECRET`, `DATABASE_URL`, `MCP_SHARED_SECRET`, or `MCP_URL`.

`apps/portfolio-mcp` stays as Phase 12 left it. This phase does not add a tool, change a tool schema, or change the vector query.

### When the API saves

Validate, authenticate, load the owned job, and reject a missing current analysis before any tool call or model call. `GET`, job create, job list, and job delete do not call this workflow. A title-only job update does not call it.

On `POST`, run the workflow, then load that user's skills, experience, projects, education, and certifications from the database and run `assertTailoredResumeGrounded`. The checker uses those rows, not the tool payload. On success, upsert the one `TailoredResume` row for that `jobId` and store the parsed document. A second `POST` updates that same row. It does not insert a second current resume.

Run the workflow before opening the write. Do not hold a database transaction open across MCP or the model.

Map every workflow failure and every grounding failure to `502` with `{ "error": "Resume generation failed" }`. Leave the previous row unchanged. Create nothing when there was no previous row. Do not return the provider message, the prompt, the tool text, or which check failed. Do not log the job description, the analysis, the prompt, tool results, the resume, profile fields, access tokens, refresh tokens, passwords, `JWT_SECRET`, or `MCP_SHARED_SECRET`.

### Grounding

`packages/ai` exports `assertTailoredResumeGrounded(resume, profile, analysis)`. It throws when the resume is not grounded. It does not read the database, the network, or environment variables. The profile argument is the owner's records only, in the public fact shape plus `id`. It excludes `userId`, timestamps, resume files, and jobs.

A `sourceId` that is absent from that section's records is rejected. An experience id cited as a skill, project, education row, or certification is rejected. Another user's id is absent from this profile, so it is rejected the same way.

These fields must equal the cited record with `===`:

- Skill: `name`.
- Experience: `employer`, `jobTitle`, `startDate`, `endDate`.
- Project: `name`, `url`, `startDate`, `endDate`.
- Education: `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate`.
- Certification: `name`, `issuer`, `issuedOn`, `expiresOn`.

Each experience or project technology must be a member of that record's `technologies` array, compared with `===`. The resume may omit technologies. It may repeat a technology the record already has. It may not add one.

Rewritten text is experience `accomplishments`, project `description`, and project `accomplishments`. Education and certifications have no rewritten text. A rewritten string may use words from the cited record and words from the stored analysis. It may also use these function words, compared after lowercasing:

```text
a an the and or but of in on at to for from by with as into over after before during without within through than then that this these those is are was were be been being it its their them they using
```

Tokenize a string by lowercasing it and splitting on every character that is not a Unicode letter or number. Drop empty tokens and function words. The allowed set for a cited record is the tokens of its fact fields, including its date strings and its technologies, plus the tokens of every string in the seven analysis arrays. A rewritten string is accepted only when every remaining token is in that set. `id`, `userId`, timestamps, the raw job description, and uploaded file text are not in the allowed set.

That rule is what rejects a new numeric metric, a new technology word, a new employer or job title inside a bullet, a new date, or a new accomplishment. These are rejected for a record whose accomplishment is `Led the API migration`, whose technology list is `TypeScript`, and whose analysis keywords do not contain the extra words:

| Added claim | Example |
| --- | --- |
| Numeric metric | accomplishment `Led the API migration by 40 percent` |
| Technology | `technologies` includes `Kubernetes`, or a bullet contains `Kubernetes` |
| Employer | `employer` is `Contoso`, or a bullet contains `Contoso` |
| Job title | `jobTitle` is `Architect`, or a bullet contains `Architect` |
| Date | `startDate` is `2019-01-15` while the record starts on `2020-01-15`, or a bullet contains `2019` |
| Accomplishment | bullet `Won a hackathon` |

This bullet is accepted when `reliability` is an analysis keyword: `Led the API migration for reliability`. A resume that copies the cited fields exactly is accepted. Omitting an optional accomplishment or technology is accepted.

### Description changes

A description change is still the Phase 10 path on `PATCH /jobs/:id`. When the new analysis is stored, that same transaction deletes the tailored-resume row for that job. If no row exists, the delete changes nothing. The response then has `tailoredResumePresent: false`.

If analysis fails, the transaction does not run. The previous description, analysis, and tailored resume stay as they were.

A patch that does not change the description does not delete the resume and does not call the resume workflow.

Creating a job does not create a resume. `tailoredResumePresent` is `false` until `POST /jobs/:id/tailored-resume` succeeds.

### Dashboard compatibility

`apps/web` must keep compiling after `tailoredResumePresent` becomes a boolean. Widen the dashboard helper that currently accepts `false | null` so it also accepts `boolean`. It still returns the text `Not available` for tailored resume, interview plan, score, and readiness. Do not add a generate control, do not render the resume JSON, and do not change that label. Phase 14 owns the visible resume state.

Existing Playwright still creates a job and expects `Not available` on `job-tailored-resume`, because that flow does not generate a resume.

## Affected subsystems

- Resume tailoring
- MCP
- Job analysis
- `packages/ai`
- `apps/api`
- `packages/database`
- `packages/shared`
- `apps/web`, limited to the `tailoredResumePresent` boolean type and the unchanged `Not available` label

`apps/portfolio-mcp` is called and is not modified. `packages/database` gains the table and the migration. `packages/ai` gains the workflow, the stub, the Gemini model factory, and the grounding check. It does not query vectors and does not open MCP itself. `apps/api` is the only new MCP caller, and only the resume workflow uses that client.

Job analysis remains a separate workflow. It still does not call MCP.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 13:

- The job screen control that generates a resume, rendering the resume JSON, and changing the dashboard label away from `Not available`. Phase 14.
- Interview plans, clearing a plan on description change, question generation, answer evaluation, retakes, scores, and the readiness badge. Phases 15 through 18.
- Showing a present plan, a numeric score, or `Interview Ready`.
- Keeping earlier resume versions. A job has one current document.
- Calling `get_candidate_profile` or `get_project_details` from this workflow.
- Letting the model choose the MCP user, or letting any workflow other than resume tailoring call MCP.
- Parsing, embedding, or sending uploaded resume files.
- A queue, a worker, a background retry, or a second resume route.
- Changing auth token lifetimes, hashing, session rotation, or auth response bodies.
- Changing profile routes, embedding writes, or the Phase 12 search SQL.
- Changing job-analysis prompts, the analysis document, or the `502` analysis failure body.
- A new product table besides `TailoredResume`, or a change to an existing migration.
- A GitHub Actions PostgreSQL service or a Playwright job. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phases 10 and 12.

Phase 10 provides the stored analysis, `analysisCurrent`, and the description-update transaction this phase extends with the resume delete. Phase 12 provides `search_candidate_experience`. Phase 11 provides the section tools, the trusted headers, and the public profile JSON. Phase 5 provides the profile rows the grounding check loads.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 13, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Packages

- Add the workflow, `createStubResumeModel`, `createGeminiResumeModel`, and `assertTailoredResumeGrounded` to `packages/ai`. Add `packages/ai/src/tailored-resume.test.ts`. Those tests are part of root `pnpm test`. They do not read `GEMINI_API_KEY`, `DATABASE_URL`, or `MCP_SHARED_SECRET`, and they do not call the network.
- Add `@modelcontextprotocol/sdk` `1.32.0` to `apps/api` for the Streamable HTTP client. Do not add that dependency to `packages/ai`.
- Keep route handlers thin. The tailored-resume service owns the workflow call, the grounding load, and the upsert. The jobs service owns clearing the resume inside the existing description-update transaction.
- Keep TypeScript strict. Avoid `any` unless justified.
- Do not add a queue, a worker, or a job runner.

### Workflow tests

- Assert the search tool is called once, before the five section tools and before `write`, with the analysis query above.
- Assert `get_candidate_profile` and `get_project_details` are not called.
- Seed the tool text with `Secret Employer`. Assert that string is absent from the search query and from the prompt prefix through `MCP tool results:`, and present in the full prompt only as returned tool text.
- Assert a model value of `{ "extra": true }` causes `tailorResume` to reject.
- Assert `assertTailoredResumeGrounded` rejects an unknown source id, another section's id, and each unsupported claim in the table above.
- Assert an exact copy is accepted, and assert `Led the API migration for reliability` is accepted when `reliability` is an analysis keyword.
- The Gemini factory is not called in this test.

### API tests

- Add `apps/api/src/tailored-resume.integration.test.ts` and `apps/api/vitest.tailored-resume.config.ts`. The script is `test:tailored-resume`. It is not part of root `pnpm test`.
- Create the app with `createStubResumeModel()` and an injected tool client. Unset `GEMINI_API_KEY`, `RESUME_MODEL`, `MCP_URL`, and `MCP_SHARED_SECRET` in that file. Seed one user with one current analysis and one record of each profile type. Give that user one `ResumeFile` row and do not write a file on disk.
- Assert `POST` stores one row, `GET` returns that document, and `status.tailoredResumePresent` is `true`.
- Assert the tool client saw `search_candidate_experience` and did not see `get_candidate_profile`.
- Assert the recorded prompt omits the resume file name and `storagePath`.
- Assert a second `POST` with a stub that changes a rewritten bullet within the allowed tokens updates the same row and leaves the row count at one.
- Assert a model that cites an unknown id returns `502` with `{ "error": "Resume generation failed" }` and leaves the previous document unchanged.
- Assert a model that adds `Kubernetes` to a cited experience's technologies returns that same `502` and leaves the previous document unchanged.
- Assert a model that cites the other user's experience id returns that same `502`.
- Assert the other user receives `404` on `POST` and `GET` and cannot read the first user's document.
- Assert a job with no analysis row, and a job whose `analyzedDescription` differs, each return `409` and do not call the tool client.
- Assert a description change deletes the resume row and returns `tailoredResumePresent: false`. A later `GET` is `404`.
- Assert a rejecting job-analysis model on a description change leaves the previous resume in place.
- Assert a title-only patch leaves the resume in place.
- Assert deleting the job deletes the resume row.
- Assert a `POST` body with a key, and a missing token, do not call the tool client.
- Assert `createApp()` with no resume override, and with `RESUME_MODEL` and `GEMINI_API_KEY` unset, returns `502` on `POST` and writes nothing.
- Add a header test for `createResumeToolClient`: a local HTTP server records the first request and closes. The call may fail. The recorded headers include the configured secret and user id. The recorded body does not contain that user id.
- Each test deletes the users it created.
- `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, and `test:jobs` still pass. Existing jobs assertions that expect `tailoredResumePresent: false` stay true because those tests do not generate a resume.
- `pnpm --filter @jobpilot/portfolio-mcp test` still passes without a source change.

### Runtime

- `pnpm typecheck` includes the workflow, the shared schema, and the widened dashboard helper.
- `pnpm test` and `pnpm typecheck` still pass with `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `EMBEDDING_MODEL`, `RESUME_MODEL`, and `MCP_SHARED_SECRET` unset.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a Playwright case. The existing suite still expects the tailored-resume label `Not available`.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
