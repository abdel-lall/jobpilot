# UI improvement 04 — Dashboard workspace

## Goal

Redesign the signed-in Dashboard into a two-area workspace under the existing page heading `Dashboard`.

The right side is a persistent jobs menu. The left side is one large active work area that shows a single selected activity. Selecting a job action, Add job, or Edit replaces that activity. Resume, plan, and interview content stay out of the jobs menu.

This is a UI-improvement spec. It does not change Phases 1–18, and it does not change UI improvements 01, 02, or 03.

## Current Dashboard this improvement changes

`SignedInPage` in `apps/web/src/pages/AuthPage.tsx` already provides the shell from UI improvements 02 and 03:

- White header, about 70px, with the JobPilot logo and a logout icon named `Log out`.
- `#3F5F9A` sidebar at 1024px and above, or a compact `#3F5F9A` nav bar under the header below 1024px.
- `#F4F5F7` main region (`--jp-canvas`). The signed-in root is the viewport height. Header and navigation stay fixed. `main` is the only page scroll container (`overflow-y-auto`, `min-h-0`).
- Page padding of 20px (`p-5`) inside `main`.
- An `h1` reading `Dashboard` when that view is selected: about 24px, semibold, `#172033` (`--jp-ink`), with about 20px between the heading and the content under it. Exactly one visible heading named `Dashboard`.

The Dashboard body is then wrapped in `mx-auto w-full max-w-3xl`. That cap is the current measure for jobs only. Profile does not use it.

`Dashboard` in `apps/web/src/jobs/dashboard.tsx` renders one `section` with `data-testid="dashboard"`. Inside a single card it always mounts, top to bottom:

1. `jobs-loading` (`Loading jobs…`) while the jobs query has no data and is fetching.
2. A list error as `role="alert"` when `GET /jobs` fails. The empty line stays hidden.
3. `jobs-empty` (`No jobs yet.`) when the list has loaded and is empty.
4. One `job-row` per saved job, when the list is non-empty.
5. A mutation `role="alert"` for create, update, and delete failures (`requestError`).
6. The create-job form, always mounted. Its accessible name is `Add job`. Its submit button is also `Add job`.

There is no separate Add control. Opening Dashboard with no chosen activity still shows the empty create form. There is no confirmation dialog on delete.

Each `job-row` always shows:

| Test id | Content |
| --- | --- |
| `job-company` | `companyName` |
| `job-title` | `jobTitle` |
| `job-location` | `jobLocation` |
| `job-description` | the full `jobDescription` |
| `job-url` | `jobUrl`, only when it is not null |
| `job-analysis` | `Current` when `status.analysisCurrent` is true, otherwise `Not available` |
| `job-tailored-resume` | `Present` or `Not available` from `status.tailoredResumePresent` |
| `job-interview-plan` | `Present` or `Not available` from `status.interviewPlanPresent` |
| `job-score` | `status.latestOverallScore` as a decimal string, or `Not available` when null |
| `job-readiness` | `Interview Ready` when `status.readinessBadge` is that value, otherwise `Not available` |

The row then mounts at most one of three panels, because `openPanel` is a single `{ jobId, kind }` value. The other rows stay collapsed to buttons:

| Kind | Closed control | Test id | Open panel |
| --- | --- | --- | --- |
| Resume | button `Tailored resume` | `open-tailored-resume` | `TailoredResumePanel` |
| Plan | button `Interview plan` | `open-interview-plan` | `InterviewPlanPanel` |
| Attempt | button `Interview attempt` | `open-interview-attempt` | `InterviewAttemptPanel` |

Opening a panel unmounts that row’s opener (`toHaveCount(0)` in current tests) and unmounts any other open panel. Edit is independent: `editingId` can point at a job while a panel is open on that job or another job. The edit control is a text button named `Edit job`. Delete is a text button named `Delete job`.

The create and edit forms share one field set from `apps/web/src/jobs/forms.ts`:

| Label | Notes |
| --- | --- |
| Company name | required |
| Job title | required |
| Job description | required |
| Job location | required |
| Job URL | help text `Leave blank if there is no URL.` |

Create uses `jobCreateResolver` / `createJobBodySchema`. A blank URL is omitted from the `POST` body. Edit uses `jobEditResolver` / `updateJobBodySchema`. A blank URL is sent as `null`. Field errors stay in the form (`data-slot="form-message"`). The edit form’s submit button is `Save job`. It has `Cancel`. The create form has no Cancel.

Requests, from `apps/web/src/jobs/requests.ts`:

| Action | Call | Success |
| --- | --- | --- |
| List | `GET /jobs` | `{ jobs: Job[] }` |
| Create | `POST /jobs` | status 201, then `refetchQueries` on `["jobs", userId]` |
| Update | `PATCH /jobs/:id` | status 200, then the same jobs refetch |
| Delete | `DELETE /jobs/:id` | status 204, then the same jobs refetch |

`jobsQueryKey(userId)` is `["jobs", userId]`. The query is enabled only when an access token is present, with `retry: false` and `refetchOnWindowFocus: false`. Create resets the form and leaves it mounted. A failed create or update leaves the form open and sets the dashboard alert. Delete has no confirmation. If the deleted job is the one being edited, edit closes after the delete succeeds. If that job’s panel is open, the panel closes after the delete succeeds. A thrown delete leaves the edit form and panel as they were.

A successful edit also refetches the open panel query when that panel belongs to the saved job (`tailoredResumeQueryKey`, `interviewPlanQueryKey`, or `interviewAttemptQueryKey`). Changing `jobDescription` is what makes the server drop the stored tailored resume and interview plan and recompute analysis. The client does not call a separate analysis route.

`Job.analysis` is already on each list item. It is `null` or an object of string arrays: `requiredSkills`, `preferredSkills`, `responsibilities`, `experienceRequirements`, `technologies`, `interviewTopics`, `keywords`. The current row does not render those arrays. It only renders the `Current` / `Not available` status.

Panel behavior that must keep working, from the existing panel components:

- Tailored resume (`tailored-resume-panel`): heading `Tailored resume`, `close-tailored-resume`, `tailored-resume-loading` (`Loading resume…`), `tailored-resume-empty` (`No tailored resume yet.`), `generate-tailored-resume` (`Generate resume`), and the document test ids `resume-skill`, `resume-experience`, `resume-project`, `resume-education`, `resume-certification`. Visible text does not include `sourceId`. Generate is shown when the query has succeeded with either null or a resume. Success writes the query cache and refetches jobs. Query key: `["tailored-resume", userId, jobId]`.
- Interview plan (`interview-plan-panel`): heading `Interview plan`, `close-interview-plan`, `interview-plan-loading` (`Loading plan…`), `interview-plan-empty` (`No interview plan yet.`), `generate-interview-plan` (`Generate plan`), `plan-category`, `plan-topic`. Same generate/cache/jobs-refetch pattern. Query key: `["interview-plan", userId, jobId]`.
- Interview attempt (`interview-attempt-panel`): heading `Interview attempt`, `close-interview-attempt`, `interview-attempt-loading` (`Loading attempt…`), `interview-attempt-empty` (`No interview attempt yet.`), `start-interview-attempt` (`Start attempt`). The start button is rendered when there is no attempt or when `attempt.status === "completed"`. It is absent while an attempt is `in_progress`. There is no control named `Continue attempt`. An in-progress attempt is the question list itself. Each question uses `interview-question`, `interview-question-text`, `interview-question-category`, `interview-question-concept`, `interview-question-rubric`, and, until it has a score, `interview-question-answer-input` plus `interview-question-submit` (`Submit answer`) at the bottom of that question. After a score, the question shows `interview-question-answer`, `interview-question-feedback`, and `interview-question-score`, and hides the input and submit button. Completing the attempt refetches jobs, which is what updates `job-score` and `job-readiness`. Starting a retake does not clear the previous score. Query key: `["interview-attempt", userId, jobId]`. Start and submit update that cache directly. The attempt is whatever the current API returns, including its question count. Tests require 8 questions for the stubbed plan.

`JobsQueryCache` removes jobs, tailored-resume, interview-plan, and interview-attempt queries on sign-out, and removes the previous user’s copies when the user id changes. Profile remains the selected view after sign-in and reload. Dashboard is still an in-memory view with no URL.

Keep the shell hooks: `signed-in`, `app-nav`, `nav-dashboard`, `nav-profile`, and `Log out`.

## Workspace layout

Remove the `max-w-3xl` wrapper from the Dashboard view only. The workspace uses the full width of the padded main region. Leave Profile’s layout, cards, and column rules as UI improvement 03 defined them.

Keep the existing `h1` `Dashboard` and the existing 20px page padding. That padding is the inset from the main region’s edges, the space under the top of `main`, the space under the heading, and the space under the workspace. Do not add a second 20px inset inside it.

Below the heading, render one horizontal workspace, `data-testid="dashboard-workspace"`, inside `data-testid="dashboard"`:

```text
[ active work area                         ] [ jobs menu ]
```

About 20px separates the two areas. Both columns use `min-width: 0` so long text cannot force a horizontal scrollbar.

Desktop, 1024px and above, the same breakpoint as the shell:

- Active work area on the left. It takes the remaining width.
- Jobs menu on the right. Its share of the workspace is greater than 25% and less than 33%, with a target of about 29% (`71fr` / `29fr` with a 20px column gap meets that). Do not use a fixed pixel width that overflows a laptop-width main region.
- The jobs menu stays wide enough for two readable action labels and narrow enough that the active forms keep a usable line length.

Below 1024px, stack the areas in this order:

1. Jobs menu
2. Active work area

Keep about 20px between them and the existing page padding. The jobs menu becomes full width of the content column. Do not keep the 29% column. Do not add a drawer, a hamburger control, a route, or a navigation package.

## Jobs menu

The menu is one white card, `data-testid="jobs-menu"`, using the Profile card surface:

- white background
- about 8px corner radius
- about 20px internal padding
- the same soft shadow as Profile cards: blurred, low opacity, tinted with `#80A8FF` (`rgb(128 168 255 / 0.32)` at about 4px offset and 16px blur)
- a hairline neutral border may remain, matching Profile
- no heavy border and no strong glow

On desktop the card fills the visible remainder of the main region below the page heading and the 20px gaps, and it stays in view while `main` scrolls long active-work content. `Add job` stays at the top of the card and does not scroll away inside the card. The job-list region under that button, `data-testid="jobs-list"`, scrolls vertically when the cards overflow the menu. That inner scroll is the only extra scroller. It must remain keyboard reachable: the job controls inside it are in tab order, and focus is not trapped.

The active work area does not get its own scroll container. Long details, resumes, plans, and interviews extend `main`, which remains the page scroll container from UI improvement 03. Header and sidebar still do not scroll. Do not put a second scrollbar on `body`.

On narrow screens the menu comes first and sizes with its content. Bound the job-list height so a long list scrolls inside the menu and the active work area below can be reached. The menu does not cover the active area.

### Add job control

At the top of the menu, a button labeled `Add job`, `data-testid="open-add-job"`.

Clicking it selects the Add Job activity. It does not mount the form inside the menu. The existing create form renders in the active work area.

The menu button stays visible while the form is open. Before the form is mounted it is the only control named `Add job`. After the form is mounted, the form’s accessible name and its submit button are also `Add job`. Tests that submit must use the form (`getByRole("form", { name: "Add job" })`) and the button inside it. Tests that open the activity use `open-add-job`.

The menu button uses the Profile Add fill `#D3D3FF` with text `#172033`, full width of the menu’s content box, and the `#6288DA` focus outline used on white surfaces.

### Empty, loading, and list errors

These stay in the menu, inside `data-testid="dashboard"`:

| State | Hook | Copy | When |
| --- | --- | --- | --- |
| Loading | `jobs-loading` | `Loading jobs…` | no cached jobs and the list is fetching |
| Empty | `jobs-empty` | `No jobs yet.` | the list loaded and `jobs.length === 0` |
| List error | `role="alert"` | the existing `requestErrorMessage` | `GET /jobs` failed |

While loading, hide the empty line. On a list error, hide the empty line and render no job cards. The Add job button remains available in all three states. Do not show example jobs.

### Job cards

Render the jobs in the order returned by `GET /jobs`. Each saved job is one compact card, `data-testid="job-row"`, inside the menu card.

Nested cards are white or near-white, with enough padding that the title and the buttons do not touch the card edges. They may use a hairline or a near-white fill so they read as nested. They do not use a second `#80A8FF` drop shadow.

Identity, in this order:

- Company name, `data-testid="job-company"`, as the primary title: larger and bolder than the other text, color about `#172033`. It wraps.
- Job title, `data-testid="job-title"`, as secondary text under the company. It wraps.
- Location, `data-testid="job-location"`, under the title in smaller, quieter text when `jobLocation` is non-empty. Saved jobs require a location, so this line is present for every job the API returns today.

Do not render `job-description` or the full description in the menu card. Do not render the analysis arrays in the menu card.

The job whose activity is currently open may use a quiet selected outline so the selection is visible. That outline is not a heavy shadow.

### Edit and Delete

Place icon-only Edit, then Delete, in the top-right of each job card. Draw them as inline SVG. Reuse the existing pencil and trash markup (`EditIcon` and `DeleteIcon` in `apps/web/src/profile/record-actions.tsx`) if those components stay presentational. Do not change Profile’s callers, labels, or layout to do it. Do not add an icon package.

- Icon color `#6B7280` (`--jp-logout`) on white, about 4.8:1.
- The SVG is `aria-hidden`. The button carries the name.
- Accessible name `Edit job` on the pencil. Accessible name `Delete job` on the trash can.
- Visible hover (a light gray background, about `#F3F4F6`) and a visible keyboard focus outline (`#6288DA` on white).
- About 32px square, matching Profile’s icon buttons.
- The words Edit and Delete are not shown next to the icons.

These buttons stay on the card while that activity is open. They are not replaced by the form.

Edit selects that job and shows the existing edit form in the active work area. Delete keeps the current delete behavior, described below.

### Workflow buttons

Each job card has exactly four buttons, in this order, with these visible labels:

1. `Details`
2. `Resume`
3. `Plan`
4. `Interview`

Arrange them in a 2×2 grid under the identity text:

```text
[ Details ] [ Resume    ]
[ Plan    ] [ Interview ]
```

- Two buttons per row.
- Equal widths. The pair fills the content width of the card.
- The grid uses the same left and right inset as the company name. The buttons sit in the card padding; they do not touch the card’s outer edges and they do not use a negative margin.
- A visible gap separates the columns and the rows (about 8px).
- Labels stay on one line at the menu’s desktop width. `Interview` is the longest label and must fit.
- All four use the same treatment: `#D3D3FF` fill, `#172033` text, compact padding, `#6288DA` focus outline.
- The button for the activity that is open uses a selected fill `#CEB5FF` with the same dark text, and `aria-pressed="true"`. The other three stay on `#D3D3FF` with `aria-pressed="false"`.
- They are real buttons with visible text. Do not use the labels `Tailored resume`, `Interview plan`, `Interview attempt`, or `Start attempt` on these menu controls.

Keep these test ids on the menu buttons:

| Visible label | Test id |
| --- | --- |
| Details | `open-job-details` |
| Resume | `open-tailored-resume` |
| Plan | `open-interview-plan` |
| Interview | `open-interview-attempt` |

The buttons stay mounted while their activity is open. Opening an activity no longer removes the opener.

## Active work area

`data-testid="active-work"` shows one activity, or the neutral card when none is selected.

On first open, and whenever the user has not selected an activity, the area shows one neutral card. It uses the same Profile card surface as the other active cards: white, about 8px radius, about 20px padding, and the soft `#80A8FF` shadow. Inside it, muted gray text reads `Select a job action to get started.` The gray is the logout/edit/delete icon family, `#6B7280` (`--jp-logout`). The neutral card has no heading, does not repeat `Dashboard`, and is not an error or an alert. No create form, edit form, details card, or resume, plan, or attempt panel is mounted. Do not auto-select the first job. Do not mount every panel and hide it.

Selecting an activity unmounts the previous one. Only the selected activity is in the document.

Each activity is one white card with the Profile surface (white, about 8px radius, about 20px padding, the same `#80A8FF` shadow). Section headings use `#172033`.

| Activity | Card heading | Level |
| --- | --- | --- |
| Add Job | `Add job` | `h2` |
| Edit Job | `Edit job` | `h2` |
| Job Details | `Job details` | `h2` |
| Tailored resume | `Tailored resume` | `h2` |
| Interview plan | `Interview plan` | `h2` |
| Interview | `Interview attempt` | `h2` |

The three existing panels already render those last three strings as `h3`. Keep the visible words and the panel test ids. Use a single heading for each of those cards (the panel heading promoted to `h2` is enough). Do not show the same title twice. The page `h1` remains the only `Dashboard` heading.

Every selected activity card has one icon-only Close control in its top-right corner. Draw it as an inline SVG. Do not add an icon package. The icon color is about `#6B7280`. The SVG is `aria-hidden`. The button’s accessible name is exactly `Close`. It has a light gray hover, about `#F3F4F6`, and the `#6288DA` focus outline used on white surfaces. The word Close is not shown. Closing does not save or submit. It returns the active area to the neutral card.

Resume, Plan, and Interview keep their existing close behavior and test ids (`close-tailored-resume`, `close-interview-plan`, `close-interview-attempt`) on that one icon. Do not also render a text Close button.

Leaving Dashboard for Profile unmounts this state. Returning to Dashboard shows the neutral card again. Do not store the selection in the URL.

### Add Job

The card contains the existing create form:

- accessible name `Add job`
- the five fields and the URL help text above
- `jobCreateResolver`
- submit button `Add job`
- no Cancel control
- the card Close icon, which discards the form with no request and shows the neutral card
- root errors in `data-slot="form-message"`
- `POST /jobs` through `createJob`
- blank URL omitted from the body
- client validation before any request
- a failed request stays on the form and shows the dashboard `role="alert"` with the existing message

On success, reset the form, leave the Add Job activity selected so the empty form stays visible, and refetch `["jobs", userId]`. The new job appears in the menu from that refetch. Do not add a second create API.

Clicking `open-add-job` while the form is already open leaves that single form in place.

### Edit Job

The card contains the existing edit form for the selected job:

- accessible name `Edit job`
- the same five fields, prefilled with `jobFormValues`
- URL help text unchanged
- `jobEditResolver`
- submit `Save job`
- `Cancel`
- `PATCH /jobs/:id` through `updateJob`
- a blank URL sent as `null`
- client validation before any request
- a failed save stays on the form and shows the dashboard alert

`Cancel` closes the form with no request and returns the active area to the neutral card. The card Close icon does the same and does not send `PATCH`.

On success, close the edit form, return the active area to neutral, and refetch `["jobs", userId]`. The menu card shows the saved company, title, and location. Description, URL, analysis, and the status lines update on the next Details view.

Because Edit replaces Resume or Plan, those panels are not mounted during the save. Today, a description change refetches the open panel so a still-visible resume or plan drops its stale document. Keep that outcome: after a successful save, invalidate or refetch that job’s `["tailored-resume", userId, jobId]` and `["interview-plan", userId, jobId]` queries so the next time Resume or Plan is selected it loads the server document instead of a cleared cache entry. Do not add an endpoint. Title-only edits still go through the same `updateJob` call the form already makes. The server, not the client, decides whether analysis is recomputed and whether the resume and plan are deleted.

### Job Details

Clicking `Details` selects that job and mounts one card, `data-testid="job-details"`, in the active area. Its Close icon returns to the neutral card and does not fetch or change the job.

Show only data already on the `Job` object from `GET /jobs`. Do not add fields, routes, or a per-job fetch.

Show:

- company, title, and location
- `job-description` with the full `jobDescription`
- `job-url` with `jobUrl` when it is not null, and omit that node when it is null (clearing the URL still makes `job-url` count 0)
- the existing status lines, with the same test ids and the same copy as the current row:

| Prefix | Test id | Values |
| --- | --- | --- |
| Analysis | `job-analysis` | `Current` or `Not available` |
| Tailored resume | `job-tailored-resume` | `Present` or `Not available` |
| Interview plan | `job-interview-plan` | `Present` or `Not available` |
| Score | `job-score` | the score string or `Not available` |
| Readiness | `job-readiness` | `Interview Ready` or `Not available` |

These five test ids live on the Details card, not on the menu card. There is one of each while Details is open, and none while another activity is open.

When `job.analysis` is non-null, also show its seven arrays as readable sections, in this order, using these headings:

1. Required skills
2. Preferred skills
3. Responsibilities
4. Experience requirements
5. Technologies
6. Interview topics
7. Keywords

Render each string as text. An empty array shows `None`. When `job.analysis` is null, omit the seven sections and keep the Analysis status at `Not available`. Do not invent skills, keywords, or scores.

`job-description`, `job-url`, and the five status test ids are not duplicated onto the menu card.

### Resume

Clicking `Resume` selects that job and mounts the existing `TailoredResumePanel` inside the active card.

Preserve the panel’s fetch, empty, loading, error, generate, cache write, jobs refetch, document sections, and the rule that `sourceId` is not shown. The generate button stays `Generate resume` with `data-testid="generate-tailored-resume"`. The icon Close (`close-tailored-resume`) returns the active area to the neutral card. There is no text Close button.

The panel is not inside `job-row`. The menu’s Resume button stays visible.

### Plan

Clicking `Plan` selects that job and mounts the existing `InterviewPlanPanel` inside the active card.

Preserve fetch, empty (`No interview plan yet.`), loading, error, `Generate plan` (`generate-interview-plan`), categories, topics, cache write, and jobs refetch. The full plan is not rendered in the jobs menu. The icon Close (`close-interview-plan`) returns the active area to the neutral card. There is no text Close button.

Opening Plan unmounts Resume, Interview, Details, Add, and Edit. Opening Resume or Interview unmounts the plan panel. That mutual exclusion stays; it moves from “inside the row” to “only one activity in the active area.”

### Interview

Clicking `Interview` selects that job and mounts the existing `InterviewAttemptPanel` inside the active card. The menu label stays `Interview` for every job, including jobs with no attempt, an in-progress attempt, a completed attempt, or a retake available.

Do not add attempt states. The panel already chooses the view:

- No attempt: `No interview attempt yet.` and `Start attempt`.
- In progress: the question list. Unanswered questions have a textarea and `Submit answer`. Answered questions show the stored answer, feedback, and score. There is no `Continue attempt` button. Do not add one.
- Completed: stored answers, feedback, and scores, plus `Start attempt`, which is the existing retake.
- Readiness and the latest overall score are the job status fields on the Details card (`job-readiness`, `job-score`). They update when a completion refetches the jobs query. Starting a retake does not clear them. A later completion replaces them through the same refetch.

Preserve eight questions when the API returns eight, answer submission, scoring, feedback, completion, readiness, retakes, and the uniqueness behavior the current attempt flow already has. `Submit answer` stays at the bottom of that question’s block, under the answer field, inside the active card. Do not move it to the jobs menu. Do not add one submit button for every question.

The icon Close (`close-interview-attempt`) returns the active area to the neutral card. There is no text Close button. Draft text in an unmounted question may be discarded when the user switches activities. That already happens today when another panel replaces the attempt.

### Delete

`Delete job` still calls `deleteJob` (`DELETE /jobs/:id`, success 204) with no confirmation dialog.

After the delete succeeds:

- refetch `["jobs", userId]` so the card leaves the menu
- if the deleted job is the job shown in the active area (details, edit, resume, plan, or interview), clear the activity and show the neutral card before or as the job card disappears
- do not keep a resume, plan, interview, details card, or edit form for that id

Deleting a different job leaves the current activity in place. A failed delete leaves the activity in place and shows the dashboard alert.

### Mutation errors

Create, update, and delete failures still surface as one `role="alert"` inside `data-testid="dashboard"`, using `requestErrorMessage`. The alert is visible with the open form for create and update, and visible for a failed delete even when the active area is neutral. List-load failures keep their own alert. Empty copy stays hidden while a list error is showing.

## Responsive behavior

At 1024px and above: active area left, jobs menu right, menu about 29% of the workspace, menu height filling the visible workspace, job list scrolling inside the menu, active content scrolling with `main`.

Below 1024px: jobs menu, then active work area, about 20px apart, full content width, job list bounded and internally scrollable, every job action still reachable, no horizontal overflow.

Check about 375px and near 320px. Company names, titles, and the four labels wrap or fit inside the card. The page does not scroll sideways.

## Visual treatment

Main region stays `#F4F5F7`. Workspace cards and the jobs menu use the Profile card surface described above. Nested job cards stay flat. Edit and Delete stay `#6B7280`. The four workflow buttons and the menu `Add job` button share `#D3D3FF` / `#172033`, with `#CEB5FF` / `#172033` on the pressed workflow button. Focus on these white-surface controls uses `#6288DA`.

Do not restyle Profile, the signed-out screens, the header, or the sidebar.

## Preserve

Preserve:

- Authentication and session restoration, including `loading`, `signed-out`, and `signed-in`.
- Access token in memory only. Refresh cookie stays `HttpOnly`.
- Logout from UI improvement 02.
- Header, sidebar, compact nav, logo, colors, selected nav state, and fixed-shell scrolling from UI improvements 02 and 03.
- The page-level `h1` `Dashboard` or `Profile`, the 20px main padding, and Profile as the view after sign-in and reload.
- In-memory view switching. No router and no `/dashboard` URL.
- Profile page behavior and layout from UI improvement 03.
- Job list, create, update, and delete paths, methods, bodies, and status codes.
- Create and edit fields, Zod resolvers, URL omission on create, `null` URL on edit, and server-side analysis on write.
- Tailored resume and interview plan read/generate behavior, including grounding and hidden `sourceId`s.
- Interview attempt read, start, answer submission, eight-question attempts, scoring, feedback, completion, readiness badge, retake, and question uniqueness as the current API and panel implement them.
- React Query keys `["jobs", userId]`, `["tailored-resume", userId, jobId]`, `["interview-plan", userId, jobId]`, and `["interview-attempt", userId, jobId]`, and the cache-isolation rules in `JobsQueryCache`.
- The test ids listed in this spec, including the panel ids and the status ids that move onto Details.
- Signed-out Login / Sign up from UI improvement 01.

No backend changes. No database changes. No API contract changes. No new runtime dependency. No new icon package.

## Accessibility

- The page name is one `h1`, `Dashboard`.
- Each open activity has one heading, at `h2`, with the words in the activity table.
- Menu company and title are text in document order inside the job card, ahead of the workflow buttons.
- `Edit job` and `Delete job` name the icon buttons. The SVG is not the name.
- `Details`, `Resume`, `Plan`, and `Interview` are visible button names.
- `Add job` names the menu button. The create form and its submit button keep the accessible name `Add job`.
- The pressed workflow button exposes `aria-pressed`.
- Focus is visible on Add job, the four workflow buttons, Edit, Delete, Save job, Cancel, Generate resume, Generate plan, Start attempt, Submit answer, Close, and the shell controls.
- The scrolling job list is in the tab order through its buttons.
- Form labels stay associated with their inputs. Field errors stay in the form. Request failures stay in `role="alert"` inside `dashboard`.
- `#172033` on `#D3D3FF` and on `#CEB5FF` meets WCAG 2.2 AA. `#6B7280` icons on white are about 4.8:1.

## Tests

Update the web Playwright specs that drive Dashboard. Do not weaken create, edit, delete, validation, loading, empty, list errors, cache isolation, tailored resume, interview plan, attempt start, answer submission, scoring, readiness, or retake coverage.

Files that assume the old single column:

- `apps/web/e2e/jobs.spec.ts`
- `apps/web/e2e/tailored-resume.spec.ts`
- `apps/web/e2e/interview-plan.spec.ts`
- `apps/web/e2e/interview-attempt.spec.ts`
- `apps/web/e2e/interview-answer.spec.ts`
- `apps/web/e2e/interview-readiness.spec.ts`

The create form is not mounted until the user selects Add Job. Helpers that fill `Add job` immediately after `nav-dashboard` must click `open-add-job` first, then use the form named `Add job` and the submit button inside that form.

After a successful create, the empty Add Job form stays visible until another activity is selected. Company, title, and location are asserted on `job-row`. Description, URL, and `expectStatuses` (`job-analysis`, `job-tailored-resume`, `job-interview-plan`, `job-score`, `job-readiness`) require opening `Details` on that job (`open-job-details`) and reading `job-details`. Check the form-still-visible assertion before leaving Add Job, or re-select Add Job afterward. Do not drop the status, description, or URL assertions.

Edit still uses the button named `Edit job`, the form named `Edit job`, and `Save job`. The form is in the active area, not in the menu card. After save, the menu shows the new title and company. Description, a cleared URL, and statuses are read from Details. A description edit that clears a tailored resume or interview plan is proved by selecting Resume or Plan again and seeing the existing empty copy (`No tailored resume yet.` or `No interview plan yet.`) plus `Not available` on Details. Do not leave the stale document assertion out.

Delete still uses the button named `Delete job`. The empty copy and a `job-row` count of 0 still follow a successful delete. If a test deletes the job that is open in the active area, the panel, details card, and edit form for that job are gone.

Resume, Plan, and Interview are opened from the menu test ids `open-tailored-resume`, `open-interview-plan`, and `open-interview-attempt`. Those buttons stay in the row while the panel is open. Replace assertions that the opener’s count becomes 0. Keep the proof that the selected panel is mounted once, in the active area, and that the other panels are not mounted (`interview-plan-panel`, `tailored-resume-panel`, and `interview-attempt-panel` counts). Panel internals stay the same: generate buttons, empty copy, categories, topics, resume sections, eight questions, `Submit answer`, scores, and `Start attempt`.

`job-score` and `job-readiness` are on Details. The readiness spec currently reads them from the row while the attempt panel is still mounted, including during a retake that must keep `80` and `Interview Ready` until the new attempt finishes. Keep those text assertions. Open Details to read them, then select `Interview` again to continue the attempt. The jobs query still holds the previous score until completion refetches it. Do not delete the `80`, `Interview Ready`, `0`, or `Not available` checks, and do not delete the retake uniqueness check.

`jobs-empty`, `jobs-loading`, the dashboard alert, the single `Dashboard` heading, profile-vs-dashboard switching, and the second-user cache test stay. The second user still must not see the previous user’s company name. Add a check that the dashboard workspace does not scroll horizontally at the default Playwright desktop width.

Do not assert that every panel is present on first paint.

## Out of scope

- Routing, Dashboard URLs, drawers, and hamburger navigation.
- A new icon package or any new runtime dependency.
- Changes to UI improvements 01, 02, or 03, to phase specs, to API routes, to the database, or to token storage.
- Profile card layout, Profile copy, and Profile colors beyond reusing the existing presentational icons.
- New job fields, a job-details endpoint, a delete confirmation dialog, a `Continue attempt` control, or new attempt-status rules.
- Restyling signed-out Login / Sign up.

## Acceptance criteria

- Dashboard keeps one page-level `Dashboard` heading.
- The workspace keeps about 20px of spacing from the main region edges, under the heading, between the two areas, and under the workspace, using the existing main padding plus the new column gap.
- At 1024px and above, the active work area is on the left and the jobs menu is on the right.
- The jobs menu is wider than 25% and narrower than 33% of the workspace, about 29%.
- The jobs menu fills the visible workspace height on desktop.
- The job-list portion scrolls vertically. `Add job` stays at the top of the menu.
- No jobs shows `No jobs yet.` under that button, with no sample jobs.
- `Add job` opens the existing create form in the active area, and a successful create refetches the jobs list and shows the new job in the menu.
- Each menu card shows the company as the prominent title and the job title underneath, plus location when it is present.
- Edit and Delete are icon buttons at the card’s top-right, named `Edit job` and `Delete job`.
- Each card has `Details`, `Resume`, `Plan`, and `Interview` in a 2×2 grid of equal widths, inset with the card text and separated by gaps.
- `Details` opens that job’s stored company, title, location, URL, description, status lines, and analysis arrays in the active area.
- `Resume` opens the existing tailored-resume experience in the active area.
- `Plan` opens the existing interview-plan experience in the active area.
- `Interview` opens the existing interview experience in the active area, including start, in-progress questions, completion, readiness data, and retake.
- Edit opens the existing edit form in the active area.
- `Submit answer` stays at the bottom of the relevant question in the active card.
- With no activity selected, the active area shows the neutral card and the text `Select a job action to get started.`
- Add Job, Edit Job, Job Details, Tailored resume, Interview plan, and Interview each have one top-right Close icon named `Close`. Closing returns to that neutral card and does not save or submit.
- Active cards, the neutral card, and the jobs menu use the Profile card surface.
- Creating, editing, deleting, analysis, tailored resumes, plans, attempts, scoring, feedback, readiness, and retakes keep their current API and cache behavior.
- Below 1024px the areas stack, jobs menu first, with about 20px spacing and no horizontal overflow.
- Deleting the job that is open clears that activity and shows the neutral card.
- No backend, API, or database changes.

## Validation checklist

Check these after implementation. Do not mark an item passed unless it was actually exercised.

- [ ] At a desktop width of at least 1024px, the `h1` `Dashboard` appears once. Under it, the active area is on the left and the jobs menu is on the right. The menu’s width is about 29% of the workspace and is both greater than 25% and less than 33%. About 20px separates the areas. The page padding remains about 20px. The `max-w-3xl` cap is gone from Dashboard and Profile’s two-column layout is unchanged.
- [ ] The jobs menu card is white, about 8px radius, about 20px padding, with the soft `#80A8FF` shadow used on Profile cards. It fills the visible workspace height. `Add job` stays at the top while the job list scrolls inside the card. Scrolling a long interview moves `main` only. The header and the sidebar stay fixed. The document does not gain its own scrollbar.
- [ ] With no saved jobs, the menu shows `No jobs yet.` and `open-add-job`. The active area shows the neutral card, `Select a job action to get started.`, with no heading. The create form, edit form, details card, and all three panels are absent until selected.
- [ ] Clicking `Add job` shows the form named `Add job` in the active area with Company name, Job title, Job description, Job location, and Job URL. Submit creates the job with `POST /jobs`. The menu then shows that company and title. The empty form stays up. Invalid company or URL shows the form error and does not send `POST`. A failed create shows the dashboard alert and keeps the form and the empty copy.
- [ ] `Details` shows the description, the URL when present, `Current` / `Not available` analysis, tailored-resume and interview-plan presence, score, readiness, and, when `job.analysis` is present, the seven analysis lists. No `sourceId` appears. Clearing the URL removes `job-url`.
- [ ] Edit opens `Edit job` in the active area. `Save job` sends `PATCH`. Cancel sends nothing and returns to the neutral card. The card Close icon also sends nothing and returns to the neutral card. The menu title updates after a title save. A description save still refreshes jobs, and Resume and Plan next opened for that job show the cleared documents rather than a stale cache entry.
- [ ] Delete sends `DELETE` with no new confirmation dialog, removes the card, and restores `No jobs yet.` when it was the last job. Deleting the job that is open removes its details, form, or panel and shows the neutral card.
- [ ] `Resume` mounts `tailored-resume-panel` only, with the existing empty, loading, generate, and section behavior. `Plan` mounts `interview-plan-panel` only. `Interview` mounts `interview-attempt-panel` only. Menu buttons stay visible. Questions and `Submit answer` are not inside the menu card. Each activity card has one Close icon, named `Close`, and no text Close button. Resume, Plan, and Interview keep `close-tailored-resume`, `close-interview-plan`, and `close-interview-attempt`.
- [ ] An attempt still lists 8 questions when the API does, accepts an answer per question, shows feedback and score on that question, and hides `Submit answer` after the score. Completion updates score and readiness on Details. `Start attempt` on a completed attempt retakes. During that retake, Details still shows the previous score and `Interview Ready` until the new attempt completes. A failing retake then shows `0` and `Not available`.
- [ ] Loading still shows `Loading jobs…` and hides `No jobs yet.` A list error shows the alert, hides the empty copy, and renders no rows.
- [ ] A second user does not see the previous user’s jobs. Logout removes the dashboard. Reload still opens Profile.
- [ ] Below 1024px, and at about 375px and near 320px, the menu is above the active area, actions remain usable, and the page does not scroll horizontally. The same is true at the desktop Playwright width.
- [ ] Edit, Delete, the workflow buttons, Add job, and `Submit answer` show visible focus and meet the contrast pairs in this spec.
- [ ] `pnpm typecheck` passes.
- [ ] The Playwright flows for jobs, tailored resume, interview plan, interview attempt, interview answer, and interview readiness pass after they select an activity before reading its form or panel.
- [ ] The web bundle and `apps/web/src` still contain no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] No API, database, phase-spec, or UI-improvement 01/02/03 files change for this improvement.
