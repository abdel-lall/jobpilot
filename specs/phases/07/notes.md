# Notes

No behavior departs from the approved spec. These choices match that spec and the approved plan:

- Upload uses `multer` `2.4.0` with memory storage, field name `file`, one file, and a 5 MiB limit. `1.4.5-lts.2` was not kept because that line is deprecated. `@types/multer` stays a dev dependency because `2.4.0` does not ship its own types.
- `preservePath` is enabled so the original multipart filename is validated before any basename reduction. A name with a directory, `\`, `..`, a space, or any character outside `^[A-Za-z0-9][A-Za-z0-9._-]{0,200}\.pdf$` is `400`. The accepted original name is stored in `fileName`. The on-disk name is `<id>.pdf`.
- The path-like Supertest request is a raw multipart body. Supertest `.attach()` basenames `../../resume.pdf` before the request is sent.
- Download and delete resolve `storagePath` with `path.resolve` and `path.relative` after the owner lookup and before any read or unlink. A path outside `RESUME_STORAGE_DIR` returns `500` and is left untouched.
- The resume query key is `["/profile/resumes", userId]`. The existing `/profile/` cache predicate already drops it on sign-out and on a user id change, so the Phase 6 cache component is unchanged.
- There is no storage-provider interface. Bytes are written with Node's filesystem API. PostgreSQL stores metadata and `storagePath` only.

Non-blocking review findings. No mandatory follow-up:

- The browser test does not click `Download resume`. Supertest compares the downloaded bytes.
- The resume browser test does not click `Log out`. The section renders only on the signed-in page, and the Phase 4 logout test still passes.
- Supertest does not separately cover an empty file, a wrong field name, two files, or a malformed id. Those cases are implemented.

The review found no required code changes.
