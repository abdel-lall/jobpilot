# Notes

Accepted deviations from the approved plan:

- The Playwright file waits until `http://localhost:3000/health` and `http://localhost:5173` respond before testing. It does not start a server.
- A blank `VITE_API_ORIGIN` uses the same `http://localhost:3000` fallback as a missing one.
- `zod` on `@jobpilot/web` is pinned to `3.25.76`, the same major as `@jobpilot/shared`, so the web app can import `registerBodySchema` and `loginBodySchema`.

These choices match the spec:

- `apps/api` is unchanged. Login, refresh, and logout still use `SameSite=Lax` and credentialed CORS for `WEB_ORIGIN`. A browser on `http://localhost:5173` stored and sent the refresh cookie to `http://localhost:3000`.
- `@jobpilot/web` dev-depends on `@jobpilot/database` and `@prisma/adapter-pg` so `e2e/auth.spec.ts` can delete its user. There is no delete-user route.
- `test:e2e` builds `@jobpilot/database` first, because that package loads `dist`. The web image builds `@jobpilot/shared` for the same reason.
- The home screen is the auth page. `HealthPage` is still in the tree and is not rendered. The Vite `/health` proxy is still there. `QueryClientProvider` remains from the existing app shell.
- Playwright also covers a failed logout, duplicate email, a wrong password, and client-side rejection of invalid input.

Non-blocking review findings. No mandatory follow-up:

- `restoreInFlight` in `apps/web/src/auth/session.tsx` keeps the restored access token for the life of the page. Logout clears React state immediately and does not send that token again. The cached promise is only read from the mount effect, so a logout in this screen does not reuse it. A remount of `SessionProvider` in the same document would treat that cached result as signed-in without a new refresh.
