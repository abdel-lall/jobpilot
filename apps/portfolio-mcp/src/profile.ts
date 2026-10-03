import {
  certificationSchema,
  educationSchema,
  projectSchema,
  skillSchema,
  workExperienceSchema,
} from "@jobpilot/shared";
import { getPrisma } from "./db.js";

const publicSkillSchema = skillSchema.omit({ userId: true });
const publicEducationSchema = educationSchema.omit({ userId: true });
const publicWorkExperienceSchema = workExperienceSchema.omit({ userId: true });
const publicProjectSchema = projectSchema.omit({ userId: true });
const publicCertificationSchema = certificationSchema.omit({ userId: true });

const listOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDateOrNull(value: Date | null): string | null {
  return value === null ? null : formatCalendarDate(value);
}

function toTimestamps(record: { id: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function listSkills(userId: string) {
  const rows = await getPrisma().skill.findMany({
    where: { userId },
    orderBy: listOrder,
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });
  return rows.map((row) => publicSkillSchema.parse({ ...toTimestamps(row), name: row.name }));
}

export async function listEducation(userId: string) {
  const rows = await getPrisma().education.findMany({
    where: { userId },
    orderBy: listOrder,
    select: {
      id: true,
      institution: true,
      degree: true,
      fieldOfStudy: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) =>
    publicEducationSchema.parse({
      ...toTimestamps(row),
      institution: row.institution,
      degree: row.degree,
      fieldOfStudy: row.fieldOfStudy,
      startDate: formatCalendarDate(row.startDate),
      endDate: formatCalendarDateOrNull(row.endDate),
    }),
  );
}

const experienceSelect = {
  id: true,
  employer: true,
  jobTitle: true,
  startDate: true,
  endDate: true,
  accomplishments: true,
  technologies: true,
  createdAt: true,
  updatedAt: true,
} as const;

const projectSelect = {
  id: true,
  name: true,
  description: true,
  url: true,
  startDate: true,
  endDate: true,
  accomplishments: true,
  technologies: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toPublicExperience(row: {
  id: string;
  employer: string;
  jobTitle: string;
  startDate: Date;
  endDate: Date | null;
  accomplishments: string[];
  technologies: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return publicWorkExperienceSchema.parse({
    ...toTimestamps(row),
    employer: row.employer,
    jobTitle: row.jobTitle,
    startDate: formatCalendarDate(row.startDate),
    endDate: formatCalendarDateOrNull(row.endDate),
    accomplishments: row.accomplishments,
    technologies: row.technologies,
  });
}

export async function listExperience(userId: string) {
  const rows = await getPrisma().workExperience.findMany({
    where: { userId },
    orderBy: listOrder,
    select: experienceSelect,
  });
  return rows.map((row) => toPublicExperience(row));
}

export async function publicExperienceByIds(userId: string, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, ReturnType<typeof toPublicExperience>>();
  }
  const rows = await getPrisma().workExperience.findMany({
    where: { userId, id: { in: ids } },
    select: experienceSelect,
  });
  return new Map(rows.map((row) => [row.id, toPublicExperience(row)]));
}

export async function listProjects(userId: string) {
  const rows = await getPrisma().project.findMany({
    where: { userId },
    orderBy: listOrder,
    select: projectSelect,
  });
  return rows.map((row) => publicProjectSchema.parse(toProjectJson(row)));
}

export async function publicProjectByIds(userId: string, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, ReturnType<typeof toProjectJson>>();
  }
  const rows = await getPrisma().project.findMany({
    where: { userId, id: { in: ids } },
    select: projectSelect,
  });
  return new Map(rows.map((row) => [row.id, publicProjectSchema.parse(toProjectJson(row))]));
}

export async function getProject(userId: string, projectId: string) {
  const row = await getPrisma().project.findFirst({
    where: { id: projectId, userId },
    select: projectSelect,
  });
  if (row === null) {
    return null;
  }
  return publicProjectSchema.parse(toProjectJson(row));
}

export async function listCertifications(userId: string) {
  const rows = await getPrisma().certification.findMany({
    where: { userId },
    orderBy: listOrder,
    select: {
      id: true,
      name: true,
      issuer: true,
      issuedOn: true,
      expiresOn: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) =>
    publicCertificationSchema.parse({
      ...toTimestamps(row),
      name: row.name,
      issuer: row.issuer,
      issuedOn: formatCalendarDate(row.issuedOn),
      expiresOn: formatCalendarDateOrNull(row.expiresOn),
    }),
  );
}

function toProjectJson(row: {
  id: string;
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
    ...toTimestamps(row),
    name: row.name,
    description: row.description,
    url: row.url,
    startDate: formatCalendarDateOrNull(row.startDate),
    endDate: formatCalendarDateOrNull(row.endDate),
    accomplishments: row.accomplishments,
    technologies: row.technologies,
  };
}
