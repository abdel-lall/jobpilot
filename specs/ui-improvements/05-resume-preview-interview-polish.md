# UI improvement 05 — Resume preview and interview polish

## Goal

Improve two Dashboard active-work experiences:

1. Render a generated tailored resume as a professional resume document, with a freshness indicator and a client-side PDF download.
2. Refine the Interview card so each question is numbered and `Submit answer` is compact and right-aligned.

The Dashboard workspace from UI improvement 04 stays as it is: the same two areas, the same jobs menu, and the same activity selection. This spec changes the contents of the Resume activity and the Interview activity.

This is a UI-improvement spec. It does not change Phases 1–18, and it does not change UI improvements 01, 02, 03, or 04.

Do not start implementation until this spec has been reviewed and a human has approved the work.

## Current behavior this improvement changes

### Resume activity

`Resume` in the jobs menu still mounts `TailoredResumePanel` (`apps/web/src/jobs/tailored-resume-panel.tsx`) inside the active card from UI improvement 04. The card already uses `profileCardClass()`: white surface, about 8px radius, about 20px padding, and `shadow-[0_4px_16px_rgb(128_168_255/0.32)]`.

The panel today:

- Renders one icon Close, `close-tailored-resume`, accessible name `Close`, positioned absolute at the card’s top-right.
- Heading `Tailored resume` (`h2`).
- `tailored-resume-loading` (`Loading resume…`) while the query is pending and fetching.
- The query error text from `requestErrorMessage`.
- `tailored-resume-empty` (`No tailored resume yet.`) when `GET /jobs/:id/tailored-resume` returns 404 `{ "error": "Not found" }`, which the client maps to `null`.
- `generate-tailored-resume` (`Generate resume`) when the query has succeeded with either `null` or a resume. It posts `{}`. Success writes `["tailored-resume", userId, jobId]` and refetches `["jobs", userId]`.
- A generate error from `requestErrorMessage`. A failed generate does not replace a resume already in the query cache.
- When a resume exists, five sections in order: Skills, Experience, Projects, Education, Certifications. An empty array renders the heading plus the word `None`. Each item is one concatenated text node. `sourceId` is a React key only. Null fields are dropped by `visibleText`, so a null end date disappears instead of reading `Present`, and a null project URL or null `expiresOn` is already absent.
- Dates render as the stored `YYYY-MM-DD` strings.

The panel receives `userId`, `jobId`, `accessToken`, and `onClose`. It does not receive the job or the session email.

### Interview activity

`Interview` still mounts `InterviewAttemptPanel`. Each question is an `interview-question` item with text, category, concepts, and rubric. Until `score` is set, that item has `interview-question-answer-input` and `interview-question-submit` (`Submit answer`). After a score, those controls are gone and the item shows `interview-question-answer`, `interview-question-feedback`, and `interview-question-score`.

The questions sit in a CSS grid. A grid item stretches, so `Submit answer` currently spans the question width. There is no `Question N` heading.

`InterviewQuestion` already has `position` from 1 through 8, and `interviewAttemptSchema` requires `questions[index].position === index + 1`. The API returns questions ordered by `position`. This improvement does not read, write, or display that field as a new stored number. The visible number is the rendered array index plus one, which matches `position` because of that existing invariant.

### Identity data that already exists

Inspected `packages/database/prisma/schema.prisma`, `packages/shared/src/profile.ts`, `packages/shared/src/auth.ts`, and the signed-in session.

| Candidate fact | Stored today? | Where |
| --- | --- | --- |
| Name | No | No user, profile, or resume field |
| Email | Yes | `User.email`, `publicUserSchema.email`. `GET /auth/me` already returns `{ user: { id, email } }`. `SignedInPage` already holds `session.user` |
| Phone | No | — |
| Candidate location | No | `Job.jobLocation` is the job’s location, not the candidate’s |
| LinkedIn | No | — |
| Portfolio URL | No | Profile projects have a per-project `url`. That is not a candidate portfolio link |

Profile sections remain skills, education, work experience, projects, certifications, and uploaded resume files. Do not add profile or user columns for name, phone, location, LinkedIn, or portfolio.

`Dashboard` currently receives `user.id` and the access token only. Passing `user.email` from `SignedInPage` into `Dashboard` and then into `TailoredResumePanel` uses data already in memory. It does not add an API.

### Resume freshness flag that already exists

`Job.status.tailoredResumePresent` (`packages/shared/src/job.ts`) is the boolean the API derives from whether the tailored-resume row exists. It is not a timestamp and it is not a version.

- `false` on create, and after a `jobDescription` change deletes the stored tailored resume.
- `true` after a successful generate, once `["jobs", userId]` refetches.
- A title-only patch does not clear the resume. A failed analysis does not clear it. Those server rules stay.

Details still shows this flag as `Present` or `Not available` on `job-tailored-resume`. This improvement does not change that copy. The Resume card uses the same boolean with the new labels below.

There is no PDF-generation dependency. `apps/web`, `apps/api`, `packages/ai`, `packages/shared`, and the root `package.json` do not depend on `jspdf`, `pdf-lib`, `pdfmake`, `html2canvas`, `html2pdf`, or `puppeteer`. Phase 7 stores an uploaded resume file and can download those original bytes. That file is not the tailored resume and must not be reused as the PDF for this button.

## Scope

In scope:

- The Resume activity card’s header controls, document preview, empty state, and client-side PDF download.
- The Interview activity card’s question headings and `Submit answer` alignment.
- Passing the existing session email into the resume preview.
- Playwright updates that prove the new presentation without weakening current resume or interview behavior.

Out of scope:

- The workspace grid, jobs menu, menu card contents, and activity selection from UI improvement 04.
- Details, Plan, Add job, and Edit job, other than the rule that they do not gain a Back button.
- Profile layout and profile data entry.
- Phases 1–18, their specs, validation, and notes.
- UI improvement specs 01–04.
- Backend routes, database schema, grounding, React Query keys, and cache invalidation rules.
- A tailored-resume PDF endpoint.
- New profile fields, resume version numbers, or timestamps.

## Resume card

Selecting `Resume` still mounts one `tailored-resume-panel` in the active card for that job. The menu’s Resume button stays visible. Close still returns the active area to the neutral card and does not save or generate.

Keep the card treatment already applied by `activityCardClass`:

- white surface
- about 8px radius
- about 20px padding
- the same soft `#80A8FF` shadow as Profile cards
- one top-right control cluster
- no Back button

Do not add a second card around the panel. Do not change the jobs menu.

### Header controls

Replace the lone absolute Close with one top-right cluster inside the resume panel. Order, left to right:

1. Freshness indicator
2. Download PDF, only when a current resume document is on screen
3. Close

Close stays the existing `ActivityCloseButton`: test id `close-tailored-resume`, accessible name exactly `Close`, inline SVG with `aria-hidden="true"`, about `#6B7280`, hover about `#F3F4F6`, and the existing `#6288DA` focus outline. It is the rightmost control. There is still one Close on this card, and it is not a text button.

Separate the three controls by about 8px. Keep them clear of the `Tailored resume` heading. Increase the heading’s right padding if needed so the title does not run under the cluster. The cluster sits in the card padding; it does not overlap the document.

The heading stays an `h2` with the visible text `Tailored resume`.

## Resume freshness

Show a small indicator for the selected job. Its only source is `job.status.tailoredResumePresent` on the job already loaded by `GET /jobs`. Pass that boolean into the panel. Do not derive a second flag from timestamps, from `updatedAt`, or from a new field.

| `tailoredResumePresent` | Color | Visible text | Accessible name |
| --- | --- | --- | --- |
| `true` | dark green, about `#166534`, with a check mark | `Up to date` | `Resume up to date` |
| `false` | dark orange, about `#9A3412`, with a distinct non-check mark | `Needs regeneration` | `Resume needs regeneration` |

The indicator is not color-only. The mark is an inline SVG, `aria-hidden="true"`. The visible text is always shown, including when the cluster is narrow; it may wrap. Do not substitute the shorter label `Needs update`.

Suggested hook: `data-testid="resume-freshness"` and `role="img"` with `aria-label` set to the accessible name, so the name is exposed and the visible words remain on screen.

Meaning:

- `true` means the API still has a tailored-resume row for this job. Show green / `Up to date`.
- `false` means the API has no current row. That includes a job that never generated one and a job whose description edit deleted the row. Show orange / `Needs regeneration`. Show `No tailored resume yet.` and `Generate resume` once the resume query has succeeded with `null`.
- Do not label a resume `Up to date` when this flag is `false`.
- Do not invent version tracking. After generate, the existing jobs refetch is what flips the flag to `true`. After a description save, the existing jobs refetch is what flips it to `false`, and the existing tailored-resume invalidation is what makes the next read return `null`.

Details keeps `Present` / `Not available`. Only the Resume card uses `Up to date` / `Needs regeneration`.

While the resume query is loading, keep the indicator tied to the flag. Do not show a document or the download control until a non-null resume is in the query result.

## Resume download

When the tailored-resume query has succeeded with a non-null document, show a download icon in the header cluster. When the query is `null`, loading, or in error with no document, do not render the control.

- Accessible name exactly `Download resume PDF`.
- `data-testid="download-tailored-resume"`.
- Inline SVG that reads as a download (arrow into a tray). The SVG is `aria-hidden="true"`.
- The button has the same visible focus treatment as Close.
- No icon package.

Clicking it downloads the resume currently shown. It does not call the API. It does not upload anything to the Phase 7 resume-file routes.

### PDF approach

No project dependency can generate this document. Do not add a backend PDF route.

Add one runtime dependency, `jspdf`, to `@jobpilot/web` only. Use it in the browser to build a text PDF from the same display model as the preview. Do not add `html2canvas`, `pdf-lib`, `pdfmake`, `puppeteer`, or a second PDF library. Do not screenshot the DOM.

Build the PDF from:

- the identity and contact line defined below
- the same section order, headings, bullets, technology lines, and formatted dates as the preview
- the job’s `companyName` and `jobTitle` only for the filename

Do not put these in the file:

- `sourceId`
- `userId`, job id, or any other internal id
- `storagePath`, prompts, model names, or the raw JSON
- the Dashboard chrome, `Generate resume`, `Up to date`, or `Needs regeneration`

The PDF should read as the resume: identity, contact line, then the non-empty sections. Page wrapping is fine. A multi-section resume may be more than one page.

### Filename

Use the selected job’s `companyName` and `jobTitle`, which the dashboard already has.

1. For each of those two strings, replace every run of characters other than ASCII letters and digits with a single hyphen.
2. Trim leading and trailing hyphens.
3. Join the remaining pieces with a hyphen, then append `-Resume.pdf`.
4. If both pieces are empty after sanitizing, download `Resume.pdf`.

`Nova Systems` and `Software Engineer` become `Nova-Systems-Software-Engineer-Resume.pdf`. `Example Co` and `Engineer` become `Example-Co-Engineer-Resume.pdf`.

Do not put spaces, slashes, query strings, or ids in the filename.

## Resume preview

When the query holds a tailored resume, render it inside the active card as one document, `data-testid="resume-document"`. Stop rendering each section as a stack of concatenated rows.

The document is visually separate from the Dashboard card:

- white background
- a neutral border, about `#E5E7EB`
- a light neutral shadow, not the Profile `#80A8FF` shadow
- readable dark text, about `#172033`
- padding about 32px when the active area is wide, and about 16px when it is narrow
- width 100% up to about 816px (US Letter width at 96px per inch), centered with `margin-inline: auto`
- height from content. Do not fix the height, clip sections, or force a horizontal scrollbar
- below 816px, the document uses the card’s content width and sections wrap

`Generate resume` stays outside the document, under it, with the same label and `data-testid="generate-tailored-resume"`. Show it both when the document is empty and when a resume is present, as the panel does today.

### Identity header

At the top of the document, center an identity block.

- Name: the visible text `Your Name`, `data-testid="resume-candidate-name"`. The product has no candidate name. Do not invent one. This line is a paragraph, not a heading, so it does not compete with `Tailored resume`.
- Contact line, `data-testid="resume-contact"`, in this order, separated by ` • `:

```text
{session email} • Phone • Location • LinkedIn • Portfolio
```

Use `user.email` from the signed-in `PublicUser` already on `SignedInPage`. Thread that string through `Dashboard` into the panel. Do not call a new endpoint. Do not read the access token or the password.

`Phone`, `Location`, `LinkedIn`, and `Portfolio` are the literal placeholder words. Do not render `(000) 000-0000`, `City, State`, a fake LinkedIn URL, or `job.jobLocation`. Placeholders are text, not unlabeled icons, and they are not written to any API.

The same identity block is the top of the PDF.

### Section order and structure

Render only sections whose arrays are non-empty, in this order:

1. Skills
2. Experience
3. Projects
4. Education
5. Certifications

Do not render an empty section and do not render the word `None`. Omitting an empty section is presentation only. The stored arrays stay as the API returned them.

Each rendered section:

- is one region inside `resume-document`, not a nested Profile card
- has an `h3` heading. The page `h1` remains `Dashboard`. The card `h2` remains `Tailored resume`. Section titles are `h3`
- heading text is the section name in uppercase, semibold, dark
- a horizontal divider directly under or beside that heading, about `#D1D5DB`
- consistent vertical space between sections, about 16px to 20px

Keep every grounded field that is non-null. `sourceId` stays a key only. It must not appear as text, in an attribute the user can see, in the accessible name, in the PDF, or in the filename.

Suggested test ids, unchanged and still one per record: `resume-skill`, `resume-experience`, `resume-project`, `resume-education`, `resume-certification`.

### Skills

Inside the Skills section, render the skill names as a wrapping inline list separated by ` • ` or commas. Each skill keeps `data-testid="resume-skill"` and its `name`. Do not give each skill its own large stacked row.

### Experience

For each experience record, inside `resume-experience`:

- First line: `employer` prominent on the left, and the date range aligned to the right on a wide document. On a narrow document the date may wrap under the employer; do not overflow horizontally.
- Second line: `jobTitle`.
- Accomplishments as a bulleted list, one bullet per string, in stored order.
- When `technologies` is non-empty, a smaller line `Technologies: ` followed by the names separated by `, `. When it is empty, omit that line.

Date range: formatted start, an en dash, and either the formatted end or the word `Present` when `endDate` is null. `Present` is display-only. Do not send it back to the API and do not change the stored null.

### Projects

For each project, inside `resume-project`:

- `name` prominent
- dates on that line when at least one of `startDate` or `endDate` is non-null. Both null: omit the date. Start set and end null: formatted start, en dash, `Present`. End set and start null: the formatted end only. Both set: formatted start, en dash, formatted end
- `description` as its own paragraph
- `url` as text when it is a non-null string. A link to that URL is fine. When `url` is null, omit it. Do not show a placeholder URL
- accomplishments as bullets
- technologies with the same `Technologies:` line as experience, omitted when empty

### Education

For each education item, inside `resume-education`:

- `institution` prominent, dates aligned as in experience
- second line: `degree` and `fieldOfStudy`, both visible
- null `endDate` displays `Present`. A non-null end displays the formatted date

### Certifications

For each certification, inside `resume-certification`:

- `name` prominent
- `issuer`
- issued date, labeled so it is readable, for example `Issued Jan 2025`
- when `expiresOn` is non-null, an expiry line, for example `Expires Jan 2026`
- when `expiresOn` is null, omit the expiry line. Do not show `No expiration` and do not change the stored null

## Dates

Format a stored `YYYY-MM-DD` calendar date as `Mon YYYY`, for example `2023-01-01` displays as `Jan 2023`.

Use a fixed English month table (`Jan` through `Dec`) and the year and month numbers parsed from the string. Do not parse the string with `new Date(iso)` and then format in the local timezone. A date-only string parsed as UTC midnight can fall on the previous local day and change the month. Do not add a date library. `Intl` is unnecessary if the month table is fixed.

This formatting is display-only, including inside the PDF. Persisted values stay `YYYY-MM-DD`.

## Empty and error states

If the tailored-resume query succeeds with `null`:

- do not render `resume-document`
- do not render download
- show orange `Needs regeneration` because the flag is `false` whenever the row is gone
- show `tailored-resume-empty` with the exact text `No tailored resume yet.`
- show `Generate resume`

If generate succeeds:

- render the document
- the jobs refetch sets `tailoredResumePresent` to `true`, and the indicator becomes green `Up to date`
- download appears once the document is in the query cache

If generate fails:

- keep the existing error text, including `Resume generation failed`
- if no document was stored, keep the empty state and hide download
- if a document was already stored, keep that document, keep download, and leave the flag `true` until a later description edit clears the row

Read errors still use `requestErrorMessage`. They do not invent a resume.

## No Back buttons

Do not add a control named `Back` anywhere in the Dashboard active area. Navigation stays the jobs-menu actions plus the top-right Close icon.

These activities stay without a Back button:

- Resume
- Details
- Plan
- Interview
- Add job
- Edit job

`Cancel` on Edit job stays. It is not a Back button. Do not modify the jobs menu.

## Interview presentation

`Interview` still mounts `InterviewAttemptPanel` in the active card. Do not change start, submit, scoring, feedback, completion, readiness, or retake behavior.

### Question headings

Above each question’s text, render a heading `Question N` where `N` is the zero-based index in `attempt.questions` plus one.

- First rendered question: `Question 1`
- Then `Question 2`, through `Question 8` when the API returns eight
- Element: `h3`
- `data-testid="interview-question-number"`
- The question text (`interview-question-text`) is the next visible content

Do not persist a new number. Do not sort the list again. Do not display `question.position` as a separate value. Because the attempt schema already requires position to follow array order, `Question N` and `position` stay aligned without a new write.

Keep, in the same question item:

- `interview-question-text`
- `interview-question-category`
- `interview-question-concept`
- `interview-question-rubric`
- the unanswered controls, or the scored answer, feedback, and score

The card `h2` remains `Interview attempt`.

### Question blocks

Each `interview-question` stays one block in the list inside the active card.

- space between questions, about 16px
- a light divider, about `#E5E7EB`, is enough separation
- do not wrap a question in a Profile card, an 8px shadowed card, or a 20px nested card

`Question N` remains after the question is scored.

### Submit answer

`Submit answer` stays in that question, under the textarea.

- visible text exactly `Submit answer`
- accessible name stays `Submit answer` because the visible text is the name. Do not add a different `aria-label`
- `data-testid="interview-question-submit"` stays
- width fits the label and the button’s horizontal padding. It must not stretch to the question width. `justify-self-end` or a right-aligned flex row is enough to stop the grid from stretching it
- align it to the right edge of the question block
- keep the existing `Button` height (`h-9`, 36px) and its focus ring
- keep `disabled` while any answer POST from this panel is in flight
- do not move it to the jobs menu

After `score` is non-null, hide the textarea and `Submit answer`, and show the saved answer, feedback, and score, as today. `Question N` stays.

## Preserve

Preserve:

- `GET` and `POST /jobs/:id/tailored-resume`, including the empty `{}` body, 404-as-null, cache key `["tailored-resume", userId, jobId]`, cache write on success, and jobs refetch
- grounded resume schema and internal `sourceId` values
- hiding `sourceId` in the UI
- null end dates, null project URLs, and null `expiresOn` as stored
- description edits clearing the tailored resume on the server, and the client invalidation that drops a stale document
- title-only edits leaving the resume in place
- a failed generate leaving the previous document in place
- interview read, start, one answer at a time, eight questions, scoring, feedback, completion, readiness, and retake
- query key `["interview-attempt", userId, jobId]`
- the jobs menu, Details, Plan, Add, Edit, Close, and the workspace layout from UI improvement 04
- Profile, authentication, and session behavior, except threading the existing email string into the resume panel
- Details copy `Present` / `Not available` for `job-tailored-resume`

No database changes. No API contract changes. No phase-spec changes. No edits to UI improvements 01–04.

The one new runtime dependency allowed by this spec is `jspdf` on `@jobpilot/web`.

## Accessibility

- Freshness is not color-only. Visible text plus the accessible names `Resume up to date` and `Resume needs regeneration`.
- Download’s accessible name is `Download resume PDF`.
- Close’s accessible name stays `Close`.
- Resume sections are `h3` under the card `h2`. The candidate name is not a heading.
- Contact placeholders are text.
- `Question N` is an `h3` and is exposed to assistive technology as that heading text.
- `Submit answer` stays a keyboard-operable button.
- Close, Download, and the freshness control’s focusable sibling buttons show a visible focus outline. The freshness indicator itself does not need to be a button.
- Icon SVGs are `aria-hidden="true"`.

## Tests

Update Playwright coverage. Do not drop assertions that generate posts `{}`, that skills appear after generate, that a second generate replaces skills, that a description edit clears the resume, that a failed generate either keeps the empty state or keeps the previous resume, that source ids are absent, or that interview start, answer, score, feedback, completion, readiness, and retake still hold.

`apps/web/e2e/tailored-resume.spec.ts`:

- A generated resume is inside `resume-document` with the section headings that have data. Skills are not one large row per skill; each skill test id is still present.
- The identity block shows `Your Name` and the signed-in email, plus the placeholder words `Phone`, `Location`, `LinkedIn`, and `Portfolio`.
- The existing fixture in `hides source ids and shows resume facts` still shows employer, title, accomplishment, and technology. Its null experience `endDate` shows `Present`. Dates show as `Jan 2023`, `Feb 2025`, `Feb 2023`, `Sep 2026`, and `Jun 2025`, not as raw `YYYY-MM-DD`.
- Add a project, or an extra project, with `url: null` and assert that no placeholder URL is shown. Keep the assertion that a non-null URL is shown.
- `sourceId` strings remain absent from the panel text and from the downloaded file bytes.
- With a current resume, `resume-freshness` shows `Up to date` and is named `Resume up to date`, and `download-tailored-resume` is visible.
- With no current resume, including after the description edit that already clears it, freshness shows `Needs regeneration` and is named `Resume needs regeneration`, download is absent, and `No tailored resume yet.` plus `Generate resume` remain.
- Clicking download produces a file whose name matches the sanitized company and title plus `-Resume.pdf`, whose bytes start with `%PDF`, and whose bytes do not include the fixture `sourceId` values. `jspdf` writes those strings into the content stream for this text-only document. Do not add a PDF parser. If a future library version compresses the stream so the employer text is not a literal, keep the `%PDF` and filename checks and do not add a parser dependency; the on-screen document remains the content proof.
- The download click does not send a tailored-resume request.
- No button named `Back` is present in the active area.

`apps/web/e2e/interview-attempt.spec.ts` and `apps/web/e2e/interview-answer.spec.ts`:

- Each of the eight questions shows `Question 1` through `Question 8` in rendered order, via `interview-question-number`.
- `Submit answer` for a question is inside that `interview-question` and is absent from `jobs-menu`.
- Before scoring, the input and `Submit answer` are present. After scoring, they are absent and the answer, feedback, and score remain.
- Do not remove the existing score, readiness, or retake assertions.

Do not assert pixel positions, computed widths, or screenshot hashes. Asserting that `Submit answer` is not stretched can be a single check that its bounding width is less than the question block’s width. That is enough.

## Acceptance criteria

- The tailored resume looks like a professional single-column resume document rather than concatenated lists.
- The resume has an identity and contact header.
- Missing name, phone, location, LinkedIn, and portfolio use the literal placeholders `Your Name`, `Phone`, `Location`, `LinkedIn`, and `Portfolio`. The contact email is the signed-in user’s email. No personal data is invented.
- Skills, Experience, Projects, Education, and Certifications use resume-style `h3` headings and divider lines when they have items. Empty sections are omitted.
- Experience and project accomplishments are bullets.
- Dates display as `Mon YYYY`.
- `Present` is display-only for a null experience or education end date, and for a project that has a start and a null end.
- `sourceId` values stay hidden.
- A current resume shows a green `Up to date` indicator named `Resume up to date`.
- A missing or invalidated resume shows an orange `Needs regeneration` indicator named `Resume needs regeneration`.
- Changing the job description still requires generating a new resume. The server still deletes the row. The client still drops the stale document.
- A generated resume has a Download PDF icon between the freshness indicator and Close.
- The PDF contains the human-readable resume and not internal metadata.
- Active Dashboard cards have no Back buttons.
- Close stays the top-right icon and is still named `Close`.
- Interview questions display `Question N` from display order.
- `Submit answer` is compact, right-aligned, and still says `Submit answer`.
- Resume generation, interview attempts, the workspace, the jobs menu, and the Details status copy keep their current behavior.

## Validation checklist

Check these after implementation. Do not mark an item passed unless it was actually exercised.

- [ ] `Resume` still opens one `tailored-resume-panel` in the active card. The jobs menu is unchanged. The card is white, about 8px radius, about 20px padding, with the Profile `#80A8FF` shadow. There is no Back button.
- [ ] The top-right cluster is freshness, then download when a document is shown, then one Close named `Close` with `close-tailored-resume`. The heading remains `Tailored resume`.
- [ ] With no stored resume, freshness shows `Needs regeneration`, is named `Resume needs regeneration`, download is absent, the empty copy is `No tailored resume yet.`, and `Generate resume` posts `{}`.
- [ ] After a successful generate, the document shows the grounded sections, skills are inline, accomplishments are bullets, a null end date reads `Present`, dates read `Mon YYYY`, source ids are absent, freshness becomes `Up to date` after the jobs refetch, and download appears.
- [ ] The document shows `Your Name` and the account email, then `Phone`, `Location`, `LinkedIn`, and `Portfolio`. It does not show a fake phone number, `City, State`, or the job location as the candidate location.
- [ ] A null project URL is omitted. A real project URL is shown. A null `expiresOn` omits an expiry line. Empty sections do not say `None`.
- [ ] Download saves a `%PDF` file named from the sanitized company and title, does not call the API, and does not contain `sourceId` bytes when the stream is uncompressed.
- [ ] A failed generate with no resume keeps the empty state and the error. A failed generate after a resume exists keeps that resume and the error.
- [ ] Editing the job description still clears the resume: Details returns to `Not available`, and Resume shows `Needs regeneration`, the empty copy, and no download.
- [ ] A title-only edit still leaves the current resume in place.
- [ ] Details still says `Present` or `Not available` on `job-tailored-resume`. Plan, Add, Edit, and the workspace layout are unchanged aside from having no Back button.
- [ ] Interview questions show `Question 1` onward in display order. `Submit answer` is inside the matching question, right-aligned, not full width, and absent from the jobs menu. After a score it is gone, and the answer, feedback, and score remain. Eight questions, completion, readiness, and retake still pass.
- [ ] Close, Download, and `Submit answer` show visible focus.
- [ ] At the desktop Playwright width and near 375px, the resume document and the interview list do not force horizontal scrolling.
- [ ] `pnpm typecheck` passes.
- [ ] The Playwright specs for tailored resume, interview plan, interview attempt, interview answer, interview readiness, and jobs pass.
- [ ] The only new runtime dependency is `jspdf` on `@jobpilot/web`. No API, database, phase, or UI-improvement 01–04 file changes for this work.
- [ ] The web bundle and `apps/web/src` still contain no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
