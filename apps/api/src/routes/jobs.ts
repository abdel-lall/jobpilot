import type { JobAnalysisModel } from "@jobpilot/ai";
import { createJobBodySchema, updateJobBodySchema } from "@jobpilot/shared";
import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors.js";
import { getAuthenticatedUser } from "../auth/service.js";
import { JobError } from "../jobs/errors.js";
import { createJob, deleteJob, getJob, listJobs, updateJob } from "../jobs/service.js";

function sendJobError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (error instanceof JobError && error.code === "not_found") {
    response.status(404).json({ error: "Not found" });
    return;
  }
  if (error instanceof JobError && error.code === "analysis_failed") {
    response.status(502).json({ error: "Job analysis failed" });
    return;
  }
  response.status(500).json({ error: "Internal server error" });
}

async function respond(
  response: Response,
  status: number,
  action: () => Promise<unknown>,
): Promise<void> {
  try {
    const body = await action();
    if (status === 204) {
      response.status(204).end();
      return;
    }
    response.status(status).json(body);
  } catch (error) {
    sendJobError(response, error);
  }
}

function rejectInvalidBody(response: Response): void {
  response.status(400).json({ error: "Invalid input" });
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
    sendJobError(response, error);
    return undefined;
  }
}

export function createJobsRouter(jobAnalysisModel?: JobAnalysisModel): Router {
  const router = Router();

  router.post("/jobs", async (request, response) => {
    const parsed = createJobBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    await respond(response, 201, async () => ({
      job: await createJob(userId, parsed.data, jobAnalysisModel),
    }));
  });

  router.get("/jobs", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    await respond(response, 200, () => listJobs(userId));
  });

  router.get("/jobs/:id", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      job: await getJob(userId, id),
    }));
  });

  router.patch("/jobs/:id", async (request, response) => {
    const parsed = updateJobBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      job: await updateJob(userId, id, parsed.data, jobAnalysisModel),
    }));
  });

  router.delete("/jobs/:id", async (request, response) => {
    const userId = await requireUserId(request, response);
    if (userId === undefined) {
      return;
    }
    const id = pathId(request);
    await respond(response, 204, () => deleteJob(userId, id));
  });

  return router;
}
