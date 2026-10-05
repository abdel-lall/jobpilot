# UI improvement 01 — Authentication pages

## Goal

Replace the current combined authentication screen with two distinct signed-out views:

- Login
- Sign up

The signed-out experience today renders both forms at once. This improvement shows one form at a time and gives the authentication screens a shared visual language. All existing authentication behavior and API contracts stay in place.

This is a UI-improvement spec. It does not change Phases 1–18.

## Current behavior to preserve

Phase 4 already allows the signed-out page to be two sections or a control that switches between them. The HTTP contract, session rules, and form validation do not change.

| Visitor action | Request | Result that must remain |
| --- | --- | --- |
| Open the app | `POST /auth/refresh` with credentials | Start in `loading`. On `200`, store the access token, call `GET /auth/me` with that bearer token, then enter `signed-in`. On `401` because there is no valid refresh session, enter `signed-out`. Do not render either authentication form while restoration is pending. |
| Submit sign up | `POST /auth/register` | `201` confirms the account and leaves the visitor signed out. No access token is stored and no refresh cookie is set. Show the confirmation `Account created. You can log in.` |
| Submit login | `POST /auth/login` with credentials, then `GET /auth/me` | `200` stores the returned access token in memory. Then call `GET /auth/me` with `Authorization: Bearer <accessToken>`. Enter `signed-in` only after `/auth/me` succeeds. The signed-in page uses that `/auth/me` user, not the `user` object in the login response. |
| Logout | `POST /auth/logout` with credentials | Clear the in-memory access token immediately and enter `signed-out` whether the request succeeds or fails. |

Also preserve:

- Access token in memory only, sent as `Authorization: Bearer`. It is not written to `localStorage`, `sessionStorage`, or a readable cookie.
- Refresh cookie remains `HttpOnly`. Page JavaScript must not read `refresh_token`.
- Auth requests go to the API origin (`http://localhost:3000` locally) with `credentials: "include"`.
- Forms use React Hook Form, `registerBodySchema` and `loginBodySchema` from `@jobpilot/shared`, and the existing shadcn/ui form controls.
- Email rules stay trim, lowercase, and a valid email. Password length stays 8 through 128 characters. Password fields stay `type="password"`.
- Invalid input is rejected in the form before the request. Duplicate email shows the API error `Email already registered`. A wrong password shows `Invalid email or password`. Network or unexpected failures may show `Request failed`.
- The API `error` string is what the UI shows for `400`, `401`, and `409`. The UI does not show a password, a password hash, a refresh token, or an access token.
- Registration does not sign the visitor in.
- The signed-in page still shows the `/auth/me` email and logout. This spec does not redesign that page.

Stable hooks the current tests use, and that this layout must keep:

- `data-testid="auth-loading"` while session restoration is pending
- `data-testid="signed-out"` on the signed-out screen
- `data-testid="register-confirmation"` with the text `Account created. You can log in.`
- `data-testid="signed-in"` and `data-testid="user-email"` after a successful login
- Sign-up form accessible name `Register`, submit button `Create account`
- Login form accessible name `Log in`, submit button `Log in`
- Email and Password labels on both forms
- `role="alert"` for session errors

## Navigation

Signed-out view state is local to the authentication screen. Do not add a routing library.

- The first signed-out view is Login.
- Login includes the text control: `Don't have an account? Sign up`
- Sign up includes the text control: `Already have an account? Log in`
- Those controls switch between the two views. They do not submit a form and they do not call the API.
- Only one authentication form is mounted at a time.
- After `POST /auth/register` returns `201`, switch to the Login view and keep the confirmation visible there, so the visitor can log in immediately.
- A failed sign-up stays on Sign up with the error. A failed login stays on Login with the error.
- Switching views does not change session status. It does not clear a confirmation or error that still applies to the view being shown.
- During `loading`, neither form nor either switch control is shown.

The switch control's accessible name is the full sentence (`Don't have an account? Sign up` or `Already have an account? Log in`), so it does not collide with the submit buttons named `Create account` and `Log in`.

## Layout

Desktop is approximately 50/50 and fills the viewport:

- The left half is the authentication form on a white panel.
- The right half is the artwork panel.
- The form sits in a comfortable measure inside its half, vertically centered when it fits. It does not stretch across the full column width.
- The JobPilot name is real text in the form column, not on the artwork. The image is not a substitute for the name.

The split stays near half and half. Do not float a small card in a large empty page.

Artwork file: `apps/web/src/assets/auth-artwork.png`. Logo file: `apps/web/src/assets/logo.png`. Do not generate, download, or substitute a different illustration or logo.

## Visual direction

Establish these as the JobPilot design palette for this screen and for later UI improvements:

| Token | Hex |
| --- | --- |
| Primary | `#80A8FF` |
| Secondary | `#8EC1DE` |
| Accent | `#CEB5FF` |
| Mist | `#D3D3FF` |

Main background is white. The site typeface is Quicksand from Google Fonts. Load the weights the UI actually uses (at least 400, 500, and 600) and set Quicksand as the default font for the web app. Signed-in screens may inherit that font. Do not restyle their layout in this improvement.

Use the palette with intention:

- Hierarchy, accents, gradients, borders, focus states, buttons, subtle backgrounds, and branding.
- Most of the form surface stays white. Body text, labels, and helper text stay a dark neutral on white.
- Do not color every border, icon, and block. One primary accent and one quiet supporting tone are enough on the form.
- Error text stays a semantic danger color with sufficient contrast. Do not use the brand purples and blues as the only error signal.

### Final composition

These decisions are the implemented design. Keep them.

- Form on the left, artwork on the right, on a wide viewport.
- The artwork panel has a soft blended background of lightened Mist (`#D3D3FF`) and Accent (`#CEB5FF`), mixed toward white. The blend stays continuous. Do not use solid-color blocks or obvious hard color stops.
- The artwork stays at the reduced visual scale: about 85% of the size it would be if it covered the panel, centered, with its aspect ratio unchanged. The panel may clip the edges. Do not return it to a full-bleed cover crop, and do not stretch it.
- The form header is centered in the form column, above the Login or Sign up content, in this order:
  - the existing JobPilot logo at 70px × 70px
  - the word "JobPilot" in Quicksand, as a heading, centered under the logo
- A short rule in Secondary (`#8EC1DE`) may sit under the centered name. Do not left-align the logo or the name.
- The form panel is white, with an optional subtle Mist wash at the outer edge. The primary submit button uses Primary. If white text on `#80A8FF` fails WCAG AA, darken that same blue for the button fill and keep `#80A8FF` for borders and focus. Do not introduce a second unrelated palette.
- Inputs stay quiet: white fill, a Mist or Secondary border, and a Primary or Secondary focus ring.
- The switch sentence uses Primary for the action words only when that color meets contrast on white; otherwise the action is a dark neutral with a Primary underline or focus ring.

## Responsive behavior

Use a single breakpoint at 1024px.

At 1024px and above:

- Two columns, approximately 50/50, viewport height.
- No horizontal scrolling.
- If the viewport is too short for the form, the form column scrolls and the artwork stays in place.

Below 1024px:

- One column. The 50/50 split is not used.
- Order: a compact artwork header, then the form column.
- The header shows the same PNG at the same reduced scale, on the same soft Mist and Accent gradient. Cap the header around 32vh so the form starts on screen without a long scroll past the image.
- The logo and the centered "JobPilot" heading stay in the form column, above Login or Sign up. They are not overlaid on the artwork.
- The form is full width with comfortable horizontal padding, on white.
- The switch control stays with the form.
- No horizontal overflow. Inputs and buttons remain usable at 320px width.

## Accessibility

- WCAG 2.2 AA contrast for text and for interface controls. The four palette colors are light. Do not use them as small text on white, and do not use white text on them unless the pair meets 4.5:1 for normal text or 3:1 for large text and button labels.
- Focus is visible on inputs, the submit button, and the view-switch control.
- Each input has a visible label tied to it. Autocomplete stays `email` for both email fields, `new-password` on sign up, and `current-password` on login.
- The artwork and the logo are decorative because the name is real text. Give both images an empty alt (`alt=""`). Expose "JobPilot" as a heading in the form column, not only as pixels in the logo or the artwork.
- The view switch is a button or link that can be reached and activated by keyboard.
- Confirmation and errors are text, not color alone. Existing `role="alert"` behavior stays for errors.
- The loading state has text (`Restoring session…`) and is not announced as either form.
- If the view change animates, respect `prefers-reduced-motion`. An instant switch is acceptable.

## Scope

- Replace the side-by-side register and login cards with Login and Sign up views and the switch copy above.
- Apply the 50/50 desktop layout, the provided artwork at the reduced scale, the soft Mist and Accent artwork gradient, the existing 70px logo, the centered JobPilot heading, Quicksand, and the palette on the authentication screens.
- Set Quicksand as the web app's default font, and record the four colors as reusable CSS variables for later UI work.
- Keep the loading, signed-out, and signed-in session states and the auth API calls unchanged.
- Update existing Playwright helpers that register and then log in on one screen so they open Sign up, submit, and then use Login. Keep the auth assertions those tests already make.

## Out of scope

- Redesign of the signed-in page, profile, dashboard, jobs, resumes, tailored resume, or interview UI, beyond inheriting Quicksand.
- New authentication features: email verification, password reset, OAuth, MFA, account deletion, rate limiting, or account settings.
- A router, protected-route framework, or new URL paths for login and sign up.
- Changes to auth request bodies, status codes, cookies, token storage, CORS, or `packages/shared` schemas.
- API, database, MCP, or AI changes.
- Editing Phase 1–18 specs, `specs/requirements.md`, `specs/tech-stack.md`, `specs/roadmap.md`, or `specs/status.md`.
- Generating artwork or a different logo, or applying the palette as a full visual redesign of the rest of the site.

## Implementation constraints

- TypeScript strict mode stays on. Do not add `any` unless justified.
- Keep using React Hook Form, Zod schemas from `@jobpilot/shared`, and shadcn/ui. Do not duplicate the auth schemas.
- Do not add a routing dependency. View state can live in the existing auth page component.
- Do not put `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY` in the web app.
- Do not log passwords or tokens.
- Load Quicksand from Google Fonts. Do not add a font package unless the stylesheet approach cannot be used.
- Palette CSS variables may be global. Using them to restyle non-auth screens is not part of this spec.
- Prefer the smallest change that meets this spec. Do not introduce a design-system package.
- Existing end-to-end tests assume both forms are on the signed-out screen at once, including `apps/web/e2e/auth.spec.ts` and the other specs that click `Create account` and then `Log in`. Update those flows to switch views. Do not weaken assertions about status codes, `/auth/me`, the confirmation string, cookie flags, or token storage.
- The loading-state assertions must still pass: while `auth-loading` is visible, Email, Password, `Create account`, and `Log in` are absent.

## Acceptance criteria

- A signed-out visitor first sees Login, with `Don't have an account? Sign up`, and does not see the sign-up form.
- Activating that control shows Sign up, with `Already have an account? Log in`, and hides the login form.
- Activating the sign-up control returns to Login.
- Desktop layout at 1024px and above is approximately half form and half artwork. The artwork sits on a soft blended gradient of lightened `#D3D3FF` and `#CEB5FF`, at the reduced scale, with its aspect ratio preserved.
- The existing logo is centered above the form at 70px × 70px. "JobPilot" is centered below the logo and above Login or Sign up. Neither is left-aligned, and neither is overlaid on the artwork.
- Below 1024px the layout is one column: compact artwork header, then the form column with the same centered logo and heading, without horizontal scrolling.
- The provided PNG is the artwork. The form background is white. Quicksand is the font. The four palette colors are used with the restraint described above. Authentication behavior, API contracts, and validation stay as specified above.
- Text and controls meet the contrast rules in Accessibility.
- Session restoration still starts in `loading` and does not show either form until it finishes.
- Sign up still calls `POST /auth/register`, stays signed out on `201`, shows `Account created. You can log in.`, and then presents Login with that confirmation visible.
- Login still stores the access token, calls `GET /auth/me`, and enters `signed-in` only after `/auth/me` succeeds, showing that user's email.
- Invalid fields are still blocked by the shared Zod schemas. Duplicate email and a wrong password still show the API error strings.
- Logout, reload-while-signed-in, and the HttpOnly refresh cookie behave as they do today.
- No auth API contract, secret exposure, or signed-in product behavior changes.

## Validation checklist

Check these after implementation. Do not mark an item passed unless it was actually exercised.

- [ ] Login is the initial signed-out view and does not mount the sign-up form.
- [ ] `Don't have an account? Sign up` opens Sign up. `Already have an account? Log in` returns to Login. Neither control submits or calls the API.
- [ ] At a desktop width of at least 1024px, the screen is approximately 50/50. The artwork uses the reduced scale on a soft blended gradient of lightened `#D3D3FF` and `#CEB5FF`. The 70px logo and the "JobPilot" heading are centered in the form column.
- [ ] At a narrow width (about 375px, and a check near 320px), the artwork collapses to a short header, the logo and centered heading stay with the form, the form is usable, and the page does not scroll horizontally.
- [ ] The form background is white, type is Quicksand, and the palette is limited to accents, focus, borders, the button, a subtle form wash, and the artwork gradient.
- [ ] Button label and body text contrast meet WCAG 2.2 AA. Palette colors are not used as low-contrast text on white.
- [ ] Keyboard focus is visible on fields, submit, and the switch control. The artwork and logo alts are empty, and the name is a heading.
- [ ] Loading still exposes `auth-loading` and hides both forms until refresh settles.
- [ ] Register `201` stays signed out, shows `register-confirmation` with `Account created. You can log in.` on the Login view, and sets no refresh cookie.
- [ ] Login `200` then `GET /auth/me` enters `signed-in` and shows the `/auth/me` email.
- [ ] A short password and an invalid email show form errors and do not send the request. Duplicate email and a wrong password show the API error strings.
- [ ] `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including auth and the other flows that register and log in.
- [ ] `pnpm typecheck` passes.
- [ ] The web bundle and `apps/web/src` still contain no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
