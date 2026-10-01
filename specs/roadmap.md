# JobPilot AI — MVP Roadmap

The repository currently contains only `specs/`. These phases build the layout in `specs/tech-stack.md`: `apps/web`, `apps/api`, `apps/portfolio-mcp`, `packages/ai`, `packages/database`, and `packages/shared`.

Each phase is one independently implementable, reviewable, testable, and committable slice. Later phases must not be started inside an earlier commit. Automated tests use Vitest, Supertest, and Playwright. Gemini calls are stubbed in tests through a model client in `packages/ai`. Live Gemini is for manual runs only.

The first nine phases produce a working application without AI: a user can register, maintain a profile, create a job, and see that job on the dashboard. AI workflows are added after that, one at a time, in product order. AWS deployment and the S3 adapter are outside this roadmap. Resume uploads use local disk.

---

## Phase 1 — Monorepo and local runtime

### Objective

Boot a strict TypeScript monorepo locally and in CI.

### Functionality

- pnpm workspaces for the three apps and three packages.
- TypeScript strict mode.
- Express API with a health route.
- Vite, React, Tailwind CSS, and shadcn/ui, with one page that calls the health route through TanStack Query.
- Placeholder `packages/shared`, `packages/database`, `packages/ai`, and `apps/portfolio-mcp` that typecheck.
- Docker Compose for the API, web app, and PostgreSQL using a pgvector-capable image.
- Environment variables for secrets. The Gemini key is defined only for the API.
- GitHub Actions installs dependencies, typechecks, and runs Vitest.

### Affected subsystems

- Monorepo and tooling
- `apps/web`
- `apps/api`
- `apps/portfolio-mcp`
- `packages/shared`
- `packages/database`
- `packages/ai`
- Local Docker runtime
- GitHub Actions

### Acceptance criteria

- `pnpm` install and typecheck succeed.
- Compose starts PostgreSQL, the API, and the web app.
- The health route returns success.
- The web page shows that health result.
- CI runs typecheck and Vitest.
- The web app has no Gemini API key.

### Tests required

- Supertest: health route.
- Vitest runs that test in GitHub Actions.

### Dependencies

None.

---

## Phase 2 — Database foundation

### Objective

Give every later phase a migrated Prisma database on the Compose PostgreSQL instance.

### Functionality

- `packages/database` owns the Prisma schema, client, and migrations.
- The first migration enables the `vector` extension.
- No product tables yet.

### Affected subsystems

- `packages/database`
- Local Docker runtime

### Acceptance criteria

- Migrations apply to the Compose database.
- The `vector` extension is present.
- The API can import the Prisma client.

### Tests required

- Vitest: Prisma connects and the `vector` extension is installed.

### Dependencies

Phase 1.

---

## Phase 3 — Authentication API

### Objective

Authenticate users and isolate their data on the server.

### Functionality

- Register, log in, log out, and refresh.
- Argon2id password hashes.
- Access tokens are JWTs with a 15-minute lifetime, sent as `Authorization` bearer tokens.
- Refresh tokens last 7 days and are stored only in HttpOnly cookies. Production cookies are `Secure`.
- Refresh sessions are stored in PostgreSQL. Refresh rotates the token and revokes the previous session. Logout revokes the session.
- CORS allows the web origin to send credentials.
- Zod validates every auth input. Auth logic lives outside the controllers.
- Shared user and session schemas live in `packages/shared`.

### Affected subsystems

- Authentication
- `apps/api`
- `packages/database`
- `packages/shared`

### Acceptance criteria

- A new user can register and log in.
- A protected route accepts the access token.
- Refresh returns a new access token and replaces the refresh session.
- The previous refresh token fails after rotation.
- Logout causes a later refresh to fail.
- A request without a valid access token is rejected.
- Password hashes are Argon2id, and plaintext passwords are not stored.

### Tests required

- Supertest: register, login, protected route, refresh rotation, revoked refresh, and logout.
- Vitest: password hashing output is Argon2id.

### Dependencies

Phase 2.

---

## Phase 4 — Authentication UI

### Objective

Let a person register, log in, stay signed in, and log out in the browser.

### Functionality

- Register and login forms using React Hook Form, Zod, and shadcn/ui.
- The access token is held in memory and sent as a bearer token.
- On load, the app refreshes the session with the cookie.
- Logout clears the in-memory token and revokes the server session.
- Cookie `SameSite` and credentialed CORS work when the web app and API use different local origins.

### Affected subsystems

- Authentication
- `apps/web`
- `apps/api`

### Acceptance criteria

- A visitor can register and reach a signed-in page.
- Reloading the page restores the session through the refresh cookie.
- Logout returns the visitor to the signed-out state, and refresh no longer succeeds.
- The browser JavaScript cannot read the refresh cookie.

### Tests required

- Playwright: register, reload while signed in, and logout.
- Supertest from Phase 3 still passes.

### Dependencies

Phase 3.

---

## Phase 5 — Candidate profile API

### Objective

Store the structured profile that later becomes the only source of candidate facts.

### Functionality

- Create, read, update, and delete skills, education, work experience, projects, and certifications.
- Every query is scoped to the authenticated user.
- Zod schemas for these records live in `packages/shared`.
- Business logic lives outside controllers.

### Affected subsystems

- Candidate profile
- `apps/api`
- `packages/database`
- `packages/shared`

### Acceptance criteria

- The owner can create, list, update, and delete each record type.
- A second user cannot read or change the first user's records.
- Missing or invalid fields are rejected.

### Tests required

- Supertest: CRUD for each record type, validation failures, and cross-user access.

### Dependencies

Phase 3.

---

## Phase 6 — Candidate profile UI

### Objective

Let the signed-in user maintain the structured profile in the browser.

### Functionality

- Pages or sections for skills, education, work experience, projects, and certifications.
- Forms use React Hook Form, Zod, and shadcn/ui.
- Lists refresh through TanStack Query.

### Affected subsystems

- Candidate profile
- `apps/web`

### Acceptance criteria

- The user can add, edit, and delete one record of each type and see the result after reload.
- Empty sections show an empty state.

### Tests required

- Playwright: create, edit, and delete one record of each type.

### Dependencies

Phases 4 and 5.

---

## Phase 7 — Resume file storage

### Objective

Store uploaded resume files for the owner without parsing them.

### Functionality

- Upload, list, download, and delete resume files.
- File bytes are stored on local disk. PostgreSQL stores metadata and the storage location.
- Download and delete are limited to the owner.
- Uploaded files are not parsed, embedded, or exposed through an AI interface.

### Affected subsystems

- Candidate profile
- File storage
- `apps/api`
- `apps/web`
- `packages/database`

### Acceptance criteria

- The owner can upload a file, download the same bytes, and delete it.
- Another user cannot download or delete that file.
- Deleting the record removes the stored file.
- The profile fact records from Phase 5 remain the only structured candidate data.

### Tests required

- Supertest: upload, download, cross-user download, and delete.
- Playwright: upload and see the file on the profile page.

### Dependencies

Phases 5 and 6.

---

## Phase 8 — Jobs API

### Objective

Let a user save job postings and read dashboard status before any AI workflow exists.

### Functionality

- Create, read, update, and delete jobs owned by the user.
- Fields: company name, job title, job description, job location, and optional job URL.
- A job list response includes status for each job: analysis current, tailored resume present, interview plan present, latest overall score, and readiness badge.
- At this phase every new job has analysis not current, no resume, no plan, no score, and no badge.
- Deleting a job removes that job. Later phases extend this delete to child records they add.
- Zod schemas live in `packages/shared`.

### Affected subsystems

- Jobs
- Dashboard
- `apps/api`
- `packages/database`
- `packages/shared`

### Acceptance criteria

- The owner can create, list, update, and delete a job.
- Another user cannot read or change it.
- Status fields are present and show no AI results.
- Create does not call Gemini.

### Tests required

- Supertest: CRUD, validation, cross-user access, and the empty status fields.

### Dependencies

Phase 3.

---

## Phase 9 — Jobs UI and dashboard shell

### Objective

Complete the thin application: signed-in user, profile, job, and dashboard.

### Functionality

- Job create, edit, and delete screens.
- A dashboard lists company, title, and the status fields from Phase 8.
- Analysis, resume, plan, score, and badge are shown as not available.

### Affected subsystems

- Jobs
- Dashboard
- `apps/web`

### Acceptance criteria

- The user can create a job and see it on the dashboard after reload.
- Editing and deleting update the dashboard.
- The dashboard shows analysis, resume, plan, score, and badge as not available.
- The path from registration through profile and job creation works in one browser session.

### Tests required

- Playwright: register, add a profile record, create a job, see the dashboard status, edit the job, and delete it.

### Dependencies

Phases 4, 6, and 8.

This is the thin end-to-end application. Phases 10 through 18 add the AI flow on top of it.

---

## Phase 10 — Job analysis

### Objective

Analyze a job description in the request that creates or updates it.

### Functionality

- `packages/ai` contains one single-purpose LangGraph workflow for job analysis.
- The workflow reads the job description only and returns structured fields: required skills, preferred skills, responsibilities, experience requirements, technologies, interview topics in relevance order, and keywords.
- This phase replaces the Phase 8 create and description-update behavior on the existing job endpoints. It does not add a second create or update endpoint.
- Before Phase 10, creating a job stores the job and leaves analysis not current. No model is called.
- From Phase 10 onward, those same create and update operations follow the synchronous analysis rules in this phase.
- Creating a job runs analysis in that same request. The job and analysis are stored together. If analysis fails, the job is not stored.
- Changing the description replaces the analysis in that same request. If analysis fails, the previous description and analysis stay as they were.
- Changing other job fields leaves the analysis current.
- The dashboard reports analysis as current only when a stored analysis matches the current description.
- The API waits for the workflow. There is no queue or worker.

### Affected subsystems

- Job analysis
- Jobs
- Dashboard
- `packages/ai`
- `apps/api`
- `packages/database`
- `apps/web`

### Acceptance criteria

- Create and description update still use the Phase 8 job endpoints.
- A created job has a stored analysis and the dashboard shows analysis current.
- A description edit replaces the analysis.
- An edit that keeps the description does not change the analysis.
- A failed model call on create leaves no job behind.
- The workflow input is the job description. Profile records are not part of that input.

### Tests required

- Vitest: the workflow returns the structured schema from a stubbed model, and the prompt input excludes profile data.
- Supertest: create stores analysis, description update replaces it, and a stubbed model failure rolls back create.
- Playwright: creating a job shows analysis as current on the dashboard.

### Dependencies

Phase 9.

---

## Phase 11 — MCP exact tools

### Objective

Expose the authenticated user's structured profile through Streamable HTTP, without vector search.

### Functionality

- `apps/portfolio-mcp` serves the official MCP TypeScript SDK over Streamable HTTP.
- Tools: `get_candidate_profile`, `get_skills`, `get_experience`, `get_projects`, `get_project_details`, `get_education`, and `get_certifications`.
- Each tool reads the application database through `packages/database`.
- Tool schemas include no user id or other identity field.
- The server takes the user only from the trusted request context set by the caller. It ignores identity supplied in tool arguments.
- Compose starts the MCP server beside the API.
- No AI workflow calls the server yet.

### Affected subsystems

- MCP
- Candidate profile
- `apps/portfolio-mcp`
- `apps/api`
- `packages/database`
- Local Docker runtime

### Acceptance criteria

- Each tool returns only the context user's records.
- `get_project_details` returns one project owned by that user.
- A tool call cannot select a different user by argument.
- A second user's records are absent from the first user's tool results.
- Uploaded resume files are not returned.

### Tests required

- Vitest with the MCP client: each tool against seeded records for two users, including a call that tries to pass another user id.

### Dependencies

Phases 5 and 7.

---

## Phase 12 — Embeddings and candidate search

### Objective

Make `search_candidate_experience` the only RAG path.

### Functionality

- Creating or updating work experience or a project writes an embedding in the same request.
- Deleting one of those records deletes its embedding.
- `search_candidate_experience` queries pgvector and returns matching experience and projects for the context user only.
- Skills, education, certifications, uploaded files, and interview questions are not embedded.
- No workflow queries pgvector directly.

### MVP constraint

Embeddings stay synchronous for the MVP. The profile request waits for the embedding call, and there is no queued retry or background repair.

If embedding generation fails while creating or updating work experience or a project, that write fails and is not committed. The database and vector state stay consistent:

- A failed create leaves no profile row and no embedding.
- A failed update leaves the previous profile row and its previous embedding unchanged.

A Gemini embedding outage therefore blocks experience and project saves. That tradeoff is accepted so a saved record cannot exist without its embedding, and an embedding cannot exist without its record.

### Affected subsystems

- RAG and embeddings
- MCP
- Candidate profile
- `apps/portfolio-mcp`
- `packages/database`
- `apps/api`

### Acceptance criteria

- Saving experience or a project stores an embedding, and deleting it removes that embedding.
- A failed embedding on create leaves no new row and no embedding.
- A failed embedding on update leaves the previous row and embedding unchanged.
- Search results come from the context user's experience and projects.
- Another user's similar records are absent.
- The only database code that queries vectors is the search tool.

### Tests required

- Vitest: profile writes with a stubbed embedding client persist and delete vectors.
- Vitest: a stubbed embedding failure on create and on update leaves the database and vector rows aligned, including the previous row on update.
- Vitest with the MCP client: search ranks a nearer record first and excludes the other user.

### Dependencies

Phases 5 and 11.

---

## Phase 13 — Tailored resume workflow

### Objective

Generate one grounded resume JSON document for a job.

### Functionality

- A single-purpose LangGraph workflow in `packages/ai` reads the stored job analysis and calls MCP over Streamable HTTP.
- The API attaches the session user to the MCP request context before the workflow runs.
- Retrieval uses `search_candidate_experience`. Supporting facts use the section tools.
- The initial prompt does not contain the candidate profile. `get_candidate_profile` is not the retrieval step.
- The structured result includes skills, experience, projects, education, and certifications, and each item includes its source profile record id.
- The API rejects a result that cites a missing or another user's record, and it does not save that result.
- Each claim must be supported by its cited candidate records. The resume must not introduce numeric metrics, technologies, employers, job titles, dates, or accomplishments that are absent from those cited records.
- The API rejects a result that adds any of those unsupported facts, and it does not save that result.
- A job stores one current resume JSON. Generating again replaces it.
- The workflow requires a current analysis.
- Changing the job description clears the current resume when the new analysis is stored.
- Only this workflow may call MCP.

### Affected subsystems

- Resume tailoring
- MCP
- Job analysis
- `packages/ai`
- `apps/api`
- `apps/portfolio-mcp`
- `packages/database`

### Acceptance criteria

- A job with a current analysis gets one stored resume whose claims cite real profile record ids.
- Generating again replaces that row rather than adding a second current resume.
- A result with an unknown source id is rejected and leaves the previous resume unchanged.
- A result that cites real records but adds a numeric metric, technology, employer, job title, date, or accomplishment absent from those records is rejected and leaves the previous resume unchanged.
- A result whose claims stay within the cited records is saved.
- The workflow has no profile data until a tool returns it.
- The search tool is called for retrieval.
- A description change leaves the job without a current resume until generation runs again.
- Another user cannot generate or read the resume.

### Tests required

- Vitest: stubbed model and MCP client prove search is used, the initial prompt has no profile dump, and unknown source ids are rejected.
- Vitest: stubbed resumes that add an unsupported numeric metric, technology, employer, job title, date, or accomplishment are rejected, and a resume limited to the cited records is accepted.
- Supertest: generate, replace, cross-user access, missing analysis, resume cleared after a description change, and an unsupported claim does not replace the stored resume.

### Dependencies

Phases 10 and 12.

---

## Phase 14 — Tailored resume UI

### Objective

Let the user generate and read the current tailored resume from the job.

### Functionality

- The job screen requests generation and renders the stored JSON.
- The dashboard shows whether a current tailored resume exists.

### Affected subsystems

- Resume tailoring
- Dashboard
- `apps/web`

### Acceptance criteria

- The user can generate a resume, reload, and see the same content.
- Generating again updates the screen in place.
- After the job description changes, the dashboard shows that no current resume exists until the user generates it again.

### Tests required

- Playwright: generate a resume from a stubbed model, see it, regenerate it, and see the dashboard flag clear after a description edit.

### Dependencies

Phase 13.

---

## Phase 15 — Interview plan

### Objective

Store one category plan for a job from its current analysis.

### Functionality

- A single-purpose LangGraph workflow reads the stored job analysis only.
- It selects relevant categories, in relevance order, from: data structures and algorithms, frontend, backend, system design, machine learning, AI/LLM systems, and behavioral questions.
- It stores those categories and the analysis interview topics.
- A job has one current plan. Generating again replaces it.
- The workflow requires a current analysis and does not call MCP.
- Changing the job description clears the current plan when the new analysis is stored.
- The job screen can generate and show the plan. The dashboard shows whether a current plan exists.

### Affected subsystems

- Interview plan
- Job analysis
- Dashboard
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`

### Acceptance criteria

- A job with a current analysis gets one stored plan whose categories are from the allowed list and ordered.
- Generating again replaces the plan.
- The workflow input is the stored analysis. Profile records are not part of that input.
- A description change clears the plan.
- The dashboard shows the plan status.

### Tests required

- Vitest: stubbed model output is restricted to the allowed categories, and the input excludes profile data.
- Supertest: generate, replace, missing analysis, and clear-on-description-change.
- Playwright: generate a plan and see it on the job and dashboard.

### Dependencies

Phase 10. UI work also depends on Phase 9.

---

## Phase 16 — Interview question generation

### Objective

Start one 8-question attempt from the current plan without repeating stored questions.

### Functionality

- A single-purpose LangGraph workflow reads the stored plan and the job's stored question texts. It does not call MCP.
- An attempt is created only after 8 unique questions exist.
- TypeScript decides how many questions each category receives before any model call. Counts are as even as possible across the plan's categories. Extra questions go to categories earlier in the relevance order. One category receives all 8.
- Gemini only generates the requested questions for a category TypeScript already assigned. The model does not choose categories or counts. The stored category is the TypeScript assignment.
- Each stored question has text, category, expected concepts, and an evaluation rubric. Answer, feedback, and score are empty until Phase 17.
- Normalized question text is trimmed, internal whitespace is collapsed, and comparison is case-insensitive. A match against any stored question for that user and job is discarded.
- A generation round is one pass that asks the model for the questions still missing. The attempt allows at most 3 generation rounds.
- If 8 unique questions are not available after 3 rounds, the request fails and no attempt is stored.
- A job can have only one in-progress attempt.
- The attempt screen lists the 8 questions. The user cannot answer them yet.

### Affected subsystems

- Interview assessment
- Interview plan
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`

### Acceptance criteria

- Starting an attempt on a job with a current plan stores exactly 8 questions.
- A plan with categories A, B, and C in that order stores 3, 3, and 2 questions, and that count is computed before the model is called.
- A one-category plan stores 8 questions in that category.
- The model is asked for a specific category and count. A stub that labels a question with a different category still stores the category TypeScript assigned.
- A question whose normalized text already exists for that user and job is not stored.
- A stubbed model that only returns known texts uses 3 generation rounds, then the request fails and leaves the attempts unchanged.
- A stub that returns 8 unique questions on the first round does not start a second round.
- A second start while the first attempt is in progress is rejected.
- The in-progress attempt does not show a latest score or a readiness badge.
- The workflow input excludes profile data.

### Tests required

- Vitest: distribution for three categories and one category without a model call; each model request carries the assigned category and count; a conflicting category from the stub is ignored.
- Vitest: normalized-text rejection, stop after 3 rounds when unique questions run out, and no second round when the first round already has 8 unique questions.
- Supertest: start, second start conflict, and no row left behind after the 3-round failure.
- Playwright: start an attempt and see 8 questions.

### Dependencies

Phase 15.

---

## Phase 17 — Answer evaluation

### Objective

Score each answer in the open attempt.

### Functionality

- The user submits one answer at a time.
- A single-purpose LangGraph workflow reads that question, its rubric, and the answer. It does not call MCP.
- It returns structured feedback and an integer score from 0 through 100.
- The API stores the answer, feedback, and score on that question.
- The attempt stays in progress until all 8 questions have scores.
- The dashboard still ignores the in-progress attempt.

### Affected subsystems

- Interview assessment
- `packages/ai`
- `apps/api`
- `apps/web`
- `packages/database`

### Acceptance criteria

- Submitting an answer stores feedback and an integer score from 0 through 100.
- The other seven questions stay unanswered.
- The workflow input is the question, rubric, and answer.
- After all 8 answers are scored, the attempt is complete.
- The dashboard score and badge stay unchanged while the attempt is in progress.

### Tests required

- Vitest: the stubbed evaluation returns a structured score inside 0 through 100, and the input excludes profile data.
- Supertest: score one answer, reject an out-of-range stubbed score, and mark the attempt complete only after the eighth score.
- Playwright: submit an answer and see feedback and the score.

### Dependencies

Phase 16.

---

## Phase 18 — Retakes and readiness

### Objective

Finish the product flow by awarding a per-job readiness badge from the latest completed attempt.

### Functionality

- The overall score is the arithmetic mean of the 8 question scores.
- A category score is the arithmetic mean of that category's question scores. Categories with no questions on the attempt are ignored.
- The attempt passes only when the overall score is at least 80 and every tested category is at least 70.
- A passing latest attempt awards "Interview Ready" for that job only.
- A missing or failing latest attempt leaves the job without the badge.
- The user can start another attempt after a pass or a fail. Previous attempts, questions, answers, and scores remain stored. The new attempt still follows the Phase 16 uniqueness rules.
- The dashboard shows the latest completed overall score and the badge. An in-progress attempt does not replace that score or badge.
- Deleting a job deletes its analysis, plan, tailored resume, and attempts.

### Affected subsystems

- Interview assessment
- Readiness
- Dashboard
- Jobs
- `apps/api`
- `apps/web`
- `packages/database`

### Acceptance criteria

- A completed attempt with overall 80 or higher and every tested category 70 or higher shows the badge.
- A completed attempt below either threshold shows the score and no badge.
- After a newer completed attempt fails, the badge is removed even if an older attempt passed.
- A retake stores a new attempt and keeps the old one.
- The retake's questions do not match any normalized question text already stored for that user and job.
- The dashboard score remains the previous completed score until the new attempt is complete.
- Deleting the job removes its child analysis, plan, resume, and attempts.

### Tests required

- Vitest: pass and fail around the 80 and 70 boundaries, including an untested category that must not affect the result.
- Supertest: badge follows the latest completed attempt, history is kept, retake rejects a repeated question, and job delete cascades.
- Playwright: finish an attempt, see the score and badge on the dashboard, then complete a failing retake and see the badge removed.

### Dependencies

Phases 14 and 17.

---

## Completed flow

After Phase 18, one user can walk the full MVP path:

1. Register and sign in. Phases 3 and 4.
2. Enter a structured profile. Phases 5 and 6. Uploaded resume files from Phase 7 stay stored and unused by AI.
3. Create a job. Phases 8 and 9.
4. Job analysis runs in that create request. Phase 10.
5. Generate one tailored resume from MCP search and section tools. Phases 11 through 14.
6. Generate one interview plan from the stored analysis. Phase 15.
7. Start an 8-question assessment and score each answer. Phases 16 and 17.
8. The dashboard shows the latest score and the Interview Ready badge when that attempt passes. Phase 18.
