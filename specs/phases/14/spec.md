# Phase 14 — Tailored resume UI

## Objective

Let the signed-in user generate and read the one current tailored resume for a job, and see on the dashboard whether that resume exists.

## Scope

This phase adds only the tailored-resume UI described in the Phase 14 section of `specs/roadmap.md`:

- The job screen requests generation and renders the stored resume.
- Generating again replaces what that screen shows.
- The dashboard shows whether a current tailored resume exists.
- After the job description changes, the dashboard shows that no current resume exists until the user generates it again.

The browser uses the Phase 13 resume routes and the Phase 9 dashboard. It does not add routes, tables, or response fields.

The roadmap says "job screen" and "renders the stored JSON." It does not name a URL, the words for the dashboard flag, or the empty state. The choices below close those gaps.

### Job screen

The signed-in shell stays the Phase 9 view switcher. Do not add a routing library. There is no `/jobs` URL and no resume URL. Reload still returns to the profile view.

The job screen is a panel on the dashboard job row. It is mounted only while that row's panel is open and the dashboard view is mounted. `data-testid="tailored-resume-panel"` is present only then. At most one panel is open. Opening a row closes any other row's panel. Switching to `Profile`, logging out, or deleting that job unmounts the panel.

Each row has a button named `Tailored resume` with `data-testid="open-tailored-resume"`. It is not a heading. Clicking it opens that row's panel. While the panel is open, that button is not shown. `Close` with `data-testid="close-tailored-resume"` closes the panel and sends no generate request. The row's company, title, location, description, URL, status lines, `Edit job`, and `Delete job` stay visible while the panel is open.

The panel heading is `Tailored resume`. Opening the panel starts `GET /jobs/:id/tailored-resume`. The query key is `["tailored-resume", userId, jobId]`. The query function reads the current in-memory access token. Disable the query when the panel is not mounted or the access token is missing. Do not run that GET from the profile view, from a closed row, or while authentication is `loading` or `signed-out`.

While that GET is pending and the panel has no successful resume data yet, show `Loading resume…` on `data-testid="tailored-resume-loading"`. Do not show the empty state, the document, or `Generate resume` during that wait.

`404` with `{ "error": "Not found" }` is the empty state for a job row that is still on screen. The text is exactly `No tailored resume yet.` on `data-testid="tailored-resume-empty"`. Do not show that string as an alert. Any other failed GET shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show the empty state or the document.

A `200` body must match `{ resume: tailoredResumeSchema }` from `@jobpilot/shared`. A body that does not match shows `Request failed` and does not render a partial document. Render the parsed `resume` only.

### Generate

`Generate resume` with `data-testid="generate-tailored-resume"` is shown after the GET has settled as a `404` empty state or as a parsed document. It sends `POST /jobs/:id/tailored-resume` with a JSON body of `{}`. The same button is the first generate and every later replace.

Disable the button while that POST is in flight. Leave the current panel body in place during the request. Do not close the panel and do not switch views.

A successful POST returns `200` and `{ resume: tailoredResumeSchema }`. Parse that body with `tailoredResumeSchema`. Show the parsed document in the open panel. Hide the empty state. Refetch `GET /jobs` so the row flag follows the stored row. A second click, after the first request settles, sends another POST and replaces the document already on screen.

A failed POST shows the API `error` string, or `Request failed`, inside the panel and leaves the previous panel body in place. A `502` with `{ "error": "Resume generation failed" }` does not clear a document already shown and does not create the empty state's document. A `200` body that fails `tailoredResumeSchema` shows `Request failed`, leaves the previous panel body, and does not change the dashboard flag from that body.

A successful job update refetches the open panel's resume query along with `GET /jobs`. A title-only save still shows the document. A description save shows `No tailored resume yet.` after the GET `404`, and the row flag is `Not available`. Delete closes the panel and refetches the job list.

### Document

Render the five sections in this order: Skills, Experience, Projects, Education, Certifications. Each section heading is visible even when its array is empty. An empty section shows `None` and no item. Hide `None` when the section has an item.

| Section | Item `data-testid` | Text the item includes |
| --- | --- | --- |
| Skills | `resume-skill` | `name` and `sourceId` |
| Experience | `resume-experience` | `employer`, `jobTitle`, `startDate`, each accomplishment, each technology, and `sourceId`. Include `endDate` only when it is not null |
| Projects | `resume-project` | `name`, `description`, `sourceId`, each accomplishment, and each technology. Include `url`, `startDate`, and `endDate` only when the value is not null |
| Education | `resume-education` | `institution`, `degree`, `fieldOfStudy`, `startDate`, and `sourceId`. Include `endDate` only when it is not null |
| Certifications | `resume-certification` | `name`, `issuer`, `issuedOn`, and `sourceId`. Include `expiresOn` only when it is not null |

Dates are the stored calendar-date strings. Do not show a raw JSON dump. Do not show `userId`, `createdAt`, `updatedAt`, the job analysis, the prompt, MCP tool text, a password, a refresh token, or an access token.

### Dashboard flag

The row still reads `status.tailoredResumePresent` from the parsed job. The value text is exactly `Present` when that boolean is `true`, and exactly `Not available` when it is `false`. `data-testid="job-tailored-resume"` stays.

`job-analysis` stays `Current` or `Not available` from Phase 10. `job-interview-plan`, `job-score`, and `job-readiness` stay `Not available`.

Creating a job does not generate a resume. Until `POST /jobs/:id/tailored-resume` succeeds, the flag is `Not available`.

### Cache

When the session transitions to `signed-out`, remove cached tailored-resume queries from the in-memory TanStack Query client, along with the existing jobs-query removal. When the authenticated user id changes in the same document, remove the previous user's tailored-resume queries. Do not persist the query cache. Do not write the access token to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.

Resume requests send `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` with `credentials: "include"`. They do not go through the Vite `/health` proxy.

## Affected subsystems

- Resume tailoring
- Dashboard
- `apps/web`

`apps/api`, `apps/portfolio-mcp`, `packages/ai`, `packages/database`, and `packages/shared` stay as Phase 13 left them. Phase 13 already allows credentialed `GET` and `POST` on `/jobs/:id/tailored-resume` from `WEB_ORIGIN` with `Content-Type` and `Authorization`. If a browser on `http://localhost:5173` cannot call those existing routes on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change resume status codes, response bodies, grounding, or the job HTTP contract.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 14:

- Interview plans, a plan control, clearing a plan on description change, question generation, answer evaluation, retakes, scores, and the readiness badge. Phases 15 through 18.
- Showing a present plan, a numeric score, or `Interview Ready`.
- Editing the resume in the browser, keeping earlier resume versions, or downloading the resume as a file.
- A second generate endpoint, a change to `tailoredResumeSchema`, or a change to grounding.
- Calling Gemini, MCP, or `@jobpilot/ai` from the web app.
- Parsing or displaying uploaded resume files.
- A routing library, a `/jobs` path, and restoring the dashboard or the open panel after reload.
- A queue, a worker process, or a job runner.
- A client refresh that runs when a resume request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing auth, profile, job-analysis, embedding, or MCP behavior.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. `.github/workflows/ci.yml` stays typecheck plus `pnpm test`.

## Dependencies

Phase 13.

Phase 13 provides `POST /jobs/:id/tailored-resume`, `GET /jobs/:id/tailored-resume`, `tailoredResumeSchema`, the one `TailoredResume` row, and `status.tailoredResumePresent`. Phase 9 provides the dashboard shell. Phase 10 provides the analysis label. Phase 6 provides the skill form the browser test uses to change the profile between generates. Compose already runs the API with `RESUME_MODEL=stub` and `portfolio-mcp`.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 14, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Web

- Keep the profile view, job forms, and analysis label as Phases 9 and 10 left them.
- Use the existing Button and TanStack Query patterns. Do not add a dependency.
- Parse the resume response with `tailoredResumeSchema` from `@jobpilot/shared`. Do not copy that schema into the web app.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `JOB_ANALYSIS_MODEL`, `EMBEDDING_MODEL`, `RESUME_MODEL`, `MCP_SHARED_SECRET`, or `MCP_URL` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini or MCP from the browser.
- Enable TypeScript strict mode. Avoid `any` unless justified.

### Tests

- Add `apps/web/e2e/tailored-resume.spec.ts`. Do not change the Phase 9 jobs case's status expectations. That case still does not generate a resume, so `job-tailored-resume` stays `Not available`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions.
- Compose for that run uses `JOB_ANALYSIS_MODEL=stub`, `EMBEDDING_MODEL=stub`, and `RESUME_MODEL=stub`, and leaves `GEMINI_API_KEY` empty. `portfolio-mcp` is running. The test does not inject a model. Generation uses the API stub, which copies the caller's profile section records.
- The new case registers a unique `phase14-` email, logs in, and adds a skill named `TypeScript` through the existing Add skill form. It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. The row shows analysis `Current`, tailored resume `Not available`, and the other three statuses `Not available`.
- It opens `Tailored resume`, sees `No tailored resume yet.`, and does not see a `resume-skill` item. `Generate resume` sends `POST` with a JSON object that has no keys. The panel stays open and shows a `resume-skill` whose text includes `TypeScript`. The row flag becomes `Present`.
- It opens `Profile`, adds a skill named `Go`, opens `Dashboard`, and opens `Tailored resume` again. Before the second generate, the panel shows `TypeScript` and does not show `Go`. `Generate resume` stays on that panel. After it succeeds, the panel shows both `TypeScript` and `Go`, and the flag stays `Present`.
- It edits the description to `Build reliable APIs.` and saves. Analysis stays `Current`. The flag becomes `Not available`. The open panel shows `No tailored resume yet.` and no longer shows `TypeScript`. `Generate resume` again shows `TypeScript` and `Go`, and the flag becomes `Present`.
- One case opens the panel and stubs `POST /jobs/:id/tailored-resume` to `502` with `{ "error": "Resume generation failed" }`. The panel shows that string and `No tailored resume yet.`.
- One case generates a resume that shows `TypeScript`, then stubs the next `POST` to that same `502`. The panel still shows `TypeScript`, and the flag stays `Present`.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Cascade removes the skill, job, analysis, and resume rows. It does not add a delete-user route.
- The Phase 4, Phase 6, Phase 7, and Phase 9 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, `test:jobs`, and `test:tailored-resume` still pass. `pnpm --filter @jobpilot/portfolio-mcp test` still passes. `pnpm test` and `pnpm typecheck` still pass.
- Do not add a migration. Do not add PostgreSQL or Playwright to GitHub Actions. Do not change `.github/workflows/ci.yml`.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
