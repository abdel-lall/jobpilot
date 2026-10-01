# Notes

Accepted deviations from the approved plan:

- No `env.ts`. `PORT` is read in `apps/api/src/index.ts`. Application code does not read `GEMINI_API_KEY`. The key stays optional, in `.env.example`, and on the API service only.
- The API service does not wait for PostgreSQL. PostgreSQL still starts and has a healthcheck.
- `engines.node` is `>=20`. Docker and CI use Node 22.
- pnpm is pinned to 10.34.6 so Corepack on Node 20.19.4 can launch it.
- `pnpm.onlyBuiltDependencies` includes `esbuild` so pnpm 10 runs the Vite install script.
- `apps/web/src/vite-env.d.ts` lets `tsc` accept the CSS import.
- Verification used `docker compose up --build -d` with `GEMINI_API_KEY` unset.

Non-blocking review observations:

- `class-variance-authority` is installed and unused. The Card uses `cn` only.
- `components.json` sets `iconLibrary` to `lucide` without a `lucide-react` dependency. No icon is rendered.
- The API build emits `health.test.js` into `dist` because the test lives under `src`. The server runs `dist/index.js`.
- The web service waits for the API container to start, not for the process to listen. TanStack Query retries the health request.
