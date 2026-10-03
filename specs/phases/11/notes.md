# Notes

One behavior was added after review, at your request. The approved spec requires `405` for `GET /mcp` and `DELETE /mcp` only. `PUT`, `PATCH`, `OPTIONS`, `HEAD`, and any other non-`POST` method on `/mcp` now return the same `405` and `{ "error": "Method not allowed" }`. Node does not send a body for `HEAD`, so that response still sets `content-type: application/json` and the content length of that JSON. `POST /mcp` and every other path are unchanged.

These other choices match the approved spec and the approved plan:

- `projectId` is `z.unknown().optional()`. The handler returns `Invalid input` unless the value is a lowercase UUID. `tools/list` therefore types `projectId` as an unconstrained value. Unknown keys are stripped.
- Tool calls go through the official MCP client. The `401`, `405`, and `404` cases use `fetch` so the test can assert the HTTP status and JSON body.
- Calendar dates use the same UTC `YYYY-MM-DD` conversion as the profile API. Each record is parsed with the Phase 5 Zod schema from `@jobpilot/shared` after omitting `userId`.
- `apps/portfolio-mcp/src/db.ts` constructs `PrismaClient` with `PrismaPg` the same way `apps/api/src/db.ts` does. `packages/database` has no new API and no migration.
- Each `POST /mcp` uses a new stateless transport with `enableJsonResponse: true` and no session id. A later request does not reuse the previous user.
- `@modelcontextprotocol/sdk` brings Express in its dependency tree. This server uses Node's `http` module and does not import Express.
- An unexpected throw becomes `500` with `{ "error": "Internal server error" }`. The handler does not log the exception, so a Prisma error cannot print profile values. The process logs only the listen port.
- Root `pnpm test` stays the API and AI unit tests. The MCP suite needs PostgreSQL and is not part of that command. `.github/workflows/ci.yml` is unchanged.
- Compose starts `portfolio-mcp` beside `api` and `web`. It depends on `postgres` only. The API service does not receive `MCP_SHARED_SECRET`. The web service does not receive that secret, `DATABASE_URL`, `JWT_SECRET`, or the Gemini settings.

The review found no required code changes. The unsupported-method response was the only finding, and it was low severity. It is fixed in the source covered by this phase.

Unresolved:

- The Compose image that was validated was built before the unsupported-method response. The in-process MCP suite covers that response. The running container was not rebuilt.
- GitHub Actions was not executed.
