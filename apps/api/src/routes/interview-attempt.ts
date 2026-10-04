import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors.js";
import { getAuthenticatedUser } from "../auth/service.js";
import { InterviewAttemptError } from "../interview-attempt/errors.js";
import {
  readInterviewAttempt,
  startInterviewAttempt,
  type InterviewAttemptDependencies,
} from "../interview-attempt/service.js";

function isEmptyObject(body: unknown): boolean {
  return body !== null && typeof body === "object" && !Array.isArray(body) && Object.keys(body).length === 0;
}

function sendError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (error instanceof InterviewAttemptError && error.code === "not_found") {
    response.status(404).json({ error: "Not found" });
    return;
  }
  if (error instanceof InterviewAttemptError && error.code === "analysis_not_current") {
    response.status(409).json({ error: "Job analysis is not current" });
    return;
  }
  if (error instanceof InterviewAttemptError && error.code === "plan_not_current") {
    response.status(409).json({ error: "Interview plan is not current" });
    return;
  }
  if (error instanceof InterviewAttemptError && error.code === "already_in_progress") {
    response.status(409).json({ error: "Interview attempt already in progress" });
    return;
  }
  if (error instanceof InterviewAttemptError && error.code === "generation_failed") {
    response.status(502).json({ error: "Interview question generation failed" });
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

export function createInterviewAttemptRouter(dependencies: InterviewAttemptDependencies): Router {
  const router = Router();

  router.post("/jobs/:id/interview-attempts", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    if (!isEmptyObject(request.body)) {
      response.status(400).json({ error: "Invalid input" });
      return;
    }
    const id = pathId(request);
    await respond(response, () => startInterviewAttempt(userId, id, dependencies));
  });

  router.get("/jobs/:id/interview-attempts/current", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    const id = pathId(request);
    await respond(response, () => readInterviewAttempt(userId, id));
  });

  return router;
}
