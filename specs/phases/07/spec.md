# Phase 7 — Resume file storage

## Objective

Store uploaded resume files for the owner without parsing them.

## Scope

This phase adds only the resume file storage described in the Phase 7 section of `specs/roadmap.md`:

- Upload, list, download, and delete resume files for the authenticated owner.
- File bytes are stored on local disk. PostgreSQL stores metadata and the storage location.
- Download and delete are limited to the owner.
- Uploaded files are not parsed, embedded, or exposed through an AI interface.
- The signed-in profile page lists the owner's files and can upload, download, and delete them.

The roadmap and `requirements.md` say these files are stored only. They do not name columns, routes, size limits, or allowed types. The contract below is the Phase 7 choice for those gaps. It is storage metadata, not candidate facts. The Phase 5 profile records remain the only structured candidate data.

### Metadata

`packages/database` gains one model, `ResumeFile`, in a new migration. `User` gains only the relation. Phase 5 profile models and the Phase 3 auth models stay as they are. The Phase 2 `vector` extension stays in place.

| Field | Type |
| --- | --- |
| `id` | `String`, `@id`, `@default(uuid())` |
| `userId` | foreign key to `User`, `onDelete: Cascade`, indexed |
| `fileName` | `String`. The sanitized original basename |
| `contentType` | `String`. Always `application/pdf` |
| `byteSize` | `Int`. The stored byte length |
| `storagePath` | `String`. The absolute path of the file on local disk |
| `createdAt` | `DateTime`, `@default(now())` |

There is no `updatedAt`. There is no replace or update. Uploading again creates another row and another file.

`storagePath` is server-only. Public JSON does not include it, the directory, or the file bytes.

```json
{
  "id": "<uuid>",
  "userId": "<uuid>",
  "fileName": "phase7-resume.pdf",
  "contentType": "application/pdf",
  "byteSize": 19,
  "createdAt": "<datetime>"
}
```

`createdAt` is an ISO-8601 datetime. `byteSize` is a JSON number. Zod schemas for this object live in `packages/shared`. The upload itself is multipart, not a JSON body, so there is no create-body schema.

### HTTP

The user id comes only from the verified access token. Business logic lives outside controllers.

| Method and path | Success | Auth input |
| --- | --- | --- |
| `POST /profile/resumes` | `201` with `{ "resumeFile": ResumeFile }` | multipart field `file` and `Authorization: Bearer` |
| `GET /profile/resumes` | `200` with `{ "resumeFiles": ResumeFile[] }` | `Authorization: Bearer` |
| `GET /profile/resumes/:id` | `200` with the stored bytes | `Authorization: Bearer` |
| `DELETE /profile/resumes/:id` | `204` with an empty body | `Authorization: Bearer` |

`GET /profile/resumes` is the list. `GET /profile/resumes/:id` is the download. The list is ordered by `createdAt` ascending, then `id` ascending. It returns only the caller's rows.

Download sets `Content-Type` to the stored `contentType` and `Content-Disposition` to `attachment; filename="<fileName>"`. The body is the stored bytes, unchanged. It is not JSON.

Error bodies use `{ "error": string }`:

- Missing, malformed, expired, or otherwise invalid access token: `401` with `{ "error": "Unauthorized" }`.
- Missing file, empty file, more than one file, a field name other than `file`, a name that fails the filename rule, a content type other than `application/pdf`, or a file larger than 5 MiB (5,242,880 bytes): `400` with `{ "error": "Invalid input" }`.
- Download or delete of an id that is missing, malformed, or owned by another user: `404` with `{ "error": "Not found" }`.
- Delete whose stored path is outside `RESUME_STORAGE_DIR`, or whose unlink fails for a reason other than an already-absent file: `500` with `{ "error": "Internal server error" }`. The `ResumeFile` row stays.

A missing record and another user's record return the same status and body. A rejected upload creates no row and leaves no file under the storage directory.

`GET /health`, the Phase 3 auth routes, and the Phase 5 profile routes stay unchanged.

### What may be uploaded

One PDF per request. The multipart part's content type is `application/pdf`, and the basename ends with `.pdf` in any letter case. The stored bytes are whatever bytes arrived. This phase does not check PDF structure and does not extract text.

The stored `fileName` is the basename only. It must match `^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.pdf$` case-insensitively. Names with a directory, `..`, spaces, or other characters are `400`. The on-disk name is `<id>.pdf`, not the original name.

The maximum accepted size is 5 MiB. There is no cap on how many files an owner may store.

### Local disk

Bytes go under `RESUME_STORAGE_DIR`. That variable is required for these routes. The API does not fall back to another directory. A missing variable, or a path that cannot be created or written, is `500` with `{ "error": "Internal server error" }`.

Each file is `<RESUME_STORAGE_DIR>/<userId>/<id>.pdf`. The API creates those directories. `storagePath` is that absolute path. Download and delete resolve the stored path and refuse a path outside `RESUME_STORAGE_DIR`.

`DELETE /profile/resumes/:id` runs in this order:

1. Load the `ResumeFile` by `id` and the authenticated user. A missing or other user's row is `404` with `{ "error": "Not found" }`, as above.
2. Validate that its `storagePath` is inside `RESUME_STORAGE_DIR`. If it is not, return `500` with `{ "error": "Internal server error" }` and keep the row. Do not unlink.
3. Attempt to unlink the stored file.
   - If the file is already absent (`ENOENT`), continue.
   - If unlink fails for another reason, return `500` with `{ "error": "Internal server error" }` and keep the `ResumeFile` row.
4. After the unlink succeeds, or the file was already absent, delete the `ResumeFile` row.
5. Return `204`.

Filesystem deletion and PostgreSQL deletion cannot be one atomic transaction. If the disk unlink succeeds but the later database delete unexpectedly fails, Phase 7 does not implement file restoration or a reconciliation worker. It does not add a queue, a cleanup worker, or a storage abstraction for that case.

Deleting a `User` through Prisma cascades the `ResumeFile` row and does not unlink the file. This phase does not add a user-deletion hook. Tests delete the resume through the API before deleting the user.

Compose sets `RESUME_STORAGE_DIR` to `/var/lib/jobpilot/resumes` and mounts a named volume there. The web service does not receive that variable.

### Profile page

Add one section after Certifications, on the same signed-in page. Heading text is `Resumes`. `data-testid` is `profile-resumes`.

The five Phase 6 sections stay in their current order and behavior. Their headings remain the first five headings, so existing Playwright heading checks still match. The resume section does not delay `signed-in`, and it does not render during `loading` or `signed-out`.

The section uses one TanStack Query list for `GET /profile/resumes`. The query key is that path and the `/auth/me` user id. It does not include the access token. The query function reads the in-memory token. Disable the query when the token is missing. Do not persist the cache. Entering `signed-out`, or a user id change in the same document, removes cached resume queries the same way Phase 6 removes cached profile queries.

While the first list request is pending and the section has no successful list data yet, show `Loading resumes…` on `data-testid="profile-resumes-loading"` and do not show the empty state. A later refetch keeps the current rows visible. The empty state is exactly `No resumes yet.` on `data-testid="profile-resumes-empty"`, and only after a successful empty list. A failed list shows the API `error` string, or `Request failed` when the body has no `error` string, and does not show the empty state.

The upload control is a file input and a button named `Upload resume`. Choosing a file does not upload until that button is used. The request is `multipart/form-data` with the field name `file`, sent to `VITE_API_ORIGIN` with `credentials: "include"` and `Authorization: Bearer`. After a successful upload, clear the input and refetch the list. A failed upload shows the API `error` string in the section and leaves the previous list in place.

Each row shows `fileName`. It does not show `userId`, `storagePath`, or the file bytes. `Download resume` fetches `GET /profile/resumes/:id` with the bearer token and credentials, then saves that response body under `fileName`. `Delete resume` sends `DELETE` immediately, with no confirmation dialog, then refetches. There is no edit form.

Parse list and create payloads with the shared resume-file schema before rendering. A payload that does not match shows `Request failed` and does not render partial rows.

## Affected subsystems

- Candidate profile
- File storage
- `apps/api`
- `apps/web`
- `packages/database`
- `packages/shared`
- Local Docker runtime, for the storage directory and its volume

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 7:

- Parsing, text extraction, OCR, embeddings, or any use of an uploaded file as candidate facts. Uploaded files stay stored and unused by AI.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, Gemini calls, embeddings, or a model client. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and vector queries. Phase 12.
- Tailored resume JSON. Phases 13 and 14. Those are database rows, not files.
- An S3 adapter, AWS deployment, or a storage interface with a second backend. The roadmap keeps uploads on local disk.
- A user-deletion hook that unlinks files after a Prisma cascade.
- Replace, rename, PATCH, a file-count cap, image or Word uploads, and virus scanning.
- Account settings, email verification, password reset, OAuth, MFA, account deletion, and rate limiting.
- A client refresh that runs when a resume request returns `401`. Session restoration stays the Phase 4 load-time `POST /auth/refresh`.
- Changing the Phase 3 token lifetimes, hashing, session rotation, status codes, or auth response bodies.
- Changing the Phase 5 profile schemas, tables, or HTTP contract, or the Phase 6 profile section behavior.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service or a Playwright job. Required browser tests run locally against Compose. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phases 5 and 6.

Phase 5 provides owner-scoped profile routes, bearer auth, `{ "error": string }` bodies, and the rule that another user's id is `404`. Resume routes follow that pattern. They do not change the five profile resources.

Phase 6 provides the signed-in page, the in-memory access token, TanStack Query, and logout that drops cached profile queries. Resume UI is one more section on that page. Profile requests still go to `VITE_API_ORIGIN` (`http://localhost:3000` locally) with `credentials: "include"`.

The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 7, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### API and disk

- Accept the upload with `multer` on `POST /profile/resumes` only, using memory storage, a single file, the field name `file`, and a 5 MiB limit. Do not add a second multipart library. Map multer's limit and unexpected-file errors to `400` `{ "error": "Invalid input" }`.
- Write the bytes with Node's filesystem API after validation. Do not store the bytes in PostgreSQL.
- Sanitize the filename before the write. Store `<RESUME_STORAGE_DIR>/<userId>/<id>.pdf`. Persist that absolute path in `storagePath`.
- On a failed insert, unlink the file that was just written. On delete, follow the `DELETE /profile/resumes/:id` order above: validate `storagePath`, unlink, then delete the row. `ENOENT` still continues to the row delete. Any other unlink failure returns `500` and keeps the row.
- Do not log file bytes, storage paths, access tokens, refresh tokens, passwords, or `JWT_SECRET`.
- Do not read the file as text, parse PDF objects, or send the file to Gemini or MCP.
- Add `RESUME_STORAGE_DIR` to the API service in `docker-compose.yml` and mount a named volume at `/var/lib/jobpilot/resumes`. Do not put that variable in the web service, `apps/web` source, or the web bundle.
- Supertest sets `RESUME_STORAGE_DIR` to a temporary directory for the test process and removes that directory afterward. It does not use the Compose volume.
- Keep CORS as Phase 6 left it. `POST` with `Content-Type` and `Authorization` is already allowed. Do not change profile status codes, response bodies, or validation.

### Web

- Keep the Phase 4 account summary and the five Phase 6 sections. Add Resumes after Certifications.
- Use the existing web request helper. Extend it only as far as multipart upload and a binary download require. `DELETE` still has no body.
- Use shadcn/ui for the section controls already available. A file input does not go through React Hook Form or a Zod create schema. Validate the response with the shared resume-file schema.
- Do not write the access token, the file bytes, or `RESUME_STORAGE_DIR` to `localStorage`, `sessionStorage`, a readable cookie, or any persisted query cache.
- The web app still has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR` in its source, environment, or bundle.
- Buttons, matched exactly: `Upload resume`, `Download resume`, `Delete resume`.

### Tests and runtime

- Add `pnpm --filter @jobpilot/api test:resumes` for the new Supertest file. Do not add it to root `pnpm test` or to GitHub Actions. It follows the Phase 5 profile test setup: Compose Postgres, `DATABASE_URL`, and `JWT_SECRET`.
- Supertest covers: upload, list, download of the same bytes, delete removing both the row and the file, an empty list, a missing token, a non-PDF and an oversize file returning `400`, a list that hides another user's file, and another user's download and delete returning `404` while the owner's file remains. It also simulates a non-`ENOENT` unlink failure and expects `500` with `{ "error": "Internal server error" }` and the `ResumeFile` row still present. The upload bytes are the 19 bytes `phase7-resume-bytes` and the filename is `phase7-resume.pdf`.
- Extend `pnpm --filter @jobpilot/web test:e2e`. Do not add the new browser test to root `pnpm test` or to GitHub Actions. It assumes Compose is already running. It registers a unique `phase7-` email, logs in, waits until `signed-in`, sees `No resumes yet.` only after the list succeeds, uploads `phase7-resume.pdf`, and sees that filename in `profile-resumes`. It then deletes the file and sees `No resumes yet.` again.
- The test deletes the user it created through Prisma, using `DATABASE_URL`, only after the API delete. It does not add a delete-user route.
- The Phase 4 and Phase 6 Playwright cases still pass in the same `test:e2e` run. `pnpm --filter @jobpilot/api test:auth` and `pnpm --filter @jobpilot/api test:profile` still pass. `pnpm test` and `pnpm typecheck` still pass.
- Do not add PostgreSQL or Playwright to GitHub Actions. Do not change the Phase 1 CI workflow.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce a storage-provider interface, shared service layers, or helper packages for a later S3 adapter.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
