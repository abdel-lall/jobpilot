import {
  certificationSchema,
  educationSchema,
  projectSchema,
  skillSchema,
  workExperienceSchema,
  type Certification,
  type CreateCertificationBody,
  type CreateEducationBody,
  type CreateProjectBody,
  type CreateSkillBody,
  type CreateWorkExperienceBody,
  type Education,
  type Project,
  type Skill,
  type UpdateCertificationBody,
  type UpdateEducationBody,
  type UpdateProjectBody,
  type UpdateSkillBody,
  type UpdateWorkExperienceBody,
  type WorkExperience,
} from "@jobpilot/shared";
import { z } from "zod";
import { authFetch, readErrorMessage } from "@/lib/api";

export const profilePaths = {
  skills: "/profile/skills",
  education: "/profile/education",
  experience: "/profile/experience",
  projects: "/profile/projects",
  certifications: "/profile/certifications",
} as const;

const skillListSchema = z.object({ skills: z.array(skillSchema) }).strict();
const educationListSchema = z.object({ education: z.array(educationSchema) }).strict();
const experienceListSchema = z.object({ experience: z.array(workExperienceSchema) }).strict();
const projectListSchema = z.object({ projects: z.array(projectSchema) }).strict();
const certificationListSchema = z.object({ certifications: z.array(certificationSchema) }).strict();

export function profileQueryKey(path: string, userId: string) {
  return [path, userId] as const;
}

export function isProfileQuery(query: { queryKey: readonly unknown[] }): boolean {
  const path = query.queryKey[0];
  return typeof path === "string" && path.startsWith("/profile/");
}

export function requestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0 && error.message !== "Failed to fetch") {
    return error.message;
  }
  return "Request failed";
}

async function send(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  accessToken: string,
  body?: unknown,
): Promise<void> {
  const response = await authFetch(path, { method, accessToken, body });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

async function readJson(path: string, accessToken: string): Promise<unknown> {
  const response = await authFetch(path, { method: "GET", accessToken });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Request failed");
  }
}

function recordPath(path: string, id: string): string {
  return `${path}/${encodeURIComponent(id)}`;
}

export async function listSkills(accessToken: string): Promise<Skill[]> {
  const parsed = skillListSchema.safeParse(await readJson(profilePaths.skills, accessToken));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.skills;
}

export async function listEducation(accessToken: string): Promise<Education[]> {
  const parsed = educationListSchema.safeParse(await readJson(profilePaths.education, accessToken));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.education;
}

export async function listExperience(accessToken: string): Promise<WorkExperience[]> {
  const parsed = experienceListSchema.safeParse(await readJson(profilePaths.experience, accessToken));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.experience;
}

export async function listProjects(accessToken: string): Promise<Project[]> {
  const parsed = projectListSchema.safeParse(await readJson(profilePaths.projects, accessToken));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.projects;
}

export async function listCertifications(accessToken: string): Promise<Certification[]> {
  const parsed = certificationListSchema.safeParse(await readJson(profilePaths.certifications, accessToken));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.certifications;
}

export function createSkill(accessToken: string, body: CreateSkillBody): Promise<void> {
  return send(profilePaths.skills, "POST", accessToken, body);
}

export function updateSkill(accessToken: string, id: string, body: UpdateSkillBody): Promise<void> {
  return send(recordPath(profilePaths.skills, id), "PATCH", accessToken, body);
}

export function deleteSkill(accessToken: string, id: string): Promise<void> {
  return send(recordPath(profilePaths.skills, id), "DELETE", accessToken);
}

export function createEducation(accessToken: string, body: CreateEducationBody): Promise<void> {
  return send(profilePaths.education, "POST", accessToken, body);
}

export function updateEducation(accessToken: string, id: string, body: UpdateEducationBody): Promise<void> {
  return send(recordPath(profilePaths.education, id), "PATCH", accessToken, body);
}

export function deleteEducation(accessToken: string, id: string): Promise<void> {
  return send(recordPath(profilePaths.education, id), "DELETE", accessToken);
}

export function createExperience(accessToken: string, body: CreateWorkExperienceBody): Promise<void> {
  return send(profilePaths.experience, "POST", accessToken, body);
}

export function updateExperience(
  accessToken: string,
  id: string,
  body: UpdateWorkExperienceBody,
): Promise<void> {
  return send(recordPath(profilePaths.experience, id), "PATCH", accessToken, body);
}

export function deleteExperience(accessToken: string, id: string): Promise<void> {
  return send(recordPath(profilePaths.experience, id), "DELETE", accessToken);
}

export function createProject(accessToken: string, body: CreateProjectBody): Promise<void> {
  return send(profilePaths.projects, "POST", accessToken, body);
}

export function updateProject(accessToken: string, id: string, body: UpdateProjectBody): Promise<void> {
  return send(recordPath(profilePaths.projects, id), "PATCH", accessToken, body);
}

export function deleteProject(accessToken: string, id: string): Promise<void> {
  return send(recordPath(profilePaths.projects, id), "DELETE", accessToken);
}

export function createCertification(accessToken: string, body: CreateCertificationBody): Promise<void> {
  return send(profilePaths.certifications, "POST", accessToken, body);
}

export function updateCertification(
  accessToken: string,
  id: string,
  body: UpdateCertificationBody,
): Promise<void> {
  return send(recordPath(profilePaths.certifications, id), "PATCH", accessToken, body);
}

export function deleteCertification(accessToken: string, id: string): Promise<void> {
  return send(recordPath(profilePaths.certifications, id), "DELETE", accessToken);
}
