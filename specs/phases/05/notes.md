# Notes

No behavior departs from the approved spec. These choices match that spec:

- Path ids are opaque lookup values. A malformed id, a missing id, and another user's id all return `404` and `{ "error": "Not found" }`.
- Create-time date checks live in the Zod schemas. Merged patch date checks run in the service after the ownership lookup and before the write.
- Unexpected failures return `500` and `{ "error": "Internal server error" }`, the same shape as the Phase 3 auth routes. The Phase 5 contract does not define a `500` body.
- Each record type has its own route and service functions.
- Profile foreign keys use `ON DELETE CASCADE` and Prisma's default `ON UPDATE CASCADE`, matching the Phase 3 `RefreshSession` foreign key.

Non-blocking review findings. No mandatory follow-up:

- The list query orders by `createdAt` ascending, then `id`. The test forces equal timestamps and asserts the `id` tie-break.
- An accomplishment that trims to empty is rejected in the stored-array test. A technology item uses the same trimmed-string rule and is not given its own empty-item case.
- Profile routes use the same bearer check as `GET /auth/me`. The profile tests call that path with a missing token only.
- A foreign id is rejected for ownership before the merged date range is checked. The cross-user tests send a valid patch.

The review found no required code changes.
