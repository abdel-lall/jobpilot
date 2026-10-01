# Phase 9 — Jobs UI and dashboard shell

## Objective

Complete the thin application: a signed-in user can keep a profile, save a job, and see that job on the dashboard.

## Scope

This phase adds only the jobs UI and dashboard shell described in the Phase 9 section of `specs/roadmap.md`:

- A signed-in shell with two views: the existing profile page, and a dashboard.
- Job create, edit, and delete on the dashboard.
- The dashboard lists each job's company, title, and the Phase 8 status fields.
- Analysis, tailored resume, interview plan, score, and readiness badge are shown as not available.

The browser uses the Phase 8 jobs HTTP contract and the Phase 6 profile UI. It does not add routes, tables, or response fields.

The roadmap says "screens" and does not name a router, URLs, or the words shown for empty status. The choices below close those gaps.

### Shell

The signed-in page keeps the Phase 4 account summary: `data-testid="signed-in"`, `data-testid="user-email"`, and the `Log out` button. Add a view switcher on that same page. Do not add a routing library. There is no `/dashboard` URL and no `/jobs` URL. Reload always returns to the profile view, because the selected view is in memory only.

The switcher has two buttons, in this order: `Profile` and `Dashboard`. Their `data-testid` values are `nav-profile` and `nav-dashboard`. The switcher itself is `data-testid="app-nav"`. These buttons are not headings.

`Profile` is the view shown when the session becomes `signed-in`, including after reload and after login. That view is the current profile page: Skills, Education, Work experience, Projects, Certifications, then Resumes. Those headings stay the first headings in the document, in that order, so the Phase 6 heading checks still match. The dashboard is not mounted on this view, and `GET /jobs` does not run.

`Dashboard` unmounts the profile sections and mounts the dashboard. `data-testid="dashboard"` is present only on that view. Its heading text is `Dashboard`. Returning to `Profile` unmounts the dashboard and mounts the profile sections again.

The account summary and the switcher stay visible on both views. Profile sections, the resume section, and the dashboard do not render during `loading` or `signed-out`. Entering `signed-in` does not wait for `GET /jobs`.

### Dashboard list

The dashboard has one TanStack Query list: `GET /jobs` → `{ "jobs": Job[] }`. The query key is `["jobs", userId]`, using the `/auth/me` user id. The key does not include the access token. The query function reads the current in-memory access token. Disable the query when the access token is missing or the dashboard is not mounted.

When the session transitions to `signed-out`, remove cached jobs queries from the in-memory TanStack Query client, along with the existing profile-query removal. When the authenticated user id changes in the same document, remove the previous user's jobs queries. Do not persist the query cache. Do not write the access token to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.

While the dashboard's first list request is pending and the dashboard has no successful list data yet, show `Loading jobs…` on `data-testid="jobs-loading"`. Do not show the empty state during that wait. A later refetch keeps the current rows visible.

Show the empty state only after a successful response whose `jobs` array is empty. The text is exactly `No jobs yet.` on `data-testid="jobs-empty"`. Hide it as soon as the list has a row.

A failed list shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show the empty state. A payload that does not match `jobSchema` shows `Request failed` and does not render partial rows. A failure of a later request leaves the previous list in place.

Render rows from the refetched array, in the API order: `createdAt` ascending, then `id` ascending. Do not sort again in the client. Each row is `data-testid="job-row"`. Inside the row:

| Element | `data-testid` | Text |
| --- | --- | --- |
| Company | `job-company` | `companyName` |
| Title | `job-title` | `jobTitle` |
| Location | `job-location` | `jobLocation` |
| Description | `job-description` | `jobDescription` |
| URL | `job-url` | `jobUrl`, and only when `jobUrl` is not null |

The row also shows five status lines. The label is ordinary text. The value is the element below, and its text is exactly `Not available`. That is the display for the only status object `jobStatusSchema` accepts: `analysisCurrent`, `tailoredResumePresent`, and `interviewPlanPresent` are `false`, and `latestOverallScore` and `readinessBadge` are `null`. Read those fields from the parsed job. Do not add labels for a current analysis, a present resume, a present plan, a numeric score, or `Interview Ready`.

| Label | Value `data-testid` |
| --- | --- |
| Analysis | `job-analysis` |
| Tailored resume | `job-tailored-resume` |
| Interview plan | `job-interview-plan` |
| Score | `job-score` |
| Readiness | `job-readiness` |

Do not show `userId`, `createdAt`, `updatedAt`, a password, a password hash, a refresh token, or an access token.

### Create, edit, and delete

Create and edit are forms on the dashboard view. Delete is a button on the job row. There is no separate delete page and no confirmation dialog.

| Action | Request | After success |
| --- | --- | --- |
| Create | `POST /jobs` | Reset the create form and refetch `GET /jobs` |
| Edit | `PATCH /jobs/:id` | Close the edit form and refetch `GET /jobs` |
| Delete | `DELETE /jobs/:id` | Refetch `GET /jobs`. Success is `204` |

React Hook Form may hold Job URL as an empty string because it is a browser input. Do not send that raw empty string to the API. On create, normalize a blank Job URL by omitting `jobUrl`. On edit, normalize a blank Job URL to `jobUrl: null`. After that normalization, validate the API-shaped object with the existing `createJobBodySchema` or `updateJobBodySchema` from `@jobpilot/shared`. Map that schema's validation errors back into the form. If parsing fails, send no request. Do not introduce a frontend copy of the job schema or the URL rule.

The create form stays available after a job exists. Opening edit shows one edit form for that row. `Cancel` closes it and sends no request. Edit submits all five fields currently in the form, after the Job URL normalization above.

`jobDescription` is a textarea. Trim of submitted strings is the shared schema's trim. Do not send `id`, `userId`, `status`, `createdAt`, or `updatedAt`.

A failed mutation shows the API `error` string on the dashboard and leaves the previous list in place.

Buttons and form names, matched exactly:

- Create form: `Add job`. The submit button uses that same name.
- Edit form: `Edit job`. The control that opens edit uses that name. Save uses `Save job`. Cancel uses `Cancel`.
- Delete uses `Delete job`.

Field labels inside a form: `Company name`, `Job title`, `Job description`, `Job location`, and `Job URL`. Job URL helper text is `Leave blank if there is no URL.`

## Affected subsystems

- Jobs
- Dashboard
- `apps/web`

`apps/api`, `packages/database`, and `packages/shared` stay as Phase 8 left them. Phase 8 already allows credentialed `GET`, `POST`, `PATCH`, and `DELETE` from `WEB_ORIGIN` with `Content-Type` and `Authorization`. If a browser on `http://localhost:5173` cannot call the existing job routes on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change job status codes, response bodies, or validation.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 9:

- Job analysis, a `JobAnalysis` table, LangGraph, Gemini calls, and showing analysis as current. Phase 10. Create and update keep using the Phase 8 endpoints, which store the job and leave analysis not current.
- Replacing `Not available` with a current, present, numeric, or `Interview Ready` label. Phase 10 owns the first of those changes. Later phases own resume, plan, score, and badge labels.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embeddings, vector indexes, and vector queries. Phase 12.
- Tailored resume JSON and its UI. Phases 13 and 14.
- Interview plans, question generation, answer evaluation, retakes, and awarding the readiness badge. Phases 15 through 18.
- A routing library, a `/dashboard` path, a `/jobs` path, and restoring the dashboard view after reload.
- A separate `GET /dashboard` resource, pagination, search, filters, and sorting controls.
- A delete confirmation dialog, bulk edit, import, and export.
- Account settings, email verification, password reset, OAuth, MFA, account deletion, and rate limiting.
- A client refresh that runs when a job request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or auth response bodies.
- Changing the Phase 5 profile schemas, tables, or HTTP contract, or the Phase 6 and Phase 7 profile UI behavior.
- Changing the Phase 8 job schemas, tables, or HTTP contract.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phases 4, 6, and 8.

Phase 4 provides the signed-in page, the in-memory access token, `POST /auth/refresh` on load, and logout. Phase 6 provides the profile sections, TanStack Query, and logout that drops cached profile queries. Phase 7 adds the Resumes section on that same profile view. Phase 8 provides `POST /jobs`, `GET /jobs`, `PATCH /jobs/:id`, `DELETE /jobs/:id`, and the shared job schemas.

Job requests send `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` (`http://localhost:3000` locally) with `credentials: "include"`. They do not go through the Vite `/health` proxy.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 9, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Signed-in shell

- Keep Phase 4 register, login, refresh, logout, and the `loading` / `signed-out` / `signed-in` states.
- Keep the profile and resume sections unchanged on the profile view. Do not put a heading in the switcher.
- Default to the profile view whenever `signed-in` is entered, including after reload.
- Mount the jobs list only while the dashboard view is mounted.
- Logout still clears the in-memory token and returns to the signed-out page, which has no switcher, profile sections, or dashboard. That transition also removes cached jobs queries.

### Forms and requests

- Use React Hook Form, Zod, and shadcn/ui. The textarea component already exists. Do not add a component library or another dependency.
- An empty company name produces a form message and no `POST /jobs`. A Job URL that is not blank and is not an absolute `http` or `https` URL does the same, using `createJobBodySchema` after the empty-string normalization. Map that schema error back into the form.
- Parse list and mutation payloads with `jobSchema` before rendering.
- Do not log access tokens, refresh tokens, passwords, or `JWT_SECRET`.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY` in its source, environment, or bundle.
- Do not import `@jobpilot/ai`. Do not call Gemini.

### Tests and runtime

- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the jobs browser tests to root `pnpm test` or to GitHub Actions.
- The new Playwright coverage assumes Compose is already running. It registers a unique `phase9-` email, logs in, and waits until `signed-in`. The profile view is showing. It adds one skill named `TypeScript` through the existing Add skill form.
- It opens `Dashboard`, waits until the jobs list succeeds, and sees `No jobs yet.`.
- It creates one job: company `Example Co`, title `Engineer`, description `Build APIs.`, location `Remote`, URL `https://example.com/jobs/engineer`. The dashboard row shows those values and five `Not available` status values.
- It reloads. The session is signed in on the profile view. It opens `Dashboard` again and sees the same company, title, and five `Not available` values.
- It edits the title to `Senior Engineer`, saves, and sees `Senior Engineer` on the dashboard. Company remains `Example Co`.
- It edits that job's Job URL to blank, saves, and after the refetch the row no longer renders `job-url`. The title remains `Senior Engineer`. The request body sends `jobUrl: null`, not an empty string.
- It deletes the job and sees `No jobs yet.`.
- One case holds the first `GET /jobs` after `Dashboard` is opened. The dashboard shows `Loading jobs…` and does not show `No jobs yet.` until that response resolves to an empty array.
- One case stubs `GET /jobs` to `400` with `{ "error": "Invalid input" }`. The dashboard shows `Invalid input` and does not show `No jobs yet.`.
- One case submits an empty company name, sees a form message, and records no `POST /jobs`.
- One case submits `Job URL` `not-a-url`, sees a form message, and records no `POST /jobs`.
- One case stubs `POST /jobs` to `400` with `{ "error": "Invalid input" }` and shows that string.
- One case, in the same document and without a reload, creates a job as user A, logs out, and logs in as user B. User B opens `Dashboard` and does not see user A's company. User B's empty state appears only after user B's jobs list returns an empty array.
- The test deletes the users it created through Prisma, using `DATABASE_URL`. Cascade removes the skill and job rows. It does not add a delete-user route.
- The Phase 4, Phase 6, and Phase 7 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth`, `test:profile`, `test:resumes`, and `test:jobs` still pass. `pnpm test` and `pnpm typecheck` still pass.
- Do not add a migration. Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce a dashboard service, a status-calculator interface, or a model client for a later phase.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
