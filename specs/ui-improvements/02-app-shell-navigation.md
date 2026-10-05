# UI improvement 02 — Signed-in application shell

## Goal

Redesign the signed-in application shell so navigation feels cleaner and more app-like.

The signed-in page today is a single centered column: an account card, then a horizontal Profile / Dashboard switcher, then the selected content. This improvement replaces that chrome with a white header and a left sidebar. Profile and Dashboard content stay as they are.

This is a UI-improvement spec. It does not change Phases 1–18, and it does not change UI improvement 01.

## Current shell to replace

`SignedInPage` in `apps/web/src/pages/AuthPage.tsx` currently renders:

- A card titled `Signed in`, described as `Current account`, showing `data-testid="user-email"` and a `Log out` button.
- A horizontal nav, `data-testid="app-nav"`, with `nav-profile` (`Profile`) then `nav-dashboard` (`Dashboard`).
- The selected view underneath. The in-memory view starts as `profile` and returns to `profile` after reload. There is no router and no `/dashboard` or `/profile` URL.

Remove the account card. Do not replace it with another account card, email line, or “Signed in” heading.

The `/auth/me` email does not need to be displayed in the shell. Session code may still hold that user. Do not add a permanent email label to satisfy the old card.

## Header

Add a white header across the top of the signed-in application.

- Height about 70px.
- White background.
- Left: the existing logo, `apps/web/src/assets/logo.png`. Do not generate or substitute a different mark. Draw it at 60px × 60px and keep it vertically centered in the header. It stays smaller than the 70px auth-page logo and must not overflow the header.
- The logo is the only JobPilot name in the shell. Give the image the accessible name `JobPilot`.
- Right: one icon button that logs out.
- The icon must read as sign out or log out (a door or an arrow leaving a box). Do not use a generic close or trash icon.
- The button’s accessible name is exactly `Log out`, so existing controls that look up that name still find it.
- Draw the glyph slightly larger than the current 20px mark, about 24px.
- Paint the glyph a lighter neutral gray, about `#6B7280`, which is about 4.8:1 on white. Do not keep the current very dark `#172033` stroke, and do not paint it `#80A8FF` (about 2.3:1 on white).
- A soft shadow sits under the header so the white bar transitions into the light-gray content area: white header, then a short low-opacity shadow, then the gray region. Keep it subtle. Do not use a heavy border or a strong drop shadow as that separator.
- Logout still calls the existing `session.logout()` path: clear the in-memory access token immediately, `POST /auth/logout` with credentials, and enter `signed-out` whether the request succeeds or fails. A failed logout still surfaces its error on the signed-out screen. Do not keep a signed-in account card for that error.

## Sidebar navigation

Move Profile / Dashboard into a vertical sidebar.

- The sidebar sits on the left, directly under the header.
- Background `#3F5F9A` (dark blue).
- On the desktop sidebar, leave about 10px of that same `#3F5F9A` between the bottom of the white header and Dashboard. Dashboard does not touch the header. Do not insert a different color, a divider, or horizontal margin in that space.
- Slightly narrower than the current 112px desktop sidebar. Target about 96px.
- It is visually separate from the light-gray main content by that color change. Do not add a second card, a sidebar shadow system, or a brand-colored content panel.
- It contains two navigation buttons, in this order:
  1. Dashboard
  2. Profile

Each control is a compact square-style button:

- An icon centered above.
- The words `Dashboard` or `Profile` in small text below the icon.
- The visible label is real text, not only an icon and not only an `aria-label`.

`apps/web` has no icon library (no Lucide, Heroicons, Radix icons, or `react-icons`). Draw these marks as inline SVG. Do not add an icon dependency for this shell.

Suggested marks:

- Dashboard: a small grid or layout icon.
- Profile: a person icon.

Keep the existing hooks:

- `data-testid="app-nav"` on the sidebar navigation.
- `data-testid="nav-dashboard"` on Dashboard.
- `data-testid="nav-profile"` on Profile.
- `data-testid="signed-in"` on the signed-in shell.

Clicking a button still switches the in-memory view. It does not navigate to a URL and does not call the API. Do not add a routing library.

The selected view on sign-in, and after reload, remains Profile. Dashboard is listed first; Profile is the view that starts selected.

## Selected state

The current page’s button stands out. The other button stays quiet and clearly clickable.

- Sidebar background: `#3F5F9A`.
- Selected button fill: `#CEB5FF`.
- On the desktop sidebar, the selected fill spans the full sidebar width. No left or right margin, and no horizontal padding gap around that background. The selected area touches both sidebar edges. The about-10px space above Dashboard is sidebar background, not an inset of the selected fill. The icon and label may still have internal spacing inside the button.
- Unselected buttons do not use `#CEB5FF`. They stay on the dark-blue sidebar background. Do not put them on white chips.
- Selected icon and label use dark text, about `#172033`, on `#CEB5FF` (about 9:1).
- Unselected icon and label use white, or a near-white neutral, on `#3F5F9A`. White on that blue is about 6.3:1. `#172033` on `#3F5F9A` is about 2.6:1, so unselected marks and labels cannot stay that dark ink.
- The selected button exposes its state, for example `aria-current="page"`.
- Keyboard focus stays visible on both buttons and on Log out. On white and on `#CEB5FF`, reuse the signed-out focus treatment: a clear outline in the darkened primary blue already used for auth focus (`#6288DA` or the same `--jp` focus token). That blue is only about 1.8:1 on `#3F5F9A`, so on the dark sidebar use a light outline (white or near-white) that stays visible. Do not use a one-pixel gray ring that disappears on the sidebar or on the selected fill.

## Layout

The signed-in shell fills the viewport:

```text
[ 70px white header, soft shadow underneath         ]
[ 60px logo                                 logout ]

[ #3F5F9A     ] [ #F4F5F7 main content              ]
[ ~10px       ] [                                    ]
[ Dashboard   ] [ Profile or Dashboard content       ]
[ Profile     ] [                                    ]
```

- The header is full width and white, with the subtle shadow described above.
- Below it, the sidebar and the main region sit side by side. The main region is a very light neutral gray, `#F4F5F7`, and holds whichever view is selected. That gray is clearly not white and is not a dark or heavy field.
- Profile sections and the Dashboard render in that main region with their current behavior, fields, test ids, and requests. Leave those sections and their cards as they are, including their own white surfaces.
- Do not restyle job rows, resume panels, interview panels, or profile forms. A readable max width inside the gray region is fine so those existing blocks do not stretch across an ultrawide window.

## Responsive behavior

Use the same 1024px breakpoint as the authentication screens.

At 1024px and above:

- Stable left sidebar under the header, with about 10px of `#3F5F9A` between the header and Dashboard.
- Main content to the right.
- No horizontal scrolling.

Below 1024px:

- Keep the 70px white header, the logout button, and the same subtle header shadow.
- Keep the logo at 60px × 60px, vertically centered, when it fits without overflow. It fits at the widths below.
- Do not keep a wide sidebar beside the content if that causes horizontal overflow.
- Place the same two icon-and-label buttons in one compact row under the header. The bar uses `#3F5F9A`. Only the selected button uses `#CEB5FF`. Unselected icons and labels stay light on that blue, with the same contrast rule as the sidebar. The full-bleed selected fill applies to the vertical sidebar; the compact row must not overflow.
- Dashboard and Profile remain reachable without a drawer, a hamburger menu, or a routing library.
- Check about 375px and near 320px. The page does not scroll sideways, and the button labels stay visible. The logout control keeps the accessible name `Log out`.

## Preserve

Preserve all existing behavior:

- Authentication and session restoration, including `loading`, `signed-out`, and `signed-in`.
- Access token in memory only. Refresh cookie stays `HttpOnly`.
- Logout API behavior described above.
- Profile functionality and section order.
- Dashboard functionality, including jobs, tailored resumes, interview plans, interview attempts, scores, and readiness.
- React Query cache keys and the rule that one user’s cache is not shown to the next user.
- Existing API contracts. Do not change backend code, request bodies, status codes, or schemas for this visual improvement.
- Signed-out Login / Sign up screens from UI improvement 01, including artwork, logo placement on those screens, and Quicksand.

Quicksand and the palette from UI improvement 01 already apply to the app. Add `#3F5F9A` (dark blue) to that palette. Do not remove Primary (`#80A8FF`), Secondary (`#8EC1DE`), Accent (`#CEB5FF`), or Mist (`#D3D3FF`).

The shell uses color as follows:

| Use | Color |
| --- | --- |
| Header | White |
| Main content region | Very light neutral gray, `#F4F5F7` |
| Sidebar and narrow nav bar | `#3F5F9A` |
| Selected navigation button | `#CEB5FF` |
| Selected nav icon and label | Dark neutral, about `#172033` |
| Unselected nav icon and label | White or near-white on `#3F5F9A` |
| Logout icon | Lighter neutral gray, about `#6B7280`, on white |
| Focus outline | Darkened primary, about `#6288DA`, on white and on `#CEB5FF`; a light outline on `#3F5F9A` |

`#80A8FF` and `#8EC1DE` may appear only as a quiet focus or border accent where contrast allows. They are not the sidebar, the selected fill, or the logout icon. Profile and Dashboard cards stay as they are. Error text stays a semantic danger color. Mist remains in the palette for the signed-out screens; it is no longer the signed-in sidebar.

## Accessibility

- Log out has the accessible name `Log out`.
- Dashboard and Profile expose the visible words `Dashboard` and `Profile`. An icon is not a substitute for that text.
- The logo’s accessible name is `JobPilot`.
- Tab order is logo (if it is a link or button; otherwise it is not a tab stop), Log out, Dashboard, Profile, then the existing content controls. These shell controls are buttons, not headings.
- Focus is visible on Log out, Dashboard, and Profile.
- Contrast meets WCAG 2.2 AA for text and for icons used as controls. Selected labels and icons stay dark on `#CEB5FF`. Unselected labels and icons stay light on `#3F5F9A` (white is about 6.3:1). The logout icon stays the lighter gray on white (about `#6B7280`, about 4.8:1), with the accessible name `Log out`. Do not use `#80A8FF` or `#CEB5FF` as the icon or label color on white, and do not use `#172033` for unselected nav marks on `#3F5F9A`.
- The selected button is indicated in the accessibility tree, not only by color.

## Tests

Playwright currently expects a visible `user-email` and, in the jobs flow, the nav buttons’ text `Profile` and `Dashboard`, plus a button named `Log out`.

When this shell is implemented, update the web end-to-end tests that assert the removed account card. They must stop requiring a visible email, `Signed in`, or `Current account`. They must still prove:

- `signed-in` is shown after login.
- `app-nav`, `nav-dashboard`, and `nav-profile` exist, with visible text `Dashboard` and `Profile`.
- The button named `Log out` signs the user out.
- Switching views still shows profile sections or the dashboard, and a later user does not see the previous user’s jobs.

Do not delete coverage of logout, view switching, or session restoration in order to make the new layout pass.

## Out of scope

- Routing, URLs for Profile or Dashboard, and mobile drawer navigation.
- A new icon package.
- Changes to UI improvement 01, phase specs, API routes, database schema, or token storage.
- Redesign of profile forms, the job dashboard body, tailored-resume panels, or interview panels.
- Showing the email in a menu, tooltip, or replacement card.

## Acceptance criteria

- The signed-in header is about 70px tall and white, with a subtle shadow underneath into the light-gray content area.
- The existing JobPilot logo is on the left of the header at 60px × 60px, vertically centered.
- A logout icon button is on the right. The glyph is slightly larger than the previous 20px mark (about 24px), in a lighter neutral gray (about `#6B7280`). Its accessible name is `Log out`, and it still performs the current logout behavior.
- The `Signed in` / `Current account` / email / `Log out` card is gone and is not replaced by another account card.
- The user’s email is not permanently displayed in the shell.
- `#3F5F9A` is added to the JobPilot palette. Primary, Secondary, Accent, and Mist remain.
- A left sidebar uses `#3F5F9A` and is slightly narrower than the current 112px sidebar (about 96px). On desktop, about 10px of that sidebar color sits between the header and Dashboard. Dashboard does not touch the header.
- Dashboard and Profile are compact buttons with an icon above the small visible labels `Dashboard` and `Profile`, Dashboard first.
- The selected button uses `#CEB5FF` and, on the desktop sidebar, that fill touches both sidebar edges with no horizontal inset. The unselected button stays on `#3F5F9A` with light icon and label color.
- The signed-in main region between the sidebar and the header is `#F4F5F7`. Profile and Dashboard content and cards are unchanged.
- Signing in and reloading still open Profile. Choosing Dashboard or Profile still switches the existing content.
- Logout still returns to the signed-out screen.
- Jobs, tailored resumes, interview plans, attempts, scores, readiness, and profile editing behave as they do today.
- No backend or API contract changes.
- Below 1024px, the header stays white, the logo stays 60×60 when it fits, the compact nav bar uses `#3F5F9A` with `#CEB5FF` only on the selected item, Dashboard and Profile remain available, and the page does not scroll horizontally.
- Focus is visible, and icon buttons and nav labels meet the contrast rules above.
- No new icon dependency is added.

## Validation checklist

Check these after implementation. Do not mark an item passed unless it was actually exercised.

- [ ] At a desktop width of at least 1024px, the signed-in shell is a white header about 70px tall with a subtle shadow underneath, a `#3F5F9A` left sidebar about 96px wide (narrower than the previous 112px sidebar), and a `#F4F5F7` content region. Profile and Dashboard cards themselves are unchanged.
- [ ] `#3F5F9A` is present as a palette color, and `#80A8FF`, `#8EC1DE`, `#CEB5FF`, and `#D3D3FF` are still defined.
- [ ] The header shows `apps/web/src/assets/logo.png` on the left at 60px × 60px, vertically centered. The logo name is `JobPilot`. The logout glyph is about 24px and a lighter neutral gray (about `#6B7280`). The logout control’s accessible name is `Log out`.
- [ ] The account card is absent: no `Signed in` title, no `Current account` description, and no visible email.
- [ ] Sidebar order is Dashboard, then Profile. Each button shows an icon and the visible label. Only the selected button is filled `#CEB5FF`, and that fill touches both sidebar edges. About 10px of `#3F5F9A` sits between the header and Dashboard, with no horizontal inset. Unselected items sit on `#3F5F9A` with light icons and labels.
- [ ] After login and after reload, Profile is selected and the profile sections render. Dashboard shows the existing jobs UI. Switching back still shows the profile.
- [ ] Keyboard focus is visible on Log out, Dashboard, and Profile, including on `#3F5F9A`. Selected labels and icons stay dark on `#CEB5FF`. Unselected labels and icons stay light on `#3F5F9A`. The logout icon stays the lighter gray on white.
- [ ] At about 375px and near 320px, the header stays white, the logo stays 60×60, the compact nav bar uses `#3F5F9A` with `#CEB5FF` only on the selected item, Dashboard and Profile stay reachable with their labels, and the page does not scroll horizontally.
- [ ] Log out still clears the session immediately, calls `POST /auth/logout` with credentials, and shows the signed-out screen. A logout failure still shows the existing signed-out error.
- [ ] A second user in the same document does not see the previous user’s jobs or profile data.
- [ ] Signed-out Login and Sign up still match UI improvement 01.
- [ ] `pnpm typecheck` passes.
- [ ] The relevant web Playwright flows pass, including auth, profile, and jobs, after expectations for the removed account card are updated.
- [ ] The web bundle and `apps/web/src` still contain no `JWT_SECRET`, `DATABASE_URL`, or `GEMINI_API_KEY`.
- [ ] No API, database, or phase-spec files change for this improvement.
