# Notes

The implementation review passed with no blocking, high, or medium issues and no required code changes. One low finding is recorded below. Validation then passed on 2026-10-04.

These choices match the approved spec:

- `assessInterviewReadiness` is a plain function in `apps/api/src/interview-attempt/readiness.ts`. It is not a LangGraph workflow and does not call a model, MCP, or the network. The overall score is `sum / 8`. The attempt passes only when the sum is at least `80 * 8` and every tested category sums to at least `70 *` its question count. Untested categories are ignored. The score is not rounded.
- `latestOverallScore` and `readinessBadge` are computed when a job response is built. No column or migration was added. The latest completed attempt is the `completed` row with the greatest `createdAt`, then the greatest `id`. An `in_progress` attempt is not eligible.
- `GET /jobs/:id/interview-attempts/current` and the answer route use the same attempt: the `in_progress` attempt when one exists, otherwise the latest completed attempt. A job with no attempt stays `404`.
- A completed attempt no longer blocks `POST /jobs/:id/interview-attempts`. The start path still rejects a missing or stale analysis, a missing or invalid plan, and an existing `in_progress` attempt, in that order. Every stored question text for the job is passed into question generation. A repeated normalized text returns `502` and writes nothing. Inside the write transaction, a second `in_progress` attempt is still `409`.
- The answer stub returns score 80 except when `answer` is exactly `fail`, which returns score 0. The question stub keeps `Stub ${category} question ${index}` until that normalized text is already avoided, then uses `retake N` starting at 2. Prompts and the Gemini models are unchanged.
- The dashboard shows `String(latestOverallScore)` or `Not available`, and `Interview Ready` or `Not available`. The attempt panel does not show an overall score or a badge. A completed attempt shows the existing `Start attempt` button. An in-progress attempt hides it. A successful answer whose attempt is `completed` refetches `["jobs", userId]`. Starting a retake does not clear that cache.
- Job delete still uses the existing foreign keys. A description change, a title-only update, and a plan replace do not delete attempts.
- No dependency or environment variable was added. `.github/workflows/ci.yml` is unchanged.

Accepted deviations:

- `readiness.test.ts` also checks that a short question list and a non-integer score throw. The spec requires that throw.
- The repeated-text `502` test checks that the attempt count stays 1. It does not re-read stored scores after the failure. Generation fails before any write, and the race test checks that the same attempt id remains.

The review noted this non-blocking finding:

- The latest-completed ordering is copied in `apps/api/src/jobs/service.ts` and `apps/api/src/interview-attempt/service.ts`. Both copies use the greatest `createdAt`, then the greatest `id`.

Unresolved:

- Live Gemini was not called.
- GitHub Actions was not executed.
- No browser test asserts that interview-attempt query keys were removed on sign-out or on a user-id change. Logout unmounts the signed-in shell, and `JobsQueryCache` removes those queries in the same effect that removes jobs, tailored-resume, and interview-plan queries.
