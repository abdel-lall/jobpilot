import { createHash, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "./auth/tokens.js";

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

if (jwtSecret === undefined || jwtSecret.length === 0) {
  throw new Error("JWT_SECRET is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const app = createApp();
const createdEmails: string[] = [];
const password = "password1";

function uniqueEmail(): string {
  const email = `phase3-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function setCookieHeader(response: request.Response): string {
  const header = response.headers["set-cookie"];
  if (header === undefined) {
    throw new Error("missing set-cookie");
  }
  return Array.isArray(header) ? header.join(";") : header;
}

function refreshCookieValue(setCookie: string): string {
  const match = /^refresh_token=([^;]+)/.exec(setCookie);
  const value = match?.[1];
  if (value === undefined || value.length === 0) {
    throw new Error("missing refresh token cookie");
  }
  return value;
}

describe("auth API", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it("registers a user without logging them in", async () => {
    const email = `User-${randomUUID()}@Example.com`;
    const normalized = email.trim().toLowerCase();
    createdEmails.push(normalized);

    const response = await request(app).post("/auth/register").send({ email, password });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: { id: expect.any(String), email: normalized },
    });
    expect(response.body).not.toHaveProperty("accessToken");
    expect(response.headers["set-cookie"]).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain(password);

    const row = await prisma.user.findUniqueOrThrow({ where: { email: normalized } });
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(row.passwordHash).not.toBe(password);
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });

    const response = await request(app)
      .post("/auth/register")
      .send({ email: email.toUpperCase(), password });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: "Email already registered" });
    expect(JSON.stringify(response.body)).not.toContain(password);
  });

  it("rejects invalid auth input without echoing the password", async () => {
    const submittedPassword = "short";
    const registerResponse = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: submittedPassword });
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: "not-an-email", password: submittedPassword });

    expect(registerResponse.status).toBe(400);
    expect(loginResponse.status).toBe(400);
    expect(registerResponse.body).toEqual({ error: "Invalid input" });
    expect(loginResponse.body).toEqual({ error: "Invalid input" });
    expect(JSON.stringify(registerResponse.body)).not.toContain(submittedPassword);
    expect(JSON.stringify(loginResponse.body)).not.toContain(submittedPassword);
  });

  it("logs in and returns an HS256 access token", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });

    const response = await request(app).post("/auth/login").send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body.tokenType).toBe("Bearer");
    expect(response.body.expiresIn).toBe(900);
    expect(response.body.user).toEqual({ id: expect.any(String), email });
    expect(JSON.stringify(response.body)).not.toContain(password);

    const setCookie = setCookieHeader(response);
    const rawRefreshToken = refreshCookieValue(setCookie);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Max-Age=604800");
    expect(setCookie).not.toContain("; Secure");
    expect(JSON.stringify(response.body)).not.toContain(rawRefreshToken);

    const accessToken = response.body.accessToken as string;
    expect(decodeProtectedHeader(accessToken).alg).toBe("HS256");
    const payload = decodeJwt(accessToken);
    expect(payload.sub).toBe(response.body.user.id);
    expect(payload.exp).toBeDefined();
    expect(payload.iat).toBeDefined();
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(ACCESS_TOKEN_EXPIRES_IN_SECONDS);
    expect(payload).not.toHaveProperty("password");
    expect(payload).not.toHaveProperty("passwordHash");

    const session = await prisma.refreshSession.findFirstOrThrow({
      where: { userId: response.body.user.id as string },
    });
    expect(session.tokenHash).toBe(createHash("sha256").update(rawRefreshToken).digest("hex"));
    expect(session.tokenHash).not.toBe(rawRefreshToken);
    expect(session.revokedAt).toBeNull();
  });

  it("returns the same 401 body for an unknown email and a wrong password", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });

    const unknown = await request(app)
      .post("/auth/login")
      .send({ email: uniqueEmail(), password });
    const wrong = await request(app)
      .post("/auth/login")
      .send({ email, password: "wrong-password" });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual({ error: "Invalid email or password" });
    expect(wrong.body).toEqual(unknown.body);
  });

  it("returns the access token user from GET /auth/me and rejects missing, malformed, and expired tokens", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const accessToken = loginResponse.body.accessToken as string;
    const userId = loginResponse.body.user.id as string;

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({ user: { id: userId, email } });

    const missing = await request(app).get("/auth/me");
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "Unauthorized" });

    const malformed = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-jwt");
    expect(malformed.status).toBe(401);
    expect(malformed.body).toEqual({ error: "Unauthorized" });

    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(new Date(Date.now() - 60_000))
      .sign(new TextEncoder().encode(jwtSecret));
    const expiredResponse = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body).toEqual({ error: "Unauthorized" });
  });

  it("rotates the refresh session and rejects the previous token", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const firstToken = refreshCookieValue(setCookieHeader(loginResponse));

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${firstToken}`);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.tokenType).toBe("Bearer");
    expect(refreshResponse.body.expiresIn).toBe(900);
    expect(refreshResponse.body).not.toHaveProperty("user");
    const secondToken = refreshCookieValue(setCookieHeader(refreshResponse));
    expect(secondToken).not.toBe(firstToken);
    expect(JSON.stringify(refreshResponse.body)).not.toContain(secondToken);
    expect(JSON.stringify(refreshResponse.body)).not.toContain(password);

    const reuse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${firstToken}`);
    expect(reuse.status).toBe(401);
    expect(reuse.body).toEqual({ error: "Unauthorized" });

    const next = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${secondToken}`);
    expect(next.status).toBe(200);
  });

  it("leaves the old session valid when replacement creation fails", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const userId = loginResponse.body.user.id as string;
    const rawToken = refreshCookieValue(setCookieHeader(loginResponse));
    const before = await prisma.refreshSession.findMany({ where: { userId } });
    expect(before).toHaveLength(1);

    const failingApp = createApp({
      createReplacementSession: async () => {
        throw new Error("replacement session creation failed");
      },
    });
    const failed = await request(failingApp)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`);

    expect(failed.status).toBe(500);
    expect(failed.body).toEqual({ error: "Internal server error" });
    const after = await prisma.refreshSession.findMany({ where: { userId } });
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.revokedAt).toBeNull();
    expect(after[0]?.tokenHash).toBe(before[0]?.tokenHash);

    const recovered = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`);
    expect(recovered.status).toBe(200);
  });

  it("revokes the session on logout so a later refresh fails", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password });
    const loginResponse = await request(app).post("/auth/login").send({ email, password });
    const rawToken = refreshCookieValue(setCookieHeader(loginResponse));

    const logoutResponse = await request(app)
      .post("/auth/logout")
      .set("Cookie", `refresh_token=${rawToken}`);

    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.text).toBe("");
    const cleared = setCookieHeader(logoutResponse);
    expect(cleared).toContain("HttpOnly");
    expect(cleared).toContain("SameSite=Lax");
    expect(cleared).toContain("Max-Age=0");
    expect(logoutResponse.text).not.toContain(rawToken);

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", `refresh_token=${rawToken}`);
    expect(refreshResponse.status).toBe(401);
    expect(refreshResponse.body).toEqual({ error: "Unauthorized" });
  });

  it("marks the refresh cookie Secure when NODE_ENV is production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const email = uniqueEmail();
      await request(app).post("/auth/register").send({ email, password });
      const response = await request(app).post("/auth/login").send({ email, password });
      const setCookie = setCookieHeader(response);
      expect(setCookie).toContain("; Secure");
      expect(setCookie).toContain("HttpOnly");
      expect(setCookie).toContain("SameSite=Lax");
    } finally {
      if (previous === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previous;
      }
    }
  });

  it("allows credentialed CORS only for WEB_ORIGIN", async () => {
    const previous = process.env.WEB_ORIGIN;
    process.env.WEB_ORIGIN = "http://localhost:5173";
    try {
      const allowed = await request(app).get("/health").set("Origin", "http://localhost:5173");
      expect(allowed.status).toBe(200);
      expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(allowed.headers["access-control-allow-credentials"]).toBe("true");
      expect(allowed.headers["access-control-allow-origin"]).not.toBe("*");

      const preflight = await request(app)
        .options("/auth/login")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type,authorization");
      expect(preflight.status).toBe(204);
      expect(preflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(preflight.headers["access-control-allow-credentials"]).toBe("true");

      const other = await request(app).get("/health").set("Origin", "http://evil.example");
      expect(other.headers["access-control-allow-origin"]).toBeUndefined();
      expect(other.headers["access-control-allow-credentials"]).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.WEB_ORIGIN;
      } else {
        process.env.WEB_ORIGIN = previous;
      }
    }
  });
});
