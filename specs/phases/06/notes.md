# Notes

No behavior departs from the approved spec. These choices match that spec:

- Skill forms use the shared skill schemas directly. Education, experience, project, and certification forms keep browser field values, normalize them, and validate with the Phase 5 schemas. An edit checks the full record with the shared create schema, then sends the body parsed by the matching update schema. The update schemas do not include the date-order check. The create schema does, so an end date before the start date is rejected before the request, without copying the schemas.
- Each list query sets `retry: false` and `refetchOnWindowFocus: false`. A failed list shows the API error on the first response. Create, edit, delete, and a new page load still refetch that section.
- No dependencies were added. The textarea is a local shadcn/ui component. `apps/api`, `packages/shared`, `packages/database`, and GitHub Actions are unchanged.

Non-blocking review findings. No mandatory follow-up:

- The browser tests do not submit an end date before the start date, split accomplishment lines, or clear a date that was previously set. Those paths are implemented.
- Each section in the create, edit, and delete test has one row, so the browser suite does not assert order across multiple rows. The UI renders the refetched array in API order.

The review found no required code changes.
