import {
  assertTailoredResumeGrounded,
  createGeminiResumeModel,
  createStubResumeModel,
  tailorResume,
  type GroundingProfile,
  type ResumeTailoringModel,
  type ResumeToolClient,
} from "@jobpilot/ai";
import {
  jobAnalysisSchema,
  tailoredResumeSchema,
  type JobAnalysis,
  type TailoredResume,
} from "@jobpilot/shared";
import { getPrisma } from "../db.js";
import { TailoredResumeError } from "./errors.js";
import { createResumeToolClient } from "./mcp-client.js";

export type TailoredResumeDependencies = {
  resumeToolClient?: ResumeToolClient;
  resumeModel?: ResumeTailoringModel;
};

function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDateOrNull(value: Date | null): string | null {
  return value === null ? null : formatCalendarDate(value);
}

function resolveResumeModel(override: ResumeTailoringModel | undefined): ResumeTailoringModel {
  if (override !== undefined) {
    return override;
  }
  const selection = process.env.RESUME_MODEL;
  if (selection === "stub") {
    return createStubResumeModel();
  }
  if (selection === undefined || selection === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey !== undefined && apiKey.length > 0) {
      const configured = process.env.GEMINI_MODEL;
      const modelName =
        configured !== undefined && configured.length > 0 ? configured : "gemini-2.5-flash";
      return createGeminiResumeModel(apiKey, modelName);
    }
  }
  throw new TailoredResumeError("generation_failed");
}

function resolveResumeToolClient(
  override: ResumeToolClient | undefined,
  userId: string,
): ResumeToolClient {
  if (override !== undefined) {
    return override;
  }
  const secret = process.env.MCP_SHARED_SECRET;
  if (secret === undefined || secret.length === 0) {
    throw new TailoredResumeError("generation_failed");
  }
  const configuredUrl = process.env.MCP_URL;
  const url =
    configuredUrl !== undefined && configuredUrl.trim().length > 0
      ? configuredUrl
      : "http://127.0.0.1:3010/mcp";
  return createResumeToolClient({ url, secret, userId });
}

function toAnalysis(record: {
  requiredSkills: unknown;
  preferredSkills: unknown;
  responsibilities: unknown;
  experienceRequirements: unknown;
  technologies: unknown;
  interviewTopics: unknown;
  keywords: unknown;
}): JobAnalysis {
  return jobAnalysisSchema.parse({
    requiredSkills: record.requiredSkills,
    preferredSkills: record.preferredSkills,
    responsibilities: record.responsibilities,
    experienceRequirements: record.experienceRequirements,
    technologies: record.technologies,
    interviewTopics: record.interviewTopics,
    keywords: record.keywords,
  });
}

async function loadProfile(userId: string): Promise<GroundingProfile> {
  const prisma = getPrisma();
  const [skills, experience, projects, education, certifications] = await Promise.all([
    prisma.skill.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
    prisma.workExperience.findMany({
      where: { userId },
      select: {
        id: true,
        employer: true,
        jobTitle: true,
        startDate: true,
        endDate: true,
        accomplishments: true,
        technologies: true,
      },
    }),
    prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        url: true,
        startDate: true,
        endDate: true,
        accomplishments: true,
        technologies: true,
      },
    }),
    prisma.education.findMany({
      where: { userId },
      select: {
        id: true,
        institution: true,
        degree: true,
        fieldOfStudy: true,
        startDate: true,
        endDate: true,
      },
    }),
    prisma.certification.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        issuer: true,
        issuedOn: true,
        expiresOn: true,
      },
    }),
  ]);

  return {
    skills,
    experience: experience.map((row) => ({
      id: row.id,
      employer: row.employer,
      jobTitle: row.jobTitle,
      startDate: formatCalendarDate(row.startDate),
      endDate: formatCalendarDateOrNull(row.endDate),
      accomplishments: row.accomplishments,
      technologies: row.technologies,
    })),
    projects: projects.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      url: row.url,
      startDate: formatCalendarDateOrNull(row.startDate),
      endDate: formatCalendarDateOrNull(row.endDate),
      accomplishments: row.accomplishments,
      technologies: row.technologies,
    })),
    education: education.map((row) => ({
      id: row.id,
      institution: row.institution,
      degree: row.degree,
      fieldOfStudy: row.fieldOfStudy,
      startDate: formatCalendarDate(row.startDate),
      endDate: formatCalendarDateOrNull(row.endDate),
    })),
    certifications: certifications.map((row) => ({
      id: row.id,
      name: row.name,
      issuer: row.issuer,
      issuedOn: formatCalendarDate(row.issuedOn),
      expiresOn: formatCalendarDateOrNull(row.expiresOn),
    })),
  };
}

export async function generateTailoredResume(
  userId: string,
  jobId: string,
  dependencies: TailoredResumeDependencies,
): Promise<{ resume: TailoredResume }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: { analysis: true },
  });
  if (existing === null) {
    throw new TailoredResumeError("not_found");
  }
  if (
    existing.analysis === null ||
    existing.analysis.analyzedDescription !== existing.jobDescription
  ) {
    throw new TailoredResumeError("analysis_not_current");
  }

  const model = resolveResumeModel(dependencies.resumeModel);
  const tools = resolveResumeToolClient(dependencies.resumeToolClient, userId);
  const analysis = toAnalysis(existing.analysis);

  let resume: TailoredResume;
  try {
    resume = await tailorResume(analysis, tools, model);
    const profile = await loadProfile(userId);
    assertTailoredResumeGrounded(resume, profile, analysis);
  } catch (error) {
    if (error instanceof TailoredResumeError) {
      throw error;
    }
    throw new TailoredResumeError("generation_failed");
  }

  await getPrisma().tailoredResume.upsert({
    where: { jobId },
    create: { jobId, document: resume },
    update: { document: resume },
  });
  return { resume };
}

export async function readTailoredResume(
  userId: string,
  jobId: string,
): Promise<{ resume: TailoredResume }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: { tailoredResume: true },
  });
  if (existing === null || existing.tailoredResume === null) {
    throw new TailoredResumeError("not_found");
  }
  return { resume: tailoredResumeSchema.parse(existing.tailoredResume.document) };
}
