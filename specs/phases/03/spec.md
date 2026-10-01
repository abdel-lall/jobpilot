# Phase 3 — Authentication API

## Objective

Authenticate users and isolate their data on the server.

## Scope

This phase adds only the authentication API described in the Phase 3 section of `specs/roadmap.md`:

- Register, log in, log out, and refresh.
- Argon2id password hashes. Plaintext passwords are not stored.
- Access tokens are JWTs with a 15-minute lifetime, sent as `Authorization` bearer tokens.
- Refresh tokens last 7 days and are stored only in HttpOnly cookies. Production cookies are `Secure`.
- Refresh sessions are stored in PostgreSQL. Refresh rotates the token and revokes the previous session. Logout revokes the session.
- CORS allows the configured web origin to send credentials.
- Zod validates every auth input. Auth logic lives outside the controllers.
- Shared user and session schemas live in `packages/shared`.
- `packages/database` gains only the user and refresh-session models, in a new migration. The Phase 2 `vector` extension stays in place.
- A protected route accepts a valid access token and rejects a request without one.

The HTTP contract for this phase is:

| Method and path | Success | Auth input |
| --- | --- | --- |
| `POST /auth/register` | `201` with the public user | JSON body |
| `POST /auth/login` | `200` with an access token and the public user, plus the refresh cookie | JSON body |
| `POST /auth/refresh` | `200` with a new access token, plus a replacement refresh cookie | refresh cookie |
| `POST /auth/logout` | `204` and the refresh cookie is cleared | refresh cookie |
| `GET /auth/me` | `200` with the public user for the access token | `Authorization: Bearer` |

`GET /health` stays unauthenticated and unchanged.

Public user JSON is `{ "id": string, "email": string }`. Responses never include a password, a password hash, a refresh token, or a refresh-session secret.

Register request body: `{ "email": string, "password": string }`. Registration creates the user only. It does not log the user in, and it does not issue an access token or a refresh token. This is an intentional MVP contract.

Login request body: `{ "email": string, "password": string }`. Login response body:

```json
{
  "accessToken": "<jwt>",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": { "id": "<id>", "email": "<email>" }
}
```

Refresh response body is the same token fields without `user`. The new refresh token is only in the `Set-Cookie` header.

`GET /auth/me` response body: `{ "user": { "id": "<id>", "email": "<email>" } }`.

Error bodies use `{ "error": string }` and must not echo the submitted password:

- Invalid or missing auth input: `400`.
- Duplicate email on register: `409` with `{ "error": "Email already registered" }`.
- Unknown email or wrong password on login: `401` with `{ "error": "Invalid email or password" }` for both cases.
- Missing, malformed, expired, or otherwise invalid access token on `GET /auth/me`: `401` with `{ "error": "Unauthorized" }`.
- Missing, unknown, expired, or revoked refresh cookie on refresh or logout: `401` with `{ "error": "Unauthorized" }`.

## Affected subsystems

- Authentication
- `apps/api`
- `packages/database`
- `packages/shared`

`apps/web` is not part of this phase. Phase 4 owns the authentication UI.

## Out of scope

Later phases must not be started in this phase. The following are specified elsewhere and are not part of Phase 3:

- Register and login forms, holding the access token in memory, restoring a session on page load, and logout in the browser. Phase 4 owns the authentication UI and its Playwright tests.
- Browser proof that page JavaScript cannot read the refresh cookie. Phase 3 only sets `HttpOnly` and tests the `Set-Cookie` attribute. Phase 4 covers the browser check.
- Candidate profile tables and profile CRUD. Phases 5 and 6.
- Resume file upload, download, delete, and local disk storage. Phase 7.
- Jobs, job status fields, and the dashboard. Phases 8 and 9.
- Any of the five AI workflows, LangGraph graphs, Gemini calls, or a model client. Those start at Phase 10. `packages/ai` stays a typecheck placeholder.
- MCP tools and Streamable HTTP. Phase 11. `apps/portfolio-mcp` stays a typecheck placeholder.
- Embedding columns, vector indexes, and vector queries. Phase 12. This phase does not query pgvector.
- Email verification, password reset, OAuth, MFA, account deletion, rate limiting, and refresh-token reuse detection that revokes every session for the user. None of these are in the Phase 3 roadmap.
- Queues, a worker process, or a job runner. The MVP does not add them.
- A GitHub Actions PostgreSQL service. Required auth integration tests run locally against Compose, as the Phase 2 database test does. The existing CI workflow stays typecheck plus `pnpm test`.

## Dependencies

Phase 2.

Phase 2 provides `packages/database` on Prisma 7.10.0, the `prisma-client` generator, `@prisma/adapter-pg`, the `vector` migration, and the Compose database `pgvector/pgvector:pg16` published on `localhost:5432`. The local validation URL is `postgresql://postgres:jobpilot@localhost:5432/postgres`.

## Implementation constraints

These constraints come from Phase 3, the roadmap rules that bind every phase, and the engineering rules in `specs/tech-stack.md`. They do not add behavior beyond the scope above.

### Data model

- Add two Prisma models and one new migration. Do not edit `20260930120000_enable_vector`. Do not add any other product table.
- `User` fields: `id` (`String`, `@id`, `@default(uuid())`), `email` (`String`, unique), `passwordHash` (`String`), `createdAt` (`DateTime`, `@default(now())`). No name, role, or profile fields.
- `RefreshSession` fields: `id` (`String`, `@id`, `@default(uuid())`), `userId` (foreign key to `User`, `onDelete: Cascade`), `tokenHash` (`String`, unique), `expiresAt` (`DateTime`), `revokedAt` (`DateTime?`), `createdAt` (`DateTime`, `@default(now())`). No token-family or replacement pointer.
- Keep the Prisma 7.10.0 generator, `prisma7.config.ts`, ESM package setup, and `@prisma/adapter-pg`. `packages/database` still exports the generated client.
- Store the refresh token as a SHA-256 hex hash in `tokenHash`. Do not store the raw refresh token.
- Store the password only as an Argon2id PHC string in `passwordHash`. A stored hash must start with `$argon2id$`.

### Auth behavior

- Use the `argon2` package with Argon2id. Allow its install script if pnpm blocks the build. Do not substitute another hashing algorithm.
- Use `jose` to sign and verify access tokens with HS256. The signing secret is `JWT_SECRET` from the environment. Do not put the secret in source.
- Access token claims are `sub` (the user id) and a 15-minute expiry. `expiresIn` is `900`. The token carries no password, password hash, or refresh token.
- The refresh token is an opaque random secret, not a JWT. Its cookie lifetime and `expiresAt` are 7 days (`604800` seconds).
- Cookie name: `refresh_token`. Attributes: `HttpOnly`, `Path=/`, `SameSite=Lax`, and `Secure` only when `NODE_ENV` is `production`. The refresh token must not appear in a JSON body.
- `SameSite=Lax` is the Phase 3 choice because local web `http://localhost:5173` and API `http://localhost:3000` are different origins and the same site. Phase 4 verifies that choice in the browser. Do not add the authentication UI in this phase.
- CORS allows credentials from exactly one origin, `WEB_ORIGIN`. The local value is `http://localhost:5173`. Do not use `Access-Control-Allow-Origin: *`. A request from any other origin must not be treated as the credentialed web origin.
- Normalize email by trimming and lowercasing it before lookup and storage. Do not trim passwords.
- Password length is 8 through 128 characters. Email must be a valid email address. Enforce both with Zod.
- Login creates a new refresh session and does not revoke the user's other sessions. Logout revokes only the session for the presented refresh token, then clears the cookie.
- Refresh accepts only a session whose hash matches, `revokedAt` is null, and `expiresAt` is in the future. Revoking that session and inserting the replacement session happen in one database transaction. If that transaction fails, the old session remains valid and no replacement session is created. After a successful rotation, the previous raw token fails. Logout after that also fails for the revoked token.
- `GET /auth/me` reads the user id only from the verified access token. A missing, malformed, or expired token is rejected. Do not accept a user id from the query string or body.
- Keep route handlers thin. Zod parsing and HTTP status mapping stay at the controller boundary. Hashing, token issuing, session rotation, and persistence live outside controllers.
- Put the Zod schemas for the register body, the login body, the public user, and the refresh session in `packages/shared`. The session schema describes `id`, `userId`, `expiresAt`, and `revokedAt`. It does not include `tokenHash` or the raw refresh token. `packages/shared` may depend on `zod`. The API imports these schemas from `@jobpilot/shared`.

### Runtime and tests

- `createApp()` must not require `DATABASE_URL` or `JWT_SECRET`. Importing and constructing the Express app must still work when those variables are unset, so the Phase 1 health test and CI stay green. Only the process entrypoint that calls `listen()` validates the required runtime environment values, and it must refuse to listen if `DATABASE_URL` or `JWT_SECRET` is missing or empty. Auth routes may validate and use those variables when they are invoked.
- Add `DATABASE_URL`, `JWT_SECRET`, and `WEB_ORIGIN` to the Compose API service. Inside Compose, the database host is `postgres`: `postgresql://postgres:jobpilot@postgres:5432/postgres`. `JWT_SECRET` may default to `dev-only-change-me` for local Compose only. `WEB_ORIGIN` may default to `http://localhost:5173`. Document all three in `.env.example`. Do not put `JWT_SECRET` or `DATABASE_URL` in `apps/web`.
- The Argon2id check is a Vitest unit test in `@jobpilot/api` with no database. It must run under root `pnpm test`. Assert that a hash starts with `$argon2id$`, that verification succeeds for the same password, and that verification fails for a different password.
- Auth Supertest uses the Compose database and a real `JWT_SECRET`. It covers register, login, `GET /auth/me`, refresh rotation, reuse of the previous refresh token, logout, and a later refresh with the revoked cookie. It also covers a failed refresh transaction: the old session remains valid and no replacement session is created. It asserts the stored password hash is Argon2id and is not the plaintext password. Exclude this file from the default Vitest run. Add an `@jobpilot/api` script named `test:auth` that runs only that file.
- Do not add PostgreSQL to GitHub Actions. Do not change the Phase 1 CI workflow.
- Each integration test uses a unique email and deletes the user it created.
- Do not log passwords, refresh tokens, password hashes, or `JWT_SECRET`.
- Enable TypeScript strict mode. Avoid `any` unless justified.
- Prefer simple implementations over unnecessary abstractions.
- Do not introduce architectural abstractions, shared service layers, or helper packages for future phases unless this phase directly requires them.
- Do not add a queue, a worker process, or a job runner.
- Keep this phase one independently implementable, reviewable, testable, and committable slice.
