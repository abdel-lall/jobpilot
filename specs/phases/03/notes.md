# Notes

Accepted deviations from the approved plan:

- `argon2` is pinned to `0.44.0`. `0.45.1` is the current release, and its Windows prebuild crashes on load. This machine has no C++ toolset to compile it. `0.44.0` is still the `argon2` package, uses Argon2id, and its install script runs. The API image built and served auth with that version.
- `argon2` is listed in root `pnpm.onlyBuiltDependencies` so that install script can run.
- Access tokens include `iat` along with `sub` and a 15-minute `exp`. They carry no password, password hash, or refresh token.
- `createApp()` takes an optional `createReplacementSession` hook so the failed-refresh test can throw inside the Prisma transaction. The production entrypoint calls `createApp()` with no arguments. Production auth logic has no test flag.
- The `RefreshSession` foreign key uses Prisma's default `ON UPDATE CASCADE` in addition to `ON DELETE CASCADE`.
- `@jobpilot/api` depends on `@prisma/adapter-pg` directly so it can construct the Prisma 7 client. `@jobpilot/shared` depends only on `zod`.
- The API image builds `@jobpilot/shared` before `@jobpilot/api`, because shared now publishes `dist`.
- Vitest aliases `@jobpilot/shared` and `@jobpilot/database` to TypeScript source so the default test and `test:auth` can use the gitignored generated client without compiling `dist` first. The API image still loads the built package entry.
- Invalid bodies return `400` and `{ "error": "Invalid input" }`. The phase spec requires that shape and forbids echoing the password. It does not prescribe this exact string.
- Unexpected failures, including the injected refresh failure, return `500` and `{ "error": "Internal server error" }`.
- The Compose API service `depends_on` Postgres.

Non-blocking review findings. No mandatory follow-up:

- Refresh checks `revokedAt` and `expiresAt` before the rotation transaction, then updates that row inside the transaction. A refresh that has already passed the check can still insert a replacement if logout revokes that same row before the transaction runs. A thrown insert still rolls back, and the auth test covers that failure.
- Login runs Argon2 only when the email exists. Unknown email and wrong password return the same `401` body. Response time can still differ.
- `refreshUserSession` passes the Prisma transaction client through `as unknown as ReplacementSessionWriter`. That bypasses the type checker at the boundary used to inject the failed-transaction test.
