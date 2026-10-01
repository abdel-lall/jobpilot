# Notes

Accepted deviations from the approved plan:

- `prepare` runs `prisma generate` only. `typecheck` is `tsc --noEmit`. `build` is `tsc`. Install does not compile the package.
- `exports.types` points at `./src/index.ts` so typecheck can resolve the client before `build`. The Node `import` condition points at `./dist/index.js`.
- `apps/api` imports `PrismaClient` with `import type`. Startup does not construct a client or open a connection.
- The integration test imports the package entry through `./index.js` so Vitest does not require `dist` before the documented test command.

Non-blocking review findings. No mandatory follow-up:

- `apps/api/src/app.ts` re-exports `PrismaClient` as a type. The import alone proves the package resolves. The re-export is unnecessary and has no runtime effect.
- `@jobpilot/database` lists `pg` as a direct dependency. `@prisma/adapter-pg@7.10.0` already depends on `pg`, and this package does not import `pg`.
