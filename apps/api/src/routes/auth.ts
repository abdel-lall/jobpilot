import { loginBodySchema, publicUserSchema, registerBodySchema } from "@jobpilot/shared";
import { Router, type Response } from "express";
import { readRefreshToken, serializeClearedRefreshCookie, serializeRefreshCookie } from "../auth/cookies.js";
import { AuthError } from "../auth/errors.js";
import { createAuthService, type AuthServiceOptions } from "../auth/service.js";

function sendAuthError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    if (error.code === "email_taken") {
      response.status(409).json({ error: "Email already registered" });
      return;
    }
    if (error.code === "invalid_credentials") {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  response.status(500).json({ error: "Internal server error" });
}

export function createAuthRouter(options?: AuthServiceOptions): Router {
  const service = createAuthService(options);
  const router = Router();

  router.post("/auth/register", async (request, response) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
    try {
      const user = publicUserSchema.parse(await service.register(parsed.data));
      response.status(201).json({ user });
    } catch (error) {
      sendAuthError(response, error);
    }
  });

  router.post("/auth/login", async (request, response) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
    try {
      const result = await service.login(parsed.data);
      const user = publicUserSchema.parse(result.user);
      response.setHeader("Set-Cookie", serializeRefreshCookie(result.refreshToken));
      response.status(200).json({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: result.expiresIn,
        user,
      });
    } catch (error) {
      sendAuthError(response, error);
    }
  });

  router.post("/auth/refresh", async (request, response) => {
    try {
      const result = await service.refresh(readRefreshToken(request.header("cookie")));
      response.setHeader("Set-Cookie", serializeRefreshCookie(result.refreshToken));
      response.status(200).json({
        accessToken: result.accessToken,
        tokenType: "Bearer",
        expiresIn: result.expiresIn,
      });
    } catch (error) {
      sendAuthError(response, error);
    }
  });

  router.post("/auth/logout", async (request, response) => {
    try {
      await service.logout(readRefreshToken(request.header("cookie")));
      response.setHeader("Set-Cookie", serializeClearedRefreshCookie());
      response.status(204).end();
    } catch (error) {
      sendAuthError(response, error);
    }
  });

  router.get("/auth/me", async (request, response) => {
    try {
      const user = publicUserSchema.parse(
        await service.getAuthenticatedUser(request.header("authorization")),
      );
      response.status(200).json({ user });
    } catch (error) {
      sendAuthError(response, error);
    }
  });

  return router;
}
