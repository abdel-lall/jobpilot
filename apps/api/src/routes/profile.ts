import {
  createCertificationBodySchema,
  createEducationBodySchema,
  createProjectBodySchema,
  createSkillBodySchema,
  createWorkExperienceBodySchema,
  updateCertificationBodySchema,
  updateEducationBodySchema,
  updateProjectBodySchema,
  updateSkillBodySchema,
  updateWorkExperienceBodySchema,
} from "@jobpilot/shared";
import { Router, type Request, type Response } from "express";
import { AuthError } from "../auth/errors.js";
import { ProfileError } from "../profile/errors.js";
import {
  createCertification,
  createEducation,
  createProject,
  createSkill,
  createWorkExperience,
  deleteCertification,
  deleteEducation,
  deleteProject,
  deleteSkill,
  deleteWorkExperience,
  listCertifications,
  listEducation,
  listProjects,
  listSkills,
  listWorkExperience,
  updateCertification,
  updateEducation,
  updateProject,
  updateSkill,
  updateWorkExperience,
} from "../profile/service.js";

function sendProfileError(response: Response, error: unknown): void {
  if (error instanceof AuthError) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (error instanceof ProfileError) {
    if (error.code === "not_found") {
      response.status(404).json({ error: "Not found" });
      return;
    }
    response.status(400).json({ error: "Invalid input" });
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
    sendProfileError(response, error);
  }
}

function rejectInvalidBody(response: Response): void {
  response.status(400).json({ error: "Invalid input" });
}

function pathId(request: Request): string {
  const id = request.params.id;
  return typeof id === "string" ? id : "";
}

export function createProfileRouter(): Router {
  const router = Router();

  router.post("/profile/skills", async (request, response) => {
    const parsed = createSkillBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    await respond(response, 201, async () => ({
      skill: await createSkill(request.header("authorization"), parsed.data),
    }));
  });

  router.get("/profile/skills", async (request, response) => {
    await respond(response, 200, () => listSkills(request.header("authorization")));
  });

  router.patch("/profile/skills/:id", async (request, response) => {
    const parsed = updateSkillBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      skill: await updateSkill(request.header("authorization"), id, parsed.data),
    }));
  });

  router.delete("/profile/skills/:id", async (request, response) => {
    const id = pathId(request);
    await respond(response, 204, () => deleteSkill(request.header("authorization"), id));
  });

  router.post("/profile/education", async (request, response) => {
    const parsed = createEducationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    await respond(response, 201, async () => ({
      education: await createEducation(request.header("authorization"), parsed.data),
    }));
  });

  router.get("/profile/education", async (request, response) => {
    await respond(response, 200, () => listEducation(request.header("authorization")));
  });

  router.patch("/profile/education/:id", async (request, response) => {
    const parsed = updateEducationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      education: await updateEducation(request.header("authorization"), id, parsed.data),
    }));
  });

  router.delete("/profile/education/:id", async (request, response) => {
    const id = pathId(request);
    await respond(response, 204, () => deleteEducation(request.header("authorization"), id));
  });

  router.post("/profile/experience", async (request, response) => {
    const parsed = createWorkExperienceBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    await respond(response, 201, async () => ({
      experience: await createWorkExperience(request.header("authorization"), parsed.data),
    }));
  });

  router.get("/profile/experience", async (request, response) => {
    await respond(response, 200, () => listWorkExperience(request.header("authorization")));
  });

  router.patch("/profile/experience/:id", async (request, response) => {
    const parsed = updateWorkExperienceBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      experience: await updateWorkExperience(request.header("authorization"), id, parsed.data),
    }));
  });

  router.delete("/profile/experience/:id", async (request, response) => {
    const id = pathId(request);
    await respond(response, 204, () => deleteWorkExperience(request.header("authorization"), id));
  });

  router.post("/profile/projects", async (request, response) => {
    const parsed = createProjectBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    await respond(response, 201, async () => ({
      project: await createProject(request.header("authorization"), parsed.data),
    }));
  });

  router.get("/profile/projects", async (request, response) => {
    await respond(response, 200, () => listProjects(request.header("authorization")));
  });

  router.patch("/profile/projects/:id", async (request, response) => {
    const parsed = updateProjectBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      project: await updateProject(request.header("authorization"), id, parsed.data),
    }));
  });

  router.delete("/profile/projects/:id", async (request, response) => {
    const id = pathId(request);
    await respond(response, 204, () => deleteProject(request.header("authorization"), id));
  });

  router.post("/profile/certifications", async (request, response) => {
    const parsed = createCertificationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    await respond(response, 201, async () => ({
      certification: await createCertification(request.header("authorization"), parsed.data),
    }));
  });

  router.get("/profile/certifications", async (request, response) => {
    await respond(response, 200, () => listCertifications(request.header("authorization")));
  });

  router.patch("/profile/certifications/:id", async (request, response) => {
    const parsed = updateCertificationBodySchema.safeParse(request.body);
    if (!parsed.success) {
      rejectInvalidBody(response);
      return;
    }
    const id = pathId(request);
    await respond(response, 200, async () => ({
      certification: await updateCertification(request.header("authorization"), id, parsed.data),
    }));
  });

  router.delete("/profile/certifications/:id", async (request, response) => {
    const id = pathId(request);
    await respond(response, 204, () => deleteCertification(request.header("authorization"), id));
  });

  return router;
}
