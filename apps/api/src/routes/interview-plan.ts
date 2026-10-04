import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors.js";
import { getAuthenticatedUser } from "../auth/service.js";
import { InterviewPlanError } from "../interview-plan/errors.js";
import {
  generateInterviewPlan,
  readInterviewPlan,
  type InterviewPlanDependencies,
} from "../interview-plan/service.js";

function isEmptyObject(body: unknown): boolean {
  return body !== null && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0;
}

function sendError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (error instanceof InterviewPlanError && error.code === "not_found") {
    response.status(404).json({ error: "Not found" });
    return;
  }
  if (error instanceof InterviewPlanError && error.code === "analysis_not_current") {
    response.status(409).json({ error: "Job analysis is not current" });
    return;
  }
  if (error instanceof InterviewPlanError && error.code === "generation_failed") {
    response.status(502).json({ error: "Interview plan generation failed" });
    return;
  }
  response.status(500).json({ error: "Internal server error" });
}

async function respond(response: Response, action: () => Promise<unknown>): Promise<void> {
  try {
    response.status(200).json(await action());
  } catch (error) {
    sendError(response, error);
  }
}

function pathId(request: Request): string {
  const id = request.params.id;
  return typeof id === "string" ? id : "";
}

async function requireUserId(request: Request, response: Response): Promise<string | undefined> {
  try {
    const user = await getAuthenticatedUser(request.header("authorization"));
    return user.id;
  } catch (error) {
    sendError(response, error);
    return undefined;
  }
}

export function createInterviewPlanRouter(dependencies: InterviewPlanDependencies): Router {
  const router = Router();

  router.post("/jobs/:id/interview-plan", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    if (!isEmptyObject(request.body)) {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
    const id = pathId(request);
    await respond(response, () => generateInterviewPlan(userId, id, dependencies));
  });

  router.get("/jobs/:id/interview-plan", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    const id = pathId(request);
    await respond(response, () => readInterviewPlan(userId, id));
  });

  return router;
}
