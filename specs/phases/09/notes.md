# Notes

No behavior departs from the approved spec. These choices match that spec:

- The dashboard reads `analysisCurrent`, `tailoredResumePresent`, `interviewPlanPresent`, `latestOverallScore`, and `readinessBadge` from the parsed job and shows each as `Not available`. `jobStatusSchema` only allows that Phase 8 status.
- Create and update responses are parsed with `jobSchema` and are not rendered. The dashboard refetches `GET /jobs`.
- A blank Job URL stays an empty string in the form. Create omits `jobUrl`. Edit sends `jobUrl: null`. `createJobBodySchema` or `updateJobBodySchema` then validates that object.
- The jobs query cache, form resolver, and request-error helper follow the profile UI. List queries set `retry: false` and `refetchOnWindowFocus: false`. Create, edit, delete, and opening Dashboard still fetch jobs.
- No dependencies were added. `apps/api`, `packages/shared`, `packages/database`, and GitHub Actions are unchanged.

Non-blocking review findings. No mandatory follow-up:

- Playwright does not submit a blank Job URL on create, click `Cancel`, or stub a list body that fails `jobSchema`. Those paths are implemented. The cleared-URL edit asserts `jobUrl: null`.
- The browser test does not read the query key. `jobsQueryKey` is `["jobs", userId]`, and the user-switch test shows user B does not see user A's company.

The review found no required code changes.
