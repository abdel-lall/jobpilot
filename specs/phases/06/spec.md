# Phase 6 — Candidate profile UI

## Objective

Let the signed-in user maintain the structured profile in the browser.

## Scope

This phase adds only the candidate profile UI described in the Phase 6 section of `specs/roadmap.md`:

- One signed-in page with a section for each profile type: skills, education, work experience, projects, and certifications.
- Each section lists the owner's records, shows a loading state while its first list request is pending, shows an empty state only after a successful empty list, and lets the owner add, edit, and delete a record.
- Forms use React Hook Form, Zod schemas from `packages/shared`, and shadcn/ui.
- Lists load and refresh through TanStack Query. The query cache stays in memory. Entering `signed-out` removes cached profile queries.
- Playwright covers the empty state, then create, edit, reload, and delete for one record of each type.

The browser uses the Phase 5 HTTP contract. It does not add routes, tables, or response fields.

| Section | List | Create | Update | Delete |
| --- | --- | --- | --- | --- |
| Skills | `GET /profile/skills` → `{ "skills": Skill[] }` | `POST /profile/skills` | `PATCH /profile/skills/:id` | `DELETE /profile/skills/:id` |
| Education | `GET /profile/education` → `{ "education": Education[] }` | `POST /profile/education` | `PATCH /profile/education/:id` | `DELETE /profile/education/:id` |
| Work experience | `GET /profile/experience` → `{ "experience": WorkExperience[] }` | `POST /profile/experience` | `PATCH /profile/experience/:id` | `DELETE /profile/experience/:id` |
| Projects | `GET /profile/projects` → `{ "projects": Project[] }` | `POST /profile/projects` | `PATCH /profile/projects/:id` | `DELETE /profile/projects/:id` |
| Certifications | `GET /profile/certifications` → `{ "certifications": Certification[] }` | `POST /profile/certifications` | `PATCH /profile/certifications/:id` | `DELETE /profile/certifications/:id` |

Create and update bodies are the Phase 5 shared schemas. A successful create or update is followed by a refetch of that section's list. A successful delete is `204` and is also followed by a refetch. The UI displays the refetched list in the API order: `createdAt` ascending, then `id` ascending.

Public record JSON stays as Phase 5 defined it. Dates are `YYYY-MM-DD`. The UI shows the API `error` string when a profile request fails. It does not show `userId`, a password, a password hash, a refresh token, or an access token.

## Affected subsystems

- Candidate profile
- `apps/web`

`apps/api`, `packages/database`, and `packages/shared` stay as Phase 5 left them. Phase 5 already allows credentialed `GET`, `POST`, `PATCH`, and `DELETE` from `WEB_ORIGIN` with `Content-Type` and `Authorization`. If a browser on `http://localhost:5173` cannot call those profile routes on `http://localhost:3000`, the allowed API fix is limited to those existing CORS headers. Do not change profile status codes, response bodies, or validation.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 6:

- Resume file upload, download, delete, local disk storage, and resume-file metadata. Phase 7.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, Gemini calls, embeddings, or a model client. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and vector queries. Phase 12.
- A routing library, a separate URL per section, pagination, sorting controls, search, and drag-and-drop reordering.
- A delete confirmation dialog, bulk edit, import, and export.
- Account settings, email verification, password reset, OAuth, MFA, account deletion, and rate limiting.
- A client refresh that runs when a profile request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or auth response bodies.
- Changing the Phase 5 profile schemas, tables, or HTTP contract.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phases 4 and 5.

Phase 4 provides the signed-in page, the in-memory access token, `POST /auth/refresh` on load, and logout. The signed-in view keeps `data-testid="signed-in"`, `data-testid="user-email"`, and the `Log out` button. Profile sections render as soon as authentication is `signed-in`. They do not delay that state, and they do not render during `loading` or `signed-out`. Each section then loads independently.

Phase 5 provides the profile routes and the shared create, update, and record schemas. Profile requests send `Authorization: Bearer <accessToken>` to `VITE_API_ORIGIN` (`http://localhost:3000` locally) with `credentials: "include"`. They do not go through the Vite `/health` proxy.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 6, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Signed-in profile page

- Keep the Phase 4 account summary: the `/auth/me` email and logout. Add the five profile sections on that same signed-in page, in this order: Skills, Education, Work experience, Projects, Certifications.
- Do not add a routing library. Section headings are the navigation.
- Give each section `data-testid` `profile-skills`, `profile-education`, `profile-experience`, `profile-projects`, or `profile-certifications`.
- Each section has its own TanStack Query list. The five queries are independent. One section loading or failing does not block, hide, or change the other sections.
- The query key is the profile path and the `/auth/me` user id. The key does not include the access token. A different user id does not match the previous user's cache entries, so those entries are not reused.
- The query function reads the current in-memory access token. The session context may expose that token to signed-in children. Do not write it to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache. Do not persist the query cache.
- When the session transitions to `signed-out`, remove the cached profile queries from the in-memory TanStack Query client. When the authenticated user id changes in the same document, remove the previous user's profile queries. Phase 4 register, login, refresh, logout, and the `loading` / `signed-out` / `signed-in` states stay as they are.
- Disable a list query when the access token is missing.
- While a section's first list request is pending and that section has no successful list data yet, show a section loading state and do not show that section's empty-state text. Loading text is exactly `Loading skills…`, `Loading education…`, `Loading work experience…`, `Loading projects…`, or `Loading certifications…`, on an element whose `data-testid` is `profile-skills-loading`, `profile-education-loading`, `profile-experience-loading`, `profile-projects-loading`, or `profile-certifications-loading`. A later refetch keeps the current rows visible.
- Show the empty state only after a successful response whose array is empty, and hide it as soon as the list has a row. Empty-state text is exactly: `No skills yet.`, `No education yet.`, `No work experience yet.`, `No projects yet.`, and `No certifications yet.` Put that text in an element whose `data-testid` is `profile-skills-empty`, `profile-education-empty`, `profile-experience-empty`, `profile-projects-empty`, or `profile-certifications-empty`.
- A failed list shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show that section's empty state. A failure of a later request leaves the previous list in place.
- Render list rows from the refetched array. Show the editable fields. A null end date, and a null `expiresOn`, display as `Present`. A null project `startDate` or `url` is omitted. Do not show `userId` or the access token.
- The create form stays available after a record exists. Opening edit shows one edit form for that row in that section. `Cancel` closes the edit form and sends no request.

### Forms and lists

- Use React Hook Form, Zod, and shadcn/ui. Add only the shadcn components this phase needs. A textarea for multi-line lists is one of them. Do not add a component library beyond the existing shadcn set.
- Validate creates with `createSkillBodySchema`, `createEducationBodySchema`, `createWorkExperienceBodySchema`, `createProjectBodySchema`, and `createCertificationBodySchema` from `@jobpilot/shared`. Validate edits with the matching `update*BodySchema`. Do not duplicate those schemas.
- Accomplishments and technologies are textareas. One trimmed non-empty line is one array item, in the order typed. Blank lines are dropped before validation. The experience accomplishments textarea must yield at least one item. Project accomplishments and both technology lists may be empty.
- Calendar fields use `input type="date"`. Blank optional dates are omitted on create. On edit, a blank nullable date is sent as `null` so an existing value can be cleared. A blank project URL is omitted on create and sent as `null` on edit.
- Edit submits every editable field currently in the form. Accomplishments and technologies are the full textarea, replacing the stored arrays.
- Reject invalid input in the form before the request. An empty skill name produces a form message and no `POST`. An end date before the start date does the same, using the shared schema.
- After a successful create, reset the create form and refetch the list. After a successful edit, close the edit form and refetch. After a successful delete, refetch. Delete sends `DELETE` immediately. There is no confirmation dialog.
- A failed profile mutation shows the API `error` string in that section and leaves the previous list in place.
- Buttons and form names, matched exactly:
  - Create forms: `Add skill`, `Add education`, `Add experience`, `Add project`, `Add certification`.
  - Submit buttons use those same names.
  - Edit forms: `Edit skill`, `Edit education`, `Edit experience`, `Edit project`, `Edit certification`.
  - The control that opens edit uses the edit form name. Save uses `Save skill`, `Save education`, `Save experience`, `Save project`, or `Save certification`. Cancel uses `Cancel`.
  - Delete uses `Delete skill`, `Delete education`, `Delete experience`, `Delete project`, or `Delete certification`.
- Field labels inside a form: `Name`, `Institution`, `Degree`, `Field of study`, `Employer`, `Job title`, `Start date`, `End date`, `Accomplishments`, `Technologies`, `Description`, `URL`, `Issuer`, `Issued on`, and `Expires on`. End date helper text is `Leave blank if ongoing.` Expires-on helper text is `Leave blank if it does not expire.`

### Session and requests

- Profile fetches go to `VITE_API_ORIGIN` with `credentials: "include"` and the bearer token. Extend the existing web request helper so profile calls can use `GET`, `POST`, `PATCH`, and `DELETE`. `DELETE` has no body.
- Parse list payloads with the shared record schemas before rendering. A payload that does not match shows `Request failed` and does not render partial rows.
- Do not send `id`, `userId`, `createdAt`, or `updatedAt` in a body.
- Do not log access tokens, refresh tokens, passwords, or `JWT_SECRET`.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY` in its source, environment, or bundle.
- Keep the Phase 4 auth behavior. Logout still clears the in-memory token and returns to the signed-out page, which has no profile sections. That transition also removes cached profile queries.

### Tests and runtime

- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the profile browser tests to root `pnpm test` or to GitHub Actions.
- The new Playwright coverage assumes Compose is already running. It registers a unique `phase6-` email, logs in, and waits until `signed-in`.
- One case holds all five initial list GETs. The signed-in page and all five sections are visible, each section shows its loading state, and none of the empty-state texts are visible. It then lets four lists return an empty array while one stays pending. Those four show their empty states. The pending section stays on its loading state and still does not show its empty-state text. Releasing that last request with an empty array then shows its empty state.
- One case lets four initial list GETs return an empty array and stubs one list GET to `400` with `{ "error": "Invalid input" }`. That section shows `Invalid input` and does not show its empty state. The other four still show their empty states.
- It then, for each of the five types: sees the empty state, creates one record, edits it, and after all five edits reloads the page and sees the edited values. It deletes each record and sees that section's empty state again.
- One case, in the same document and without a reload, creates a skill as user A, logs out, and logs in as user B. User B does not see user A's skill. User B's skills empty state appears only after user B's skills list returns an empty array.
- Use these values. Dates are `YYYY-MM-DD`.

| Type | Create | Edit |
| --- | --- | --- |
| Skill | Name `TypeScript` | Name `Go` |
| Education | Institution `State University`, degree `B.S.`, field of study `Computer Science`, start `2016-09-01`, end `2020-05-15` | Institution `City College` |
| Experience | Employer `Example Co`, job title `Engineer`, start `2021-01-04`, end blank, accomplishment `Shipped the billing service`, technology `TypeScript` | Job title `Senior Engineer` |
| Project | Name `JobPilot`, description `A job application assistant.`, URL `https://example.com/jobpilot`, start `2024-02-01`, end blank, no accomplishments, technology `React` | Name `JobPilot API` |
| Certification | Name `AWS Cloud Practitioner`, issuer `Amazon Web Services`, issued on `2023-06-01`, expires on blank | Name `AWS Solutions Architect` |

- The reloaded page shows `Go`, `City College`, `Senior Engineer`, `Present` for the blank experience end date, `JobPilot API`, and `AWS Solutions Architect`.
- A separate case submits an empty skill name, sees a form message, and records no `POST /profile/skills`.
- A separate case stubs `POST /profile/skills` to `400` with `{ "error": "Invalid input" }` and shows that string.
- The test deletes the user it created through Prisma, using `DATABASE_URL`. Cascade removes the profile rows. It does not add a delete-user route.
- The Phase 4 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth` and `pnpm --filter @jobpilot/api test:profile` still pass. `pnpm test` and `pnpm typecheck` still pass.
- Do not add a migration. Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless this phase directly requires them.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
