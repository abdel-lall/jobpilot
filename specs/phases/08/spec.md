# Phase 8 — Jobs API

## Objective

Let a user save job postings and read dashboard status before any AI workflow exists.

## Scope

This phase adds only the jobs API described in the Phase 8 section of `specs/roadmap.md`:

- Create, read, update, and delete jobs owned by the authenticated user.
- Fields: company name, job title, job description, job location, and optional job URL.
- Every job response includes dashboard status: analysis current, tailored resume present, interview plan present, latest overall score, and readiness badge.
- At this phase every job has analysis not current, no resume, no plan, no score, and no badge.
- Deleting a job removes that job. Later phases extend this delete to child records they add.
- Zod schemas live in `packages/shared`.
- Business logic lives outside controllers.

The roadmap and `requirements.md` name the job fields and the five status values. They do not name columns, routes, length bounds, or the JSON shape. The contract below is the Phase 8 choice for those gaps.

`requirements.md` says creating a job runs analysis in that request. Phase 10 owns that behavior. The roadmap is explicit for this phase: creating a job stores the job and leaves analysis not current, and no model is called. Update, including a description change, also stores only the job fields and leaves status empty.

### Job record

`packages/database` gains one model, `Job`, in a new migration. `User` gains only the relation. Phase 3 auth models, Phase 5 profile models, and the Phase 7 `ResumeFile` model stay as they are. The Phase 2 `vector` extension stays in place. Do not edit the earlier migrations.

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `userId` | foreign key to `User`, `onDelete: Cascade`, indexed |
| `companyName` | `String` |
| `jobTitle` | `String` |
| `jobDescription` | `String` |
| `jobLocation` | `String` |
| `jobUrl` | `String?` |
| `createdAt` | `DateTime`, `@default(now())` |
| `updatedAt` | `DateTime`, `@updatedAt` |

There is no analysis, resume, plan, score, or badge column. Those status values are response fields assembled by the jobs service. They are not stored.

Duplicate company, title, and URL combinations are allowed. There is no uniqueness constraint beyond `id`.

### Dashboard status

Status is one object on every job JSON: create, list, get, and update. The list is the dashboard read. There is no separate `/dashboard` route.

```json
{
  "analysisCurrent": false,
  "tailoredResumePresent": false,
  "interviewPlanPresent": false,
  "latestOverallScore": null,
  "readinessBadge": null
}
```

Those five values are fixed for every job in this phase. Create, description update, and any other update leave them unchanged. The shared status schema accepts only these literals, so a response that reports an AI result does not match this phase's schema.

### Public job JSON

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "companyName": "Example Co",
  "jobTitle": "Engineer",
  "jobDescription": "Build APIs.",
  "jobLocation": "Remote",
  "jobUrl": "https://example.com/jobs/engineer",
  "status": {
    "analysisCurrent": false,
    "tailoredResumePresent": false,
    "interviewPlanPresent": false,
    "latestOverallScore": null,
    "readinessBadge": null
  },
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

`createdAt` and `updatedAt` are ISO-8601 datetimes. `jobUrl` is `null` when absent. Zod schemas for the status object, the public job, the create body, and the update body live in `packages/shared`. The API imports them from `@jobpilot/shared`.

Create bodies are `companyName`, `jobTitle`, `jobDescription`, `jobLocation`, and optional `jobUrl`. They omit `id`, `userId`, `status`, `createdAt`, and `updatedAt`. Update bodies are a partial of the create body and must include at least one field.

### HTTP

The user id comes only from the verified access token. Business logic lives outside controllers.

| Method and path | Success | Auth input |
| --- | --- | --- |
| `POST /jobs` | `201` with `{ "job": Job }` | JSON body and `Authorization: Bearer` |
| `GET /jobs` | `200` with `{ "jobs": Job[] }` | `Authorization: Bearer` |
| `GET /jobs/:id` | `200` with `{ "job": Job }` | `Authorization: Bearer` |
| `PATCH /jobs/:id` | `200` with `{ "job": Job }` | JSON body and `Authorization: Bearer` |
| `DELETE /jobs/:id` | `204` with an empty body | `Authorization: Bearer` |

`GET /jobs` is the list. It is ordered by `createdAt` ascending, then `id` ascending. It returns only the caller's rows. A caller with no jobs gets `{ "jobs": [] }` and `200`.

`GET /jobs/:id` is the single-job read. List and single read use the same job schema, including `status`.

Error bodies use `{ "error": string }`:

- Missing, malformed, expired, or otherwise invalid access token: `401` with `{ "error": "Unauthorized" }`.
- Invalid or missing job input: `400` with `{ "error": "Invalid input" }`.
- Get, update, or delete of an id that is missing, malformed, or owned by another user: `404` with `{ "error": "Not found" }`.

A missing record and another user's record return the same status and body. Do not echo the rejected body in the error JSON.

`GET /health`, the Phase 3 auth routes, the Phase 5 profile routes, and the Phase 7 resume routes stay unchanged.

### Validation

Use `.strict()` objects. A body that includes `id`, `userId`, `status`, `createdAt`, `updatedAt`, or any other unknown key is `400`.

Trim `companyName`, `jobTitle`, `jobDescription`, `jobLocation`, and `jobUrl`. After trim, length bounds are:

- `companyName`, `jobTitle`, and `jobLocation`: 1 through 200.
- `jobDescription`: 1 through 20000. Trim the ends only. Keep internal whitespace and newlines.
- `jobUrl`, when present: 1 through 500, and an absolute `http` or `https` URL. Use the same URL rule as `Project.url`.

A value that is empty after trimming is `400`. A create body must include `companyName`, `jobTitle`, `jobDescription`, and `jobLocation`. `jobUrl` may be omitted or `null`; both are stored as `null`.

A patch body must include at least one field. Omitted fields stay unchanged. `null` clears `jobUrl`. An empty object is `400`.

## Affected subsystems

- Jobs
- Dashboard, as the status object on each job. This phase does not add a dashboard page or a dashboard route.
- `apps/api`
- `packages/database`
- `packages/shared`

`apps/web` is not part of this phase. Phase 9 owns job screens and the dashboard shell.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 8:

- Job create, edit, and delete screens, and the dashboard page. Phase 9.
- Job analysis, a `JobAnalysis` table, LangGraph, Gemini calls, and replacing create or description-update with synchronous analysis. Phase 10. Before that phase, create and update store the job and leave analysis not current.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embeddings, vector indexes, and vector queries. Phase 12.
- Tailored resume JSON and clearing it when the description changes. Phases 13 and 14.
- Interview plans and clearing a plan when the description changes. Phase 15.
- Interview attempts, questions, scores, and the readiness badge value `"Interview Ready"`. Phases 16 through 18.
- Extending job delete to analysis, plan, tailored resume, and attempts. Those child records do not exist yet. Phase 18 owns the full cascade.
- A separate `GET /dashboard` resource, pagination, search, filters, and sorting controls.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or auth response bodies.
- Changing the Phase 5 profile schemas, tables, or HTTP contract.
- Changing the Phase 6 profile UI or the Phase 7 resume storage contract, routes, or profile page.
- Changing `apps/web`.
- Email verification, password reset, OAuth, MFA, account deletion, and rate limiting.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required job tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phase 3.

Phases 4 through 7 are merged. This phase does not change the web app, the profile API, or resume storage.

Phase 3 provides `POST /auth/register`, `POST /auth/login`, and `GET /auth/me`. Access tokens are HS256 JWTs with `sub` set to the user id and a 15-minute lifetime. Job routes reuse that access-token check. They do not accept a user id from the query string, the body, or a cookie.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 8, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Data model

- Add one Prisma model, `Job`, and one new migration. Do not edit `20260930120000_enable_vector`, `20261001050000_user_refresh_session`, `20261001140000_candidate_profile`, or `20261001180000_resume_file`.
- Do not add columns to `User`, `RefreshSession`, the Phase 5 profile models, or `ResumeFile`. A `jobs` relation on `User` is allowed because the foreign key lives on `Job`.
- Index `Job` on `userId`.
- Deleting a user deletes that user's jobs through `onDelete: Cascade`.
- Do not add a job-analysis table, a tailored-resume table, an interview-plan table, an attempt table, an embedding column, or a vector index.
- Store `jobDescription` as a PostgreSQL `String`. Enforce the 20000-character bound in Zod, not with a second table.

### API

- Keep route handlers thin. Zod parsing and HTTP status mapping stay at the controller boundary. Persistence and ownership checks live outside controllers.
- Resolve the user id only from the verified bearer token, using the same `401` contract as `GET /auth/me`.
- Create always sets `userId` from that token. It writes the five job fields and returns the stored row plus the fixed status object.
- List, get, update, and delete load rows with the token user id. A row owned by someone else is `404`, the same as a missing row.
- Attach the fixed status object in the jobs service after the row is loaded. Do not accept status from the client and do not persist it.
- `DELETE /jobs/:id` deletes that one `Job` row and returns `204`. It does not delete profile rows or resume files.
- Responses include `userId` and `status`. They never include a password, a password hash, a refresh token, or another user's jobs.
- Do not log job bodies, access tokens, refresh tokens, passwords, or `JWT_SECRET`.
- Do not import `@jobpilot/ai`. Do not read `GEMINI_API_KEY`. Do not call Gemini, LangChain, or LangGraph from create, read, update, or delete.
- `createApp()` must not require `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`. Importing and constructing the Express app must still work when those variables are unset, so the Phase 1 health test and CI stay green. Job routes may use `DATABASE_URL` and `JWT_SECRET` when they are invoked.
- Keep CORS as Phase 7 left it. `GET`, `POST`, `PATCH`, and `DELETE` are already allowed for `WEB_ORIGIN`. Do not use `Access-Control-Allow-Origin: *`. Do not change cookie attributes, profile routes, or resume routes.
- Do not add a dependency. Zod, Express, and Prisma are already available.

### Tests and runtime

- Add `apps/api/src/jobs.integration.test.ts`. The existing default Vitest config already excludes `*.integration.test.ts`. Add `apps/api/vitest.jobs.config.ts` and an `@jobpilot/api` script named `test:jobs`, following `test:profile`.
- Do not add `test:jobs` to root `pnpm test` or to GitHub Actions.
- Supertest uses the Compose database and a real `JWT_SECRET`. It unsets `GEMINI_API_KEY`. It covers:
  - create, list, get, partial update, and delete for one job
  - an empty list
  - a missing token
  - a validation failure, including a body that contains `userId` or `status`, a `jobUrl` that is not absolute `http` or `https`, a description that is empty after trim, and an empty patch
  - a list that hides another user's job
  - another user's get, update, and delete returning `404` with `{ "error": "Not found" }` while the owner's job remains
  - a malformed path id returning that same `404`
  - `jobUrl` omitted or `null` on create stored as `null`, a patch of `null` clearing `jobUrl`, and omitted patch fields staying unchanged
  - status on create, list, get, and update equal to the fixed empty object, including after a description change
  - create and description update succeeding with `GEMINI_API_KEY` unset
- The sample job is `companyName` `Example Co`, `jobTitle` `Engineer`, `jobDescription` `Build APIs.`, `jobLocation` `Remote`, and `jobUrl` `https://example.com/jobs/engineer`.
- Each test uses its own users and deletes those users afterward. Cascade removes the job rows. Tests do not add a delete-user route.
- `pnpm --filter @jobpilot/api test:auth`, `pnpm --filter @jobpilot/api test:profile`, and `pnpm --filter @jobpilot/api test:resumes` still pass. `pnpm test` and `pnpm typecheck` still pass. The Phase 2 database integration test still passes.
- Do not require Playwright. `apps/web` stays unchanged.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce a dashboard service, a status-calculator interface, or a model client for a later phase.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
