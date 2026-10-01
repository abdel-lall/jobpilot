# Phase 7 — Validation

Validation passed on 2026-10-01. Review passed with no changes required before commit.

## Acceptance criteria

- PASS — The owner can upload a PDF, list it, download the same bytes, and delete it. Supertest uploaded `phase7-resume.pdf` with the 19 bytes `phase7-resume-bytes`, listed it, downloaded those bytes, and deleted the row and the file.
- PASS — Another user cannot download or delete that file. Both return `404` with `{ "error": "Not found" }`. That user's list does not include the file. The owner's file remains.
- PASS — Deleting the resume record unlinks the stored file, then removes the row, then returns `204`. An already-absent file (`ENOENT`) still removes the row. A non-`ENOENT` unlink failure returns `500` with `{ "error": "Internal server error" }` and leaves the row in place. A path outside `RESUME_STORAGE_DIR` does the same on download and delete, and does not read or unlink that file.
- PASS — Phase 7 does not restore a file or run a reconciliation worker when the database delete fails after a successful unlink. The delete path unlinks, then deletes the row, and has no restore step. Filesystem deletion and PostgreSQL deletion are not one atomic transaction.
- PASS — A rejected upload creates no row and leaves no file. A non-PDF, a file over 5 MiB, and `../../resume.pdf` return `400` with `{ "error": "Invalid input" }`.
- PASS — Public JSON is the metadata in the phase spec. It has no `storagePath` and no file bytes. Download returns the raw bytes with `Content-Type: application/pdf` and `Content-Disposition: attachment; filename="phase7-resume.pdf"`.
- PASS — The signed-in profile page shows a Resumes section after Certifications. The owner uploads `phase7-resume.pdf`, sees that filename, deletes it, and sees `No resumes yet.`
- PASS — The resume list loads through TanStack Query. The empty state appears only after a successful empty list. The access token stays in memory. The query key is `/profile/resumes` and the user id, with no token.
- PASS — The Phase 5 profile records are unchanged and remain the only structured candidate data. Uploaded files are not parsed, embedded, or sent to an AI interface. `pnpm --filter @jobpilot/api test:profile` still passes.
- PASS — The Phase 6 profile sections keep their order and behavior. Phase 4 auth behavior stays the same. The same Playwright run passed those cases.
- PASS — The web app has no Gemini API key, no database URL, no `JWT_SECRET`, and no `RESUME_STORAGE_DIR`. Playwright reads `DATABASE_URL` in Node to delete its users.
- PASS — The Phase 6 browser tests, the Phase 5 profile Supertest, and the Phase 3 auth Supertest still pass.
- PASS — No jobs, dashboard, AI, MCP, embeddings, tailored-resume JSON, or S3 behavior is added.

## Required automated tests

- PASS — Supertest, executed by `pnpm --filter @jobpilot/api test:resumes` against the Compose database: 7 tests passed. They upload `phase7-resume.pdf` with the bytes `phase7-resume-bytes`, list it, download those same bytes, and delete it so both the row and the file are gone. The same run covers an empty list, a missing token, a non-PDF, a file over 5 MiB, a path-like filename, a list that hides another user's file, and another user's download and delete returning `404` while the owner's file remains. `ENOENT` still returns `204` and removes the row. A simulated non-`ENOENT` unlink failure returns `500` with `{ "error": "Internal server error" }` and leaves the `ResumeFile` row intact. A stored path outside the temporary directory returns `500` on download and delete, leaves the row, and leaves that outside file in place.
- PASS — Playwright, executed by `pnpm --filter @jobpilot/web test:e2e` against Compose: 11 tests passed. A `phase7-` user sees `No resumes yet.` only after the list succeeds, uploads `phase7-resume.pdf`, sees that filename, deletes it, and sees the empty state again. The test deletes that user through Prisma after the API delete.
- PASS — The same `test:e2e` command still passes the Phase 4 auth cases and the Phase 6 profile cases.
- PASS — Supertest from Phase 5 still passes: `pnpm --filter @jobpilot/api test:profile` against the Compose database, 41 tests passed.
- PASS — Supertest from Phase 3 still passes: `pnpm --filter @jobpilot/api test:auth` against the Compose database, 11 tests passed.
- PASS — Root `pnpm test` still passes with `DATABASE_URL` and `JWT_SECRET` unset: 2 tests passed, including the health route and the Argon2id unit test.

Gemini is not called. GitHub Actions is not given a PostgreSQL service or a Playwright job. `test:resumes` is not added to root `pnpm test`.

## Manual verification

The browser checks below were exercised by the Playwright suite against Compose. Health, the served-module scan, the storage volume, and the leftover-user query were checked again while writing this record. There was no separate interactive devtools session. Download bytes were compared by Supertest, not by clicking `Download resume` in the browser.

1. PASS — Compose was up. `GET http://localhost:3000/health` returned `200` and `{"status":"ok"}`.
2. PASS — The five profile sections stay first. Resumes is a later heading on the signed-in page. The Phase 6 heading checks still match.
3. PASS — Resumes shows `Loading resumes…` and does not show `No resumes yet.` while the list is held. An empty success then shows that text.
4. PASS — Upload of `phase7-resume.pdf` shows that filename. Supertest confirmed the downloaded bytes match `phase7-resume-bytes`. The browser test did not click `Download resume`.
5. PASS — Delete returns `No resumes yet.` A later listing of `/var/lib/jobpilot/resumes` in the API container found no files.
6. PASS — The resume section is rendered only after `signed-in`. The Phase 4 logout test still passes and removes the signed-in page. The resume Playwright test did not click `Log out` itself.
7. PASS — The Vite-served modules for `main`, `App`, the API helper, session, profile sections, profile requests, the Resumes section, and the auth page have no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`. The Playwright specs read `DATABASE_URL` on the host to delete their users.
8. PASS — Playwright deletes its users after the API delete. A follow-up query found no `phase7-%` rows. No separate manual users were created.

## Commands run

Commands ran from the repository root on 2026-10-01 during implementation. `DATABASE_URL` and `JWT_SECRET` were set only in the shell for Prisma migrate, the database-backed tests, and Playwright user cleanup. `test:resumes` set its own temporary `RESUME_STORAGE_DIR`. Source files were last saved before that run. The later review did not re-run these commands. While writing this record, health, the served-module scan, the storage volume, and the leftover-user query were checked again. Typecheck, `pnpm test`, migrate, `test:auth`, `test:profile`, `test:resumes`, the Compose rebuild, and Playwright were not repeated.

- `pnpm --filter @jobpilot/api add multer@2.4.0` and `pnpm --filter @jobpilot/api add -D @types/multer` — succeeded. These replaced an earlier install of deprecated `multer@1.4.5-lts.2`. The Compose image build then ran `pnpm install --frozen-lockfile` successfully. A separate root `pnpm install` was not run after the final tree.
- `pnpm typecheck` — succeeded for the whole monorepo, including `apps/web/tsconfig.e2e.json`.
- `env -u DATABASE_URL -u JWT_SECRET pnpm test` — succeeded. 2 tests passed.
- `docker compose up -d postgres` — created and started Postgres.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/database exec prisma migrate deploy` — succeeded. Applied `20260930120000_enable_vector`, `20261001050000_user_refresh_session`, `20261001140000_candidate_profile`, and `20261001180000_resume_file`.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase7-validation-secret pnpm --filter @jobpilot/api test:auth` — succeeded. 11 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase7-validation-secret pnpm --filter @jobpilot/api test:profile` — succeeded. 41 tests passed.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres JWT_SECRET=phase7-validation-secret pnpm --filter @jobpilot/api test:resumes` — succeeded. 7 tests passed.
- `docker compose up --build -d` — rebuilt and started the API and web images. Exit code 0. The API service has `RESUME_STORAGE_DIR=/var/lib/jobpilot/resumes` and the `resume-files` volume. The web service does not.
- `pnpm --filter @jobpilot/web exec playwright install chromium` — succeeded. Exit code 0.
- `DATABASE_URL=postgresql://postgres:jobpilot@localhost:5432/postgres pnpm --filter @jobpilot/web test:e2e` — succeeded. 11 tests passed.
- `curl -sS http://localhost:3000/health` — `200` and `{"status":"ok"}`. Checked again while writing this record.
- `curl` of the Vite-served modules listed above — no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`.
- `docker compose exec -T api find /var/lib/jobpilot/resumes -type f` — no files.
- `docker compose exec -T postgres psql -U postgres -c "SELECT email FROM \"User\" WHERE email LIKE 'phase7-%';"` — no rows.

## Validation gaps

- GitHub Actions was not executed. `.github/workflows/ci.yml` is unchanged and still runs typecheck plus `pnpm test`. It does not run Playwright, `test:resumes`, or start PostgreSQL.
- The review did not re-run typecheck, `pnpm test`, migrate, `test:auth`, `test:profile`, `test:resumes`, the Compose rebuild, or Playwright. Those commands succeeded in the implementation run, and source files were saved before it.
- A separate root `pnpm install` was not run after the final tree. The lockfile install was verified by the image build's `pnpm install --frozen-lockfile`.
- There is no separate production web bundle. Compose runs the Vite dev server, and those served modules were scanned.
- The browser test does not click `Download resume` or `Log out`. Download bytes were checked by Supertest. Logout is covered by the Phase 4 browser test, and the resume section is not rendered until `signed-in`.
- Supertest does not separately send an empty file, a wrong field name, two files, or a malformed id. Those requests are specified and implemented. The required run covers a non-PDF, an oversize file, and a path-like filename.
- The manual checks were not repeated in a separate interactive browser session. They passed in Playwright, plus the health request, the served-module scan, the volume listing, and the leftover-user query.

## Completion checklist

- [x] PASS — `POST`, `GET` list, `GET` download, and `DELETE` `/profile/resumes` match the phase spec.
- [x] PASS — Bytes are stored under `RESUME_STORAGE_DIR`. PostgreSQL stores metadata and `storagePath` only.
- [x] PASS — Download returns the uploaded bytes. Delete unlinks the file before deleting the row. A simulated non-`ENOENT` unlink failure returns `500` and leaves the row intact.
- [x] PASS — Another user's download and delete return `404`. The list is owner-scoped.
- [x] PASS — Invalid uploads return `400` and leave no row and no file.
- [x] PASS — The signed-in page shows Resumes after the five Phase 6 sections, with upload, the filename, download, and delete.
- [x] PASS — The empty state appears only after an empty success. Signed-out removes cached resume queries through the existing `/profile/` query predicate. The query cache is not persisted.
- [x] PASS — The access token stays in memory and is sent only as `Authorization: Bearer`.
- [x] PASS — `pnpm --filter @jobpilot/api test:resumes` passes.
- [x] PASS — `pnpm --filter @jobpilot/web test:e2e` passes against Compose, including the Phase 4 and Phase 6 cases, and deletes its user.
- [x] PASS — `pnpm --filter @jobpilot/api test:profile` passes.
- [x] PASS — `pnpm --filter @jobpilot/api test:auth` passes.
- [x] PASS — `pnpm test` passes with `DATABASE_URL` and `JWT_SECRET` unset.
- [x] PASS — `pnpm typecheck` passes.
- [x] PASS — `GET /health` still returns `200` and `{"status":"ok"}`.
- [x] PASS — The new migration adds only `ResumeFile` and the `User` relation. Phase 5 profile tables and routes stay as they are.
- [x] PASS — Compose sets `RESUME_STORAGE_DIR` and a volume for the API only.
- [x] PASS — The web app has no `JWT_SECRET`, `DATABASE_URL`, `GEMINI_API_KEY`, or `RESUME_STORAGE_DIR`.
- [x] PASS — GitHub Actions is unchanged and does not run Playwright, `test:resumes`, or PostgreSQL.
- [x] PASS — No Phase 8 or later work is included. Files are not parsed or sent to AI. There is no S3 adapter.
