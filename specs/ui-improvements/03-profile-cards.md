# UI improvement 03 — Profile cards

## Goal

Redesign the Profile page inside the signed-in shell, and change how that shell scrolls.

The header and the navigation stay fixed. Only the main content region scrolls. Profile becomes full-width cards in two independent columns on desktop, and one column below 1024px. Each profile section shows its saved records and an Add button. The creation form appears only after Add. Edit and Delete become gray icon buttons. Every card uses the same `#80A8FF` shadow, the same `#8EC1DE` saved-record labels, and the same `#D3D3FF` Add button.

Dashboard content stays as it is, except for a page title, hiding the jobs card’s inner `Dashboard` heading so the word appears once, and the same fixed-shell scroll behavior.

This is a UI-improvement spec. It does not change Phases 1–18, and it does not change UI improvements 01 or 02.

## Current layout this improvement changes

`SignedInPage` in `apps/web/src/pages/AuthPage.tsx` renders the shell from UI improvement 02:

- A white header about 70px tall, with the JobPilot logo and a logout icon.
- A `#3F5F9A` sidebar at 1024px and above, or a compact `#3F5F9A` nav bar under the header below 1024px.
- A `#F4F5F7` main region.

The signed-in root is `min-h-screen` and is not locked to the viewport. Header, navigation, and main content scroll together as the document grows. There is no separate scroll container for the main region.

Profile and Dashboard share one centered column, `max-w-3xl`, with 24px padding. Profile is a vertical stack of cards in this order:

1. Skills
2. Education
3. Work experience
4. Projects
5. Certifications
6. Resumes

Each profile card permanently shows its creation UI under the saved records. Work experience, education, projects, certifications, and skills use text buttons such as `Edit skill` and `Delete skill`. Create forms have a submit button (`Add skill`, `Add education`, `Add experience`, `Add project`, `Add certification`) and no Cancel. Edit forms already have Cancel and a save button (`Save skill`, and the matching label for each section). Resumes always show a file input and `Upload resume`. Each resume row has `Download resume` and `Delete resume`. There is no edit action for a resume file.

There is no confirmation dialog on delete. Failures surface through the existing `role="alert"` error text.

Dashboard is the jobs card in `apps/web/src/jobs/dashboard.tsx`. That card’s heading is already `Dashboard`, an `h2` inside the card. This improvement hides that inner heading. The jobs form, rows, tailored-resume panel, interview plan, attempt, score, and readiness UI stay mounted as they are today.

Keep the shell hooks from UI improvement 02: `data-testid="signed-in"`, `data-testid="app-nav"`, `data-testid="nav-dashboard"`, `data-testid="nav-profile"`, and the logout control named `Log out`.

## Scroll behavior

The signed-in shell fills the viewport. The document itself does not scroll while the user is signed in.

- The white header stays fixed at the top.
- On desktop, the left sidebar stays fixed under the header.
- Below 1024px, the compact Dashboard / Profile bar stays fixed under the header. Do not bring back a scrolling sidebar, a drawer, or a hamburger menu.
- Only the main content region scrolls vertically.
- Scrolling Profile or Dashboard content does not move the header or the navigation.
- When the content is shorter than the main region, the header and navigation still stay in place and the page does not grow a document scrollbar.
- Do not create a second scrollbar on `body` plus the main region.
- Do not introduce horizontal scrolling at desktop width, at about 375px, or near 320px.

A viewport-height flex shell is enough: the signed-in root is the viewport height and clips overflow; the header and navigation do not shrink or scroll; `main` is the only element with vertical scrolling (`min-height: 0` so the flex child can actually scroll). Fixed positioning is acceptable if it produces the same result. Do not change the signed-out Login / Sign up scroll behavior from UI improvement 01.

Switching between Profile and Dashboard does not move the header or the navigation.

## Page title

At the top of the scrolling main region, show the current page name as a prominent heading.

| View | Page heading |
| --- | --- |
| Profile | `Profile` |
| Dashboard | `Dashboard` |

The page heading is an `h1`. It is left-aligned with the content inset below. It is large but not oversized: about 24px, semibold. Use a dark gray that is clearly darker than the `#F4F5F7` background. `#172033` (`--jp-ink`) is the right ink.

Keep about 20px of space:

- from the top of the main region to the heading
- from the left and right edges of the main region to the heading
- between the heading and the content under it

The heading is text, not a button, and not a replacement for the sidebar labels.

## Profile card grid

Remove the centered `max-w-3xl` column from Profile. The cards use the full width of the main region.

Render six separate cards, in this order:

1. Work Experience
2. Education
3. Skills
4. Projects
5. Certifications
6. Resumes

The visible Work Experience title is `Work Experience`. That replaces the current card heading `Work experience`. The other card titles stay `Education`, `Skills`, `Projects`, `Certifications`, and `Resumes`.

Each card title is a visible heading (`h2`) inside that card.

Desktop, 1024px and above, the cards are two independent vertical stacks. A CSS row grid is not enough: a short card must not wait for the taller card beside it. Do not use experimental CSS masonry (`grid-template-rows: masonry` or `masonry-auto-flow`).

Left column, top to bottom:

1. Work Experience
2. Skills
3. Certifications

Right column, top to bottom:

1. Education
2. Projects
3. Resumes

Each column fills half of the main-content width. About 20px separates the columns. About 20px separates cards inside a column. Projects sits directly under Education, even when Work Experience is taller. Cards do not share a row height.

```text
[ Work Experience ]  [ Education ]
[ long content     ]  [ short     ]
[ long content     ]  [-----------]
[------------------]  [ Projects  ]
[ Skills           ]  [ ...       ]
[------------------]  [-----------]
[ Certifications   ]  [ Resumes   ]
```

The document order at this width follows the columns: left column top to bottom, then the right column. That keeps the accessibility sequence the same as the visual sequence.

Below 1024px:

- One column.
- Logical order: Work Experience, Education, Skills, Projects, Certifications, Resumes.
- The document order matches that visual order.
- About 20px between cards and about 20px from the sides of the main region.
- No horizontal overflow.

The same 1024px breakpoint as the shell is the collapse point. Only one of these layouts is mounted at a time, so a card is not rendered twice.

Inset from the left and right sides of the main region stays about 20px, the same inset as the page title. A card grows with its records. Do not set a fixed card height. Cards are not centered in a narrow measure.

Keep these section hooks on the matching card:

| Card | `data-testid` |
| --- | --- |
| Work Experience | `profile-experience` |
| Education | `profile-education` |
| Skills | `profile-skills` |
| Projects | `profile-projects` |
| Certifications | `profile-certifications` |
| Resumes | `profile-resumes` |

Also keep the loading and empty hooks and their current copy:

| Hook | Copy |
| --- | --- |
| `profile-skills-loading` | `Loading skills…` |
| `profile-skills-empty` | `No skills yet.` |
| `profile-education-loading` | `Loading education…` |
| `profile-education-empty` | `No education yet.` |
| `profile-experience-loading` | `Loading work experience…` |
| `profile-experience-empty` | `No work experience yet.` |
| `profile-projects-loading` | `Loading projects…` |
| `profile-projects-empty` | `No projects yet.` |
| `profile-certifications-loading` | `Loading certifications…` |
| `profile-certifications-empty` | `No certifications yet.` |
| `profile-resumes-loading` | `Loading resumes…` |
| `profile-resumes-empty` | `No resumes yet.` |

While a list is loading, show the loading line, hide the empty line, and do not show the creation form. A list error still uses `role="alert"` and still hides the empty line. Other cards keep loading on their own.

## Card behavior

A card in its normal state shows only:

- the card title
- the saved records, or the empty copy when the list has loaded and is empty
- any list or request error already shown today
- an Add button at the bottom of the card

Do not permanently display an empty creation form. The create form is not mounted until the user clicks that card’s Add button.

### Add

Clicking Add on a card opens that card’s existing creation form in place of the saved-records view (or the empty copy). The card title stays visible. The record list and the Add button are not shown while the form is open.

The form still uses the current fields, labels, help text, React Hook Form resolvers, and Zod schemas from `@jobpilot/shared`:

| Card | Form accessible name | Fields |
| --- | --- | --- |
| Work Experience | `Add experience` | Employer, Job title, Start date, End date, Accomplishments, Technologies |
| Education | `Add education` | Institution, Degree, Field of study, Start date, End date |
| Skills | `Add skill` | Name |
| Projects | `Add project` | Name, Description, URL, Start date, End date, Accomplishments, Technologies |
| Certifications | `Add certification` | Name, Issuer, Issued on, Expires on |

End-date help stays `Leave blank if ongoing.` Expires-on help stays `Leave blank if it does not expire.`

The create form’s submit control is a button named `Save`. It runs the existing create request for that section (`createExperience`, `createEducation`, `createSkill`, `createProject`, or `createCertification`) with the same body the form submits today. Invalid input is still rejected in the form before a request. The existing field errors and root errors stay associated with the form.

Create forms do not have Cancel today. Add a Cancel control named `Cancel` that closes add mode without a request and without changing saved records.

After a successful save:

- close add mode
- refetch that section the way the UI already does
- show the saved-records view, including the new record
- hide the empty copy

If client validation fails, stay on the form and do not send the request. If the request fails, stay on the form and show the existing alert. Do not drop the error on the floor and do not navigate away from the form.

### Edit

Edit stays per record. Clicking the Edit icon opens the existing edit form for that record only. Other records in the card stay visible. The edit form keeps its current fields, accessible name, submit label, and Cancel behavior:

| Card | Form name | Submit name |
| --- | --- | --- |
| Work Experience | `Edit experience` | `Save experience` |
| Education | `Edit education` | `Save education` |
| Skills | `Edit skill` | `Save skill` |
| Projects | `Edit project` | `Save project` |
| Certifications | `Edit certification` | `Save certification` |

Cancel closes the edit form without a request. A successful save updates the record through the existing update request, closes the edit form, and refetches. A failed save keeps the edit form and shows the existing alert.

A card is in one mode at a time. Opening Add closes an open edit in that card without saving. Opening Edit closes add mode in that card without saving. Other cards are independent.

### Delete

Clicking Delete still calls the existing delete request for that record, clears an edit form when the deleted record is the one being edited, and refetches. There is no confirmation dialog today. Do not add one. Errors still use the existing alert.

### Resumes

Resumes have no edit form. The Add button on the Resumes card reveals the existing file input and the existing `Upload resume` button. That button remains the persist control. Do not rename it to `Save`. It still uploads the selected file with the current request, clears the input after success, refetches, and returns to the saved-files view. Choosing Upload with no file still surfaces the existing `Invalid input` error. Cancel on this card closes add mode without uploading.

`Download resume` stays a labeled button on each saved file. It is not an Edit or Delete icon. Download still calls the existing download request.

## Saved records

Show every saved value the card shows today. Do not drop fields to simplify the layout.

- Skills: name.
- Education: institution, degree, field of study, start date, end date. A missing end date still displays `Present`.
- Work Experience: employer, job title, start date, end date (`Present` when missing), accomplishments, technologies.
- Projects: name, description, URL when present, start date when present, end date (`Present` when missing), accomplishments, technologies.
- Certifications: name, issuer, issued on, expires on (`Present` when missing, matching the current display).
- Resumes: file name, plus Download.

Present each record as its own block inside the card, with enough padding that the text does not sit under the icons.

Saved-record field labels use `#8EC1DE` on every card. That includes Name, Employer, Job title, Start date, End date, Institution, Degree, Field of study, Technologies, Accomplishments, Issuer, Issued on, and Expires on. The saved value stays the normal dark text, about `#172033`. This is display text only. Input labels inside Add and Edit forms stay as they are. Do not change field names, values, `Present`, or formatting.

Replace the visible Edit and Delete text buttons with icon buttons. Draw a pencil (or pen) for Edit and a trash can for Delete as inline SVG. `apps/web` has no icon package. Do not add Lucide, Heroicons, Radix icons, or `react-icons`.

Place Edit, then Delete, in the top-right of that record. Resumes have Delete only, in that same top-right corner, plus the Download button in the record body.

Icon color is the logout gray, about `#6B7280`, on the white card (about 4.8:1). The SVG is decorative. The button carries the accessible name.

Use these accessible names so each control stays distinct:

| Action | Accessible name |
| --- | --- |
| Edit a skill | `Edit skill` |
| Delete a skill | `Delete skill` |
| Edit education | `Edit education` |
| Delete education | `Delete education` |
| Edit experience | `Edit experience` |
| Delete experience | `Delete experience` |
| Edit a project | `Edit project` |
| Delete a project | `Delete project` |
| Edit a certification | `Edit certification` |
| Delete a certification | `Delete certification` |
| Delete a resume | `Delete resume` |

The visible control is the icon only. Do not also show the words Edit or Delete next to the icon.

Icon buttons need a visible hover state (a light gray background is enough) and a visible keyboard focus outline. On the white card, reuse the signed-in focus treatment: a clear outline in `#6288DA` (`--jp-primary-border`). Do not use a one-pixel gray ring that disappears on white.

## Add buttons

The Add button is the last item in the card’s normal state, after the records or the empty copy.

Visible label: `Add`.

Accessible names:

| Card | Accessible name |
| --- | --- |
| Work Experience | `Add work experience` |
| Education | `Add education` |
| Skills | `Add skill` |
| Projects | `Add project` |
| Certifications | `Add certification` |
| Resumes | `Add resume` |

Every Add button uses the same fill, `#D3D3FF`, with dark text about `#172033`. That includes Work Experience, Education, Skills, Projects, Certifications, and Resumes. Do not assign a different palette color per card.

Add keeps a visible focus outline, the same `#6288DA` outline used on white surfaces. The button stays keyboard operable.

Save, Cancel, Upload resume, and Download resume may keep the existing neutral button styling. They do not need a per-card palette color.

## Card visual treatment

Profile cards sit on `#F4F5F7` as white surfaces.

Every Profile card uses the same soft shadow tinted with `#80A8FF`. The shadow is blurred, low opacity, and visibly elevated. It is not a solid colored border, a strong glow, or a heavy drop shadow. A hairline neutral border may remain. The card fill stays white. Do not vary the shadow color by card.

- Corner radius about 8px. Not a pill and not a large floating tile.
- Internal padding about 20px.
- Section headings are clear and darker than the canvas, about `#172033`.
- Height comes from the content.

Do not change the shared card component in a way that restyles Dashboard, job rows, tailored-resume panels, or interview panels. Profile can use its own classes.

## Dashboard

Add the `Dashboard` page title described above, inside the scrolling main region. That `h1` is the only visible `Dashboard` heading.

The jobs card currently repeats the word as an `h2` inside the card. Suppress that inner heading so it is not visible and is not a heading in the accessibility tree. The dashboard body — loading, empty, errors, job rows, and the create-job form — begins under the page title without another `Dashboard` heading.

Do not otherwise redesign the jobs card, job rows, create-job form, edit-job form, tailored resume panel, interview plan, interview attempt, scores, or readiness. Hiding the inner heading is the only change to that card’s chrome. Do not restyle its border, padding, job rows, or forms to compensate. Removing the heading element is enough. Leaving an empty header that shows no title is also enough.

The jobs column may keep the current `max-w-3xl` measure so job cards do not stretch across an ultrawide window. That max width applies to the dashboard body only. It must not constrain the Profile columns.

## Preserve

Preserve:

- Authentication and session restoration, including `loading`, `signed-out`, and `signed-in`.
- Access token in memory only. Refresh cookie stays `HttpOnly`.
- Logout behavior from UI improvement 02.
- Header, sidebar, compact nav, logo, logout icon, colors, and selected state from UI improvement 02.
- In-memory view switching. No router and no `/profile` or `/dashboard` URL. Profile is still the view after sign-in and after reload.
- Profile query keys, `profileQueryKey`, and the rule that one user’s cache is not shown to the next user.
- Existing profile and resume API paths, methods, request bodies, and status codes.
- Validation schemas and the current field labels.
- Saved values listed above, including `Present` for a blank end date.
- Edit, delete, download, and upload behavior described in this spec.
- Dashboard jobs behavior, including analysis, tailored resumes, interview plans, attempts, scores, and readiness.
- Signed-out Login / Sign up from UI improvement 01.

No backend changes. No database changes. No API contract changes. No new runtime dependency.

## Accessibility

- The page name is a real `h1` (`Profile` or `Dashboard`). On Dashboard, that `h1` is the only heading named `Dashboard`.
- Each profile card title is a real `h2`.
- Edit and Delete are buttons with the accessible names in the table above. The icon is not the only name.
- Add buttons expose `Add` visually and the card-specific accessible name.
- Keyboard focus is visible on Add, Save, Cancel, Edit, Delete, Upload resume, Download resume, and the existing shell controls.
- Text and icon controls meet WCAG 2.2 AA contrast for the pairs specified above. `#6B7280` icons on white are about 4.8:1. White on `#3F5F9A` is about 6.3:1. Add buttons use `#172033` on `#D3D3FF`. Saved-record labels are `#8EC1DE`. Saved values stay about `#172033`.
- Buttons remain keyboard operable.
- Inputs stay associated with their labels. Errors stay in the form (`data-slot="form-message"`) or in `role="alert"`, as they do today.
- Sidebar controls stay buttons, not headings.

## Tests

Update the web end-to-end tests that assume the old profile layout. Do not delete coverage of create, edit, delete, upload, validation, list errors, loading, empty states, reload, or cache isolation.

Heading order follows the mounted layout. Playwright’s desktop project is wider than 1024px, so it sees the column order:

1. `Profile`
2. `Work Experience`
3. `Skills`
4. `Certifications`
5. `Education`
6. `Projects`
7. `Resumes`

Below 1024px the order is `Profile`, then Work Experience, Education, Skills, Projects, Certifications, Resumes.

`apps/web/e2e/profile.spec.ts` and `apps/web/e2e/jobs.spec.ts` currently expect the first headings to be `Skills`, `Education`, `Work experience`, `Projects`, `Certifications`. Update those assertions. `apps/web/e2e/jobs.spec.ts` looks up a heading named `Dashboard` on the jobs view. After this change that name appears once, on the page-level `h1`. Update the lookup so it does not require a second `Dashboard` heading inside the jobs card. Keep `data-testid="dashboard"` on the jobs section.

Create forms are hidden until Add. These flows must open the card first, then submit:

- `apps/web/e2e/profile.spec.ts`
- `apps/web/e2e/jobs.spec.ts`
- `apps/web/e2e/tailored-resume.spec.ts`
- `apps/web/e2e/resumes.spec.ts`

For a skill, the updated path is: click the button named `Add skill`, use the form named `Add skill`, then click `Save`. The same pattern applies to `Add education`, `Add experience`, `Add project`, and `Add certification`. Edit flows still click `Edit skill` (and the other Edit names), then `Save skill` (and the other Save names). Delete flows still click `Delete skill` and the other Delete names.

`apps/web/e2e/resumes.spec.ts` must click `Add resume` before setting the file and clicking `Upload resume`. `Delete resume` and `Download resume` stay available from the saved file. The file input is not visible before Add.

A failed create stays on the form with the alert. The empty copy does not have to stay visible while that form is open. Cancel returns the empty copy when the list is still empty. Update the skill failure test if it requires the empty node during the open form.

Do not weaken assertions so that a hidden form, a missing record, or a document-level scroll pass by accident.

## Out of scope

- Routing, URLs for Profile or Dashboard, and mobile drawer navigation.
- A new icon package.
- Changes to UI improvement 01, UI improvement 02, phase specs, API routes, database schema, or token storage.
- Redesign of the jobs dashboard body, job rows, tailored-resume panels, or interview panels.
- New profile fields, new endpoints, or a delete confirmation dialog.
- Restyling the signed-out screens.

## Acceptance criteria

- The signed-in header and the navigation do not scroll with page content.
- Only the main content region scrolls vertically. The signed-in page does not scroll horizontally.
- Below 1024px, the compact nav stays fixed under the header, and Dashboard and Profile remain reachable.
- Profile and Dashboard each show a visible page title, `Profile` or `Dashboard`, about 24px, in a dark gray darker than `#F4F5F7`, with about 20px of inset.
- Dashboard shows the word `Dashboard` once. The jobs card’s inner heading is not visible.
- At 1024px and above, Profile is two independent columns. The left column is Work Experience, Skills, Certifications. The right column is Education, Projects, Resumes. A short card does not wait for the taller card in the other column. Projects sits directly under Education.
- Below 1024px, the cards stack in logical order: Work Experience, Education, Skills, Projects, Certifications, Resumes.
- Gaps between cards, the gap between the two columns, and the inset from the main region are about 20px.
- Cards use the available column width. They are not a centered `max-w-3xl` column.
- Cards grow with their records and do not share a height with the opposite column.
- Saved-record field labels are `#8EC1DE` on every card. Saved values stay dark. Add and Edit form labels are unchanged.
- Every Profile card is white with the same soft, low-opacity shadow tinted with `#80A8FF`. The radius stays about 8px.
- Saved records are shown by default. The creation form is not shown until Add.
- Add sits at the bottom of every card in the normal state.
- Add opens that card’s form in place of the saved-records view.
- Save persists with the existing create behavior and returns to the saved-record view.
- Cancel leaves add mode without saving. Edit forms keep their existing Cancel behavior.
- Edit and Delete are `#6B7280` icon buttons at the top-right of the saved record, with the accessible names in this spec.
- Download resume and Upload resume still work. Upload is revealed by Add on the Resumes card.
- Every Profile Add button uses `#D3D3FF` with dark text, about `#172033`.
- The jobs dashboard body is otherwise unchanged apart from the scroll container. Hiding the inner `Dashboard` heading is the only chrome change on that card.
- No API, backend, or database changes.
- Existing profile behavior remains functional, including validation, errors, loading, empty states, edit, delete, upload, download, and per-user cache isolation.

## Validation checklist

Check these after implementation. Do not mark an item passed unless it was actually exercised.

- [ ] At a desktop width of at least 1024px, scrolling Profile moves only the main region. The white header and the `#3F5F9A` sidebar stay in place. The document does not show its own scrollbar.
- [ ] The same is true on Dashboard: scrolling the jobs content does not move the header or the sidebar.
- [ ] At about 375px and near 320px, the header and the compact nav stay fixed, only the main region scrolls, Dashboard and Profile still switch, and the page does not scroll horizontally.
- [ ] Profile shows an `h1` reading `Profile`. Dashboard shows an `h1` reading `Dashboard`, and exactly one visible heading with that name. The jobs card does not show a second `Dashboard` heading. The type is about 24px and darker than `#F4F5F7` (about `#172033`). About 20px separates the heading from the top and sides of the main region and from the content below.
- [ ] At 1024px and above, the left column is Work Experience, then Skills, then Certifications, and the right column is Education, then Projects, then Resumes. Projects begins directly under Education while Work Experience is still taller. The columns split the main width. The column gap, the vertical gap, and the side inset are about 20px. There is no `max-w-3xl` cap on the profile layout, and no CSS masonry feature.
- [ ] Below 1024px, those cards stack in one column in logical order — Work Experience, Education, Skills, Projects, Certifications, Resumes — with about 20px spacing and no horizontal overflow.
- [ ] A card with more records is taller than an empty card. Cards in opposite columns do not stretch to a shared height.
- [ ] A saved label such as `Start date` or `Name` is `#8EC1DE` on every card. The value stays dark, about `#172033`. Labels inside Add and Edit forms are not recolored.
- [ ] Every Profile card has the same soft blurred shadow tinted with `#80A8FF`. The card fill stays white. The shadow is not a solid colored border or a strong glow.
- [ ] Before Add, each card shows its title, its saved records or empty copy, and an Add button. The create form and the resume file input are not shown.
- [ ] Add on each record card shows that card’s existing fields. Save creates the record through the existing request, then the card returns to the saved-record view and lists the new values. Cancel closes the form without a request.
- [ ] An invalid skill name shows the form error and does not send `POST /profile/skills`. A failed create shows the alert and stays on the form.
- [ ] Edit opens the existing edit form for that record. `Save skill`, `Save education`, `Save experience`, `Save project`, and `Save certification` still update only that record. Cancel discards the edit.
- [ ] Edit and Delete are icon buttons, about `#6B7280`, at the top-right of the record. Their accessible names are `Edit skill`, `Delete skill`, and the matching names for education, experience, projects, certifications, and `Delete resume`. Hover and keyboard focus are visible.
- [ ] Delete removes the record and restores the empty copy when it was the last one. No new confirmation dialog appears.
- [ ] Resumes: Add reveals the file input and `Upload resume`. A successful upload returns to the file list. `Download resume` still downloads. `Delete resume` still deletes.
- [ ] Every Add button, including Resumes, uses `#D3D3FF` with dark text about `#172033`.
- [ ] Loading and empty hooks still show the current copy. One slow section does not block the others. A list error on one section does not block the others.
- [ ] After reload, Profile is selected and the saved records are still there. A second user does not see the previous user’s skills, resumes, or jobs.
- [ ] Dashboard jobs, tailored resumes, interview plans, attempts, scores, and readiness behave as they do today. The jobs card is not restyled beyond hiding its inner `Dashboard` heading.
- [ ] Signed-out Login and Sign up still match UI improvement 01. The signed-in header and sidebar still match UI improvement 02.
- [ ] `pnpm typecheck` passes.
- [ ] The relevant web Playwright flows pass, including profile, resumes, jobs, and tailored resume, after the heading, Add, and Save expectations are updated.
- [ ] The web bundle and `apps/web/src` still contain no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] No API, database, phase-spec, or UI-improvement 01/02 files change for this improvement.
