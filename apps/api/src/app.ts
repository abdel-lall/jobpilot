import type { PrismaClient } from "@jobpilot/database";
import express from "express";
import { healthRouter } from "./routes/health.js";

export type { PrismaClient };

export function createApp() {
  const app = express();
  app.use(healthRouter);
  return app;
}
