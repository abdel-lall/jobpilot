# Phase 5 — Candidate profile API

## Objective

Store the structured profile that later becomes the only source of candidate facts.

## Scope

This phase adds only the candidate profile API described in the Phase 5 section of `specs/roadmap.md`:

- Create, list, update, and delete skills, education, work experience, projects, and certifications.
- Every query is scoped to the authenticated user. The user id comes only from the verified access token.
- Zod schemas for these records live in `packages/shared`.
- Business logic lives outside controllers.
- `packages/database` gains only these five profile models, in a new migration. `User` and `RefreshSession` columns stay as Phase 3 defined them. The Phase 2 `vector` extension stays in place.

`requirements.md` and the roadmap name the five record types and do not list columns. The fields below are the Phase 5 contract. They are the facts a later resume must be able to cite, and nothing else: names, institutions, employers, job titles, dates, accomplishments, technologies, and a project URL. Accomplishments and descriptions are plain text. There is no separate metrics field.

Every record has `id` (`String`, `@id`, `@default(uuid())`), `userId` (foreign key to `User`, `onDelete: Cascade`), `createdAt` (`DateTime`, `@default(now())`), and `updatedAt` (`DateTime`, `@updatedAt`).

| Model | Fields besides id, userId, and timestamps |
| --- | --- |
| `Skill` | `name` |
| `Education` | `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate` |
| `WorkExperience` | `employer`, `jobTitle`, `startDate`, `endDate`, `accomplishments`, `technologies` |
| `Project` | `name`, `description`, `url`, `startDate`, `endDate`, `accomplishments`, `technologies` |
| `Certification` | `name`, `issuer`, `issuedOn`, `expiresOn` |

`startDate`, `endDate`, `issuedOn`, and `expiresOn` are calendar dates. Nullable dates are `endDate`, `url`, `startDate` on `Project`, `endDate` on `Project`, and `expiresOn`. A null end date means the record is ongoing. `WorkExperience.accomplishments` has at least one item. `Project.accomplishments` and both `technologies` lists may be empty.

The HTTP contract for this phase is:

| Method and path | Success | Auth input |
| --- | --- | --- |
| `POST /profile/skills` | `201` with `{ "skill": Skill }` | JSON body and `Authorization: Bearer` |
| `GET /profile/skills` | `200` with `{ "skills": Skill[] }` | `Authorization: Bearer` |
| `PATCH /profile/skills/:id` | `200` with `{ "skill": Skill }` | JSON body and `Authorization: Bearer` |
| `DELETE /profile/skills/:id` | `204` with an empty body | `Authorization: Bearer` |
| `POST /profile/education` | `201` with `{ "education": Education }` | JSON body and `Authorization: Bearer` |
| `GET /profile/education` | `200` with `{ "education": Education[] }` | `Authorization: Bearer` |
| `PATCH /profile/education/:id` | `200` with `{ "education": Education }` | JSON body and `Authorization: Bearer` |
| `DELETE /profile/education/:id` | `204` with an empty body | `Authorization: Bearer` |
| `POST /profile/experience` | `201` with `{ "experience": WorkExperience }` | JSON body and `Authorization: Bearer` |
| `GET /profile/experience` | `200` with `{ "experience": WorkExperience[] }` | `Authorization: Bearer` |
| `PATCH /profile/experience/:id` | `200` with `{ "experience": WorkExperience }` | JSON body and `Authorization: Bearer` |
| `DELETE /profile/experience/:id` | `204` with an empty body | `Authorization: Bearer` |
| `POST /profile/projects` | `201` with `{ "project": Project }` | JSON body and `Authorization: Bearer` |
| `GET /profile/projects` | `200` with `{ "projects": Project[] }` | `Authorization: Bearer` |
| `PATCH /profile/projects/:id` | `200` with `{ "project": Project }` | JSON body and `Authorization: Bearer` |
| `DELETE /profile/projects/:id` | `204` with an empty body | `Authorization: Bearer` |
| `POST /profile/certifications` | `201` with `{ "certification": Certification }` | JSON body and `Authorization: Bearer` |
| `GET /profile/certifications` | `200` with `{ "certifications": Certification[] }` | `Authorization: Bearer` |
| `PATCH /profile/certifications/:id` | `200` with `{ "certification": Certification }` | JSON body and `Authorization: Bearer` |
| `DELETE /profile/certifications/:id` | `204` with an empty body | `Authorization: Bearer` |

`GET` is the only read. There is no `GET` by id. For education and experience, `GET` returns an array under `education` or `experience`, and `POST` or `PATCH` returns one object under the same key.

`GET /health` and the Phase 3 auth routes stay unchanged.

Public record JSON uses these shapes. Dates are `YYYY-MM-DD`. Timestamps are ISO-8601 datetimes. `accomplishments` and `technologies` are stored in the trimmed input order. They are not sorted or deduplicated.

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "name": "TypeScript",
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "institution": "State University",
  "degree": "B.S.",
  "fieldOfStudy": "Computer Science",
  "startDate": "2016-09-01",
  "endDate": "2020-05-15",
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "employer": "Example Co",
  "jobTitle": "Engineer",
  "startDate": "2021-01-04",
  "endDate": null,
  "accomplishments": ["Shipped the billing service"],
  "technologies": ["TypeScript", "PostgreSQL"],
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "name": "JobPilot",
  "description": "A job application assistant.",
  "url": "https://example.com/jobpilot",
  "startDate": "2024-02-01",
  "endDate": null,
  "accomplishments": [],
  "technologies": ["React"],
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "name": "AWS Cloud Practitioner",
  "issuer": "Amazon Web Services",
  "issuedOn": "2023-06-01",
  "expiresOn": null,
  "createdAt": "<datetime>",
  "updatedAt": "<datetime>"
}
```

Create bodies are those fields without `id`, `userId`, `createdAt`, and `updatedAt`. Update bodies are a partial of the create body and must include at least one field.

Error bodies use `{ "error": string }`:

- Missing, malformed, expired, or otherwise invalid access token: `401` with `{ "error": "Unauthorized" }`.
- Invalid or missing profile input, including a patch whose merged date range is invalid: `400` with `{ "error": "Invalid input" }`.
- Update or delete of an id that is missing, malformed, or owned by another user: `404` with `{ "error": "Not found" }`.

A missing record and another user's record return the same status and body.

## Affected subsystems

- Candidate profile
- `apps/api`
- `packages/database`
- `packages/shared`

`apps/web` is not part of this phase. Phase 6 owns the profile UI.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 5:

- Profile pages, profile forms, and TanStack Query lists. Phase 6.
- Resume file upload, download, delete, local disk storage, and resume-file metadata. Phase 7.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, Gemini calls, embeddings, or a model client. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools and Streamable HTTP, including `get_candidate_profile` and `get_project_details`. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and vector queries. Phase 12. This phase does not query pgvector and does not add a vector column.
- A single-record `GET` route. List is the read for this phase.
- Pagination, sorting controls, full-text search, and uniqueness of skill names or certification names.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or auth response bodies.
- Changing the Phase 4 authentication UI.
- Email verification, password reset, OAuth, MFA, account deletion, and rate limiting.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required profile tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phase 3.

Phase 4 is merged and provides the browser session, but this phase does not change the web app.

Phase 3 provides `POST /auth/register`, `POST /auth/login`, and `GET /auth/me`. Access tokens are HS256 JWTs with `sub` set to the user id and a 15-minute lifetime. Profile routes reuse that access-token check. They do not accept a user id from the query string, the body, or a cookie.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 5, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Data model

- Add five Prisma models and one new migration. Do not edit `20260930120000_enable_vector` or `20261001050000_user_refresh_session`.
- Do not add columns to `User` or `RefreshSession`. Relation fields on `User` are allowed because the foreign keys live on the profile tables.
- Store `accomplishments` and `technologies` as PostgreSQL `String[]`. Do not add join tables.
- Store calendar dates as `@db.Date`. Store `url` as an optional `String`.
- Index each profile table on `userId`.
- Deleting a user deletes that user's profile rows through `onDelete: Cascade`.
- Do not add an embedding column, a vector index, or a resume-file table.

### Validation

- Put create, update, and public record schemas for all five types in `packages/shared`. The API imports them from `@jobpilot/shared`. `packages/shared` already depends on `zod`.
- Use `.strict()` objects. A body that includes `id`, `userId`, `createdAt`, `updatedAt`, or any other unknown key is `400`.
- Trim required strings. After trim, length bounds are: `Skill.name` and each technology 1 through 80; `Education.institution`, `Education.degree`, `Education.fieldOfStudy`, `WorkExperience.employer`, `WorkExperience.jobTitle`, `Project.name`, `Certification.name`, and `Certification.issuer` 1 through 200; `Project.description` 1 through 2000; each accomplishment 1 through 500; `Project.url` 1 through 500 when present.
- `WorkExperience.accomplishments` has 1 through 20 items. `Project.accomplishments` has 0 through 20 items. Each `technologies` array has 0 through 30 items.
- Trim every accomplishment and technology string before storage. Length bounds and the empty-item check apply to the trimmed value. An entry that is empty after trimming is `400`. Preserve the resulting array order. Do not sort the array and do not remove duplicates.
- Calendar dates match `YYYY-MM-DD` and are real dates. Create validates date relationships from the create body. When both ends of a range are present, the end is on or after the start. This applies to education, experience, and projects, and to `expiresOn` against `issuedOn`.
- Patch validates the patch body shape first. After ownership is established, merge the supplied patch fields with the existing stored record, then validate date relationships against those merged values before updating. This is required even when the patch includes only one side of a range. An invalid merged range is `400` with `{ "error": "Invalid input" }`, and the stored row stays unchanged. Examples: a `startDate` later than the existing `endDate`, an `endDate` earlier than the existing `startDate`, and an `issuedOn` later than the existing `expiresOn`.
- `Project.url`, when present, is an absolute `http` or `https` URL.
- A create body must include every required field. A nullable field may be `null` or omitted. Omitted nullable fields are stored as `null`.
- A patch body must include at least one field. Omitted fields stay unchanged. `null` clears a nullable field. An empty object is `400`.
- Do not echo the rejected body in the error JSON.

### Profile behavior

- Keep route handlers thin. Zod parsing and HTTP status mapping stay at the controller boundary. Persistence and ownership checks live outside controllers.
- Resolve the user id only from the verified bearer token, using the same `401` contract as `GET /auth/me`.
- Create always sets `userId` from that token.
- List returns only that user's rows, ordered by `createdAt` ascending and then `id` ascending. A user with no rows gets an empty array and `200`.
- Update and delete load the row with both the path `id` and the token user id. A row owned by someone else is `404`, the same as a missing row. Ownership checks stay outside controllers. A patch merges and validates the date range only after that ownership check, and only then writes.
- Responses include `userId`. They never include a password, a password hash, a refresh token, or another user's records.
- Do not log profile bodies, access tokens, or `JWT_SECRET`.

### Runtime and tests

- `createApp()` must not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app must still work when those variables are unset, so the Phase 1 health test and CI stay green. Profile routes may use those variables when they are invoked.
- Extend `Access-Control-Allow-Methods` to `GET, POST, PATCH, DELETE, OPTIONS`. Keep credentialed CORS limited to `WEB_ORIGIN`. Do not use `Access-Control-Allow-Origin: *`. Do not change cookie attributes.
- The Phase 3 auth Supertest still passes, including the credentialed CORS preflight for `POST`.
- Add a Supertest file that is excluded from the default Vitest run, following the Phase 3 `*.integration.test.ts` exclusion. Add an `@jobpilot/api` script named `test:profile` that runs only that file against the Compose database and a real `JWT_SECRET`.
- The profile tests cover, for each of the five record types: create, list, partial update, delete, a validation failure, an empty list, a missing token, a list that hides another user's row, and an update and delete of another user's id returning `404`. They also cover a patch that clears a nullable field, a rejected `userId` in the body, and a preflight for `PATCH` and `DELETE` from `WEB_ORIGIN`.
- The profile tests cover a partial date patch that makes the merged range invalid: a `startDate` later than the stored `endDate`, an `endDate` earlier than the stored `startDate`, and an `issuedOn` later than the stored `expiresOn`. Each returns `400` with `{ "error": "Invalid input" }` and leaves the stored row unchanged.
- The profile tests cover accomplishment and technology persistence: surrounding spaces are removed, the stored array equals the trimmed input in the same order, a duplicated trimmed value is kept, and an item that trims to empty is `400`.
- Each test uses its own users and deletes those users afterward. Cascade removes the profile rows.
- `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset. `pnpm typecheck` still passes. The Phase 2 database integration test still passes.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow. Do not require the Phase 4 Playwright suite for this phase, because `apps/web` stays unchanged.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless this phase directly requires them.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
