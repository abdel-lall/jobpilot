import type { PrismaClient } from "@jobpilot/database";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AuthServiceOptions } from "./auth/service.js";
import { healthRouter } from "./routes/health.js";
import { createAuthRouter } from "./routes/auth.js";
import { createProfileRouter } from "./routes/profile.js";
import { createResumeRouter } from "./routes/resumes.js";

export type { PrismaClient };

function applyCors(request: Request, response: Response, next: NextFunction): void {
  const origin = request.header("origin");
  const allowedOrigin = process.env.WEB_ORIGIN;
  if (origin !== undefined && allowedOrigin !== undefined && origin === allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }
  next();
}

export function createApp(options?: AuthServiceOptions) {
  const app = express();
  app.use(applyCors);
  app.use(express.json());
  app.use(healthRouter);
  app.use(createAuthRouter(options));
  app.use(createProfileRouter());
  app.use(createResumeRouter());
  return app;
}
