# Notes

The implementation review passed with no blocking, high, or medium issues and no required code changes. Validation then passed on 2026-10-04.

These choices match the approved spec:

- The job screen is a panel on the Phase 9 dashboard row. There is no routing library and no resume URL. One `openJobId` keeps a single panel open. Profile, logout, and delete unmount it.
- The resume query key is `["tailored-resume", userId, jobId]`. The query reads the current in-memory access token and runs only while the panel is mounted and a token is present.
- `404` with `{ "error": "Not found" }` is the empty state `No tailored resume yet.` Any other failed GET shows the API error string, or `Request failed`.
- The response envelope is a strict `{ resume: tailoredResumeSchema }` object. The resume schema comes from `@jobpilot/shared`. A body that fails parsing shows `Request failed` and leaves the previous panel body.
- `Generate resume` posts `{}`. A successful response replaces the open panel and refetches `GET /jobs`. A failed POST, including `502` with `{ "error": "Resume generation failed" }`, leaves the previous body in place.
- A successful job save refetches `GET /jobs` and, when that row's panel is open, refetches its resume query. The dashboard flag reads `status.tailoredResumePresent`: `Present` or `Not available`. Plan, score, and readiness stay `Not available`.
- Signed-out removes tailored-resume queries from the in-memory TanStack Query client, and a user-id change removes the previous user's queries. The cache is not persisted.
- No dependency, API route, shared schema, migration, or GitHub Actions workflow was added.

Accepted deviations:

- The resume query uses `retry: false` and `refetchOnWindowFocus: false`, the same settings as the jobs query.
- `{ resume: tailoredResumeSchema }` is checked with a strict Zod object in the web app. The resume schema itself still comes from `@jobpilot/shared`.
- `readJsonBody` is local to the resume client, in the same form as the jobs client.
- Generate and load errors render as plain text inside the panel. The empty state is a `<p>`, not an alert.

The review noted two non-blocking behaviors:

- If the panel is closed when the description is saved, the cached resume can remain until the next open refetches and receives `404`.
- A generate error stays in the panel until the next generate attempt, including after a later job save replaces the document.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
