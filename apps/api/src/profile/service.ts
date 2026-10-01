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
import { getAuthenticatedUser } from "../auth/service.js";
import { getPrisma } from "../db.js";
import { ProfileError } from "./errors.js";

const listOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

async function requireUser(authorization: string | undefined) {
  return getAuthenticatedUser(authorization);
}

function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDateOrNull(value: Date | null): string | null {
  return value === null ? null : formatCalendarDate(value);
}

function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function optionalCalendarDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  return parseCalendarDate(value);
}

function assertDateOrder(start: string | null, end: string | null): void {
  if (start !== null && end !== null && end < start) {
    throw new ProfileError("invalid_input");
  }
}

function mergedDate(patchValue: string | null | undefined, stored: Date | null): string | null {
  if (patchValue === undefined) {
    return formatCalendarDateOrNull(stored);
  }
  return patchValue;
}

function toTimestamps(record: { id: string; userId: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: record.id,
    userId: record.userId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function createSkill(
  authorization: string | undefined,
  input: CreateSkillBody,
): Promise<Skill> {
  const user = await requireUser(authorization);
  const created = await getPrisma().skill.create({
    data: { userId: user.id, name: input.name },
  });
  return skillSchema.parse({ ...toTimestamps(created), name: created.name });
}

export async function listSkills(authorization: string | undefined): Promise<{ skills: Skill[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().skill.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return {
    skills: rows.map((row) => skillSchema.parse({ ...toTimestamps(row), name: row.name })),
  };
}

export async function updateSkill(
  authorization: string | undefined,
  id: string,
  patch: UpdateSkillBody,
): Promise<Skill> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().skill.findFirst({ where: { id, userId: user.id } });
  if (existing === null) {
    throw new ProfileError("not_found");
  }
  const updated = await getPrisma().skill.update({
    where: { id: existing.id },
    data: { name: patch.name },
  });
  return skillSchema.parse({ ...toTimestamps(updated), name: updated.name });
}

export async function deleteSkill(authorization: string | undefined, id: string): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().skill.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new ProfileError("not_found");
  }
}

export async function createEducation(
  authorization: string | undefined,
  input: CreateEducationBody,
): Promise<Education> {
  const user = await requireUser(authorization);
  const created = await getPrisma().education.create({
    data: {
      userId: user.id,
      institution: input.institution,
      degree: input.degree,
      fieldOfStudy: input.fieldOfStudy,
      startDate: parseCalendarDate(input.startDate),
      endDate: optionalCalendarDate(input.endDate),
    },
  });
  return educationSchema.parse(toEducationJson(created));
}

export async function listEducation(
  authorization: string | undefined,
): Promise<{ education: Education[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().education.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return { education: rows.map((row) => educationSchema.parse(toEducationJson(row))) };
}

export async function updateEducation(
  authorization: string | undefined,
  id: string,
  patch: UpdateEducationBody,
): Promise<Education> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().education.findFirst({ where: { id, userId: user.id } });
  if (existing === null) {
    throw new ProfileError("not_found");
  }
  assertDateOrder(
    mergedDate(patch.startDate, existing.startDate),
    mergedDate(patch.endDate, existing.endDate),
  );
  const updated = await getPrisma().education.update({
    where: { id: existing.id },
    data: {
      institution: patch.institution,
      degree: patch.degree,
      fieldOfStudy: patch.fieldOfStudy,
      startDate: patch.startDate === undefined ? undefined : parseCalendarDate(patch.startDate),
      endDate:
        patch.endDate === undefined
          ? undefined
          : patch.endDate === null
            ? null
            : parseCalendarDate(patch.endDate),
    },
  });
  return educationSchema.parse(toEducationJson(updated));
}

export async function deleteEducation(authorization: string | undefined, id: string): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().education.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new ProfileError("not_found");
  }
}

export async function createWorkExperience(
  authorization: string | undefined,
  input: CreateWorkExperienceBody,
): Promise<WorkExperience> {
  const user = await requireUser(authorization);
  const created = await getPrisma().workExperience.create({
    data: {
      userId: user.id,
      employer: input.employer,
      jobTitle: input.jobTitle,
      startDate: parseCalendarDate(input.startDate),
      endDate: optionalCalendarDate(input.endDate),
      accomplishments: input.accomplishments,
      technologies: input.technologies,
    },
  });
  return workExperienceSchema.parse(toWorkExperienceJson(created));
}

export async function listWorkExperience(
  authorization: string | undefined,
): Promise<{ experience: WorkExperience[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().workExperience.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return { experience: rows.map((row) => workExperienceSchema.parse(toWorkExperienceJson(row))) };
}

export async function updateWorkExperience(
  authorization: string | undefined,
  id: string,
  patch: UpdateWorkExperienceBody,
): Promise<WorkExperience> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().workExperience.findFirst({
    where: { id, userId: user.id },
  });
  if (existing === null) {
    throw new ProfileError("not_found");
  }
  assertDateOrder(
    mergedDate(patch.startDate, existing.startDate),
    mergedDate(patch.endDate, existing.endDate),
  );
  const updated = await getPrisma().workExperience.update({
    where: { id: existing.id },
    data: {
      employer: patch.employer,
      jobTitle: patch.jobTitle,
      startDate: patch.startDate === undefined ? undefined : parseCalendarDate(patch.startDate),
      endDate:
        patch.endDate === undefined
          ? undefined
          : patch.endDate === null
            ? null
            : parseCalendarDate(patch.endDate),
      accomplishments: patch.accomplishments,
      technologies: patch.technologies,
    },
  });
  return workExperienceSchema.parse(toWorkExperienceJson(updated));
}

export async function deleteWorkExperience(
  authorization: string | undefined,
  id: string,
): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().workExperience.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new ProfileError("not_found");
  }
}

export async function createProject(
  authorization: string | undefined,
  input: CreateProjectBody,
): Promise<Project> {
  const user = await requireUser(authorization);
  const created = await getPrisma().project.create({
    data: {
      userId: user.id,
      name: input.name,
      description: input.description,
      url: input.url ?? null,
      startDate: optionalCalendarDate(input.startDate),
      endDate: optionalCalendarDate(input.endDate),
      accomplishments: input.accomplishments,
      technologies: input.technologies,
    },
  });
  return projectSchema.parse(toProjectJson(created));
}

export async function listProjects(
  authorization: string | undefined,
): Promise<{ projects: Project[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().project.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return { projects: rows.map((row) => projectSchema.parse(toProjectJson(row))) };
}

export async function updateProject(
  authorization: string | undefined,
  id: string,
  patch: UpdateProjectBody,
): Promise<Project> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().project.findFirst({ where: { id, userId: user.id } });
  if (existing === null) {
    throw new ProfileError("not_found");
  }
  assertDateOrder(
    mergedDate(patch.startDate, existing.startDate),
    mergedDate(patch.endDate, existing.endDate),
  );
  const updated = await getPrisma().project.update({
    where: { id: existing.id },
    data: {
      name: patch.name,
      description: patch.description,
      url: patch.url,
      startDate:
        patch.startDate === undefined
          ? undefined
          : patch.startDate === null
            ? null
            : parseCalendarDate(patch.startDate),
      endDate:
        patch.endDate === undefined
          ? undefined
          : patch.endDate === null
            ? null
            : parseCalendarDate(patch.endDate),
      accomplishments: patch.accomplishments,
      technologies: patch.technologies,
    },
  });
  return projectSchema.parse(toProjectJson(updated));
}

export async function deleteProject(authorization: string | undefined, id: string): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().project.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new ProfileError("not_found");
  }
}

export async function createCertification(
  authorization: string | undefined,
  input: CreateCertificationBody,
): Promise<Certification> {
  const user = await requireUser(authorization);
  const created = await getPrisma().certification.create({
    data: {
      userId: user.id,
      name: input.name,
      issuer: input.issuer,
      issuedOn: parseCalendarDate(input.issuedOn),
      expiresOn: optionalCalendarDate(input.expiresOn),
    },
  });
  return certificationSchema.parse(toCertificationJson(created));
}

export async function listCertifications(
  authorization: string | undefined,
): Promise<{ certifications: Certification[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().certification.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return {
    certifications: rows.map((row) => certificationSchema.parse(toCertificationJson(row))),
  };
}

export async function updateCertification(
  authorization: string | undefined,
  id: string,
  patch: UpdateCertificationBody,
): Promise<Certification> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().certification.findFirst({
    where: { id, userId: user.id },
  });
  if (existing === null) {
    throw new ProfileError("not_found");
  }
  assertDateOrder(
    mergedDate(patch.issuedOn, existing.issuedOn),
    mergedDate(patch.expiresOn, existing.expiresOn),
  );
  const updated = await getPrisma().certification.update({
    where: { id: existing.id },
    data: {
      name: patch.name,
      issuer: patch.issuer,
      issuedOn: patch.issuedOn === undefined ? undefined : parseCalendarDate(patch.issuedOn),
      expiresOn:
        patch.expiresOn === undefined
          ? undefined
          : patch.expiresOn === null
            ? null
            : parseCalendarDate(patch.expiresOn),
    },
  });
  return certificationSchema.parse(toCertificationJson(updated));
}

export async function deleteCertification(
  authorization: string | undefined,
  id: string,
): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().certification.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new ProfileError("not_found");
  }
}

function toEducationJson(record: {
  id: string;
  userId: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toTimestamps(record),
    institution: record.institution,
    degree: record.degree,
    fieldOfStudy: record.fieldOfStudy,
    startDate: formatCalendarDate(record.startDate),
    endDate: formatCalendarDateOrNull(record.endDate),
  };
}

function toWorkExperienceJson(record: {
  id: string;
  userId: string;
  employer: string;
  jobTitle: string;
  startDate: Date;
  endDate: Date | null;
  accomplishments: string[];
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toTimestamps(record),
    employer: record.employer,
    jobTitle: record.jobTitle,
    startDate: formatCalendarDate(record.startDate),
    endDate: formatCalendarDateOrNull(record.endDate),
    accomplishments: record.accomplishments,
    technologies: record.technologies,
  };
}

function toProjectJson(record: {
  id: string;
  userId: string;
  name: string;
  description: string;
  url: string | null;
  startDate: Date | null;
  endDate: Date | null;
  accomplishments: string[];
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toTimestamps(record),
    name: record.name,
    description: record.description,
    url: record.url,
    startDate: formatCalendarDateOrNull(record.startDate),
    endDate: formatCalendarDateOrNull(record.endDate),
    accomplishments: record.accomplishments,
    technologies: record.technologies,
  };
}

function toCertificationJson(record: {
  id: string;
  userId: string;
  name: string;
  issuer: string;
  issuedOn: Date;
  expiresOn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toTimestamps(record),
    name: record.name,
    issuer: record.issuer,
    issuedOn: formatCalendarDate(record.issuedOn),
    expiresOn: formatCalendarDateOrNull(record.expiresOn),
  };
}
