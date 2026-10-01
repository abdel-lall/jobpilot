import { Router } from "express";
import { getHealthStatus } from "../health.js";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.status(200).json(getHealthStatus());
});
