# Notes

No behavior departs from the approved spec. These choices match that spec and the approved plan:

- The absolute `http`/`https` check is copied into `packages/shared/src/job.ts`. It is the same rule as `Project.url`. The profile schemas are unchanged.
- Status is a fixed object assembled in the jobs service. It is not a database column, and the client cannot send it.
- `test:jobs` also checks list order and that deleting a job leaves a profile skill and a resume row in place. Both are Phase 8 acceptance criteria. The test calls the existing profile and resume routes. It does not add Phase 9 or later behavior.
- The `Job.userId` foreign key uses `ON DELETE CASCADE` and Prisma's default `ON UPDATE CASCADE`, matching the earlier user foreign keys.

Non-blocking review findings. No mandatory follow-up:

- A malformed or expired bearer token on a jobs route is not given its own assertion. The routes use the same access-token check as `GET /auth/me`, and the jobs test covers a missing token.
- Length bounds and keeping internal description whitespace are not given their own assertion. Zod trims the ends and enforces 1–200 and 1–20000.
- `createdAt` as the primary sort when timestamps differ is not given its own assertion. The query orders by `createdAt` then `id`, and the test covers the `id` tie-break.
- Resume bytes on disk after job delete are not asserted. The test shows the resume row remains, and delete removes only that `Job` row.

The review found no required code changes.
