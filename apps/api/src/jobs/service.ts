import {
  analyzeJobDescription,
  createGeminiJobAnalysisModel,
  createStubJobAnalysisModel,
  type JobAnalysisModel,
} from "@jobpilot/ai";
import {
  jobAnalysisSchema,
  jobSchema,
  type CreateJobBody,
  type Job,
  type JobAnalysis,
  type UpdateJobBody,
} from "@jobpilot/shared";
import { getPrisma } from "../db.js";
import { JobError } from "./errors.js";

const listOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];
const withAnalysis = { analysis: true } as const;

const emptyCompanionStatus = {
  tailoredResumePresent: false,
  interviewPlanPresent: false,
  latestOverallScore: null,
  readinessBadge: null,
} as const;

type StoredAnalysis = {
  analyzedDescription: string;
  requiredSkills: unknown;
  preferredSkills: unknown;
  responsibilities: unknown;
  experienceRequirements: unknown;
  technologies: unknown;
  interviewTopics: unknown;
  keywords: unknown;
};

type StoredJob = {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  jobLocation: string;
  jobUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  analysis: StoredAnalysis | null;
};

function analysisColumns(description: string, analysis: JobAnalysis) {
  return {
    analyzedDescription: description,
    requiredSkills: analysis.requiredSkills,
    preferredSkills: analysis.preferredSkills,
    responsibilities: analysis.responsibilities,
    experienceRequirements: analysis.experienceRequirements,
    technologies: analysis.technologies,
    interviewTopics: analysis.interviewTopics,
    keywords: analysis.keywords,
  };
}

function resolveJobAnalysisModel(override: JobAnalysisModel | undefined): JobAnalysisModel {
  if (override !== undefined) {
    return override;
  }
  const selection = process.env.JOB_ANALYSIS_MODEL;
  if (selection === "stub") {
    return createStubJobAnalysisModel();
  }
  if (selection === undefined || selection === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey !== undefined && apiKey.length > 0) {
      const configured = process.env.GEMINI_MODEL;
      const modelName =
        configured !== undefined && configured.length > 0 ? configured : "gemini-2.5-flash";
      return createGeminiJobAnalysisModel(apiKey, modelName);
    }
  }
  throw new JobError("analysis_failed");
}

async function analyzeForWrite(
  jobDescription: string,
  override: JobAnalysisModel | undefined,
): Promise<JobAnalysis> {
  try {
    return await analyzeJobDescription(jobDescription, resolveJobAnalysisModel(override));
  } catch (error) {
    if (error instanceof JobError) {
      throw error;
    }
    throw new JobError("analysis_failed");
  }
}

function toJob(record: StoredJob): Job {
  const analysis =
    record.analysis === null
      ? null
      : jobAnalysisSchema.parse({
          requiredSkills: record.analysis.requiredSkills,
          preferredSkills: record.analysis.preferredSkills,
          responsibilities: record.analysis.responsibilities,
          experienceRequirements: record.analysis.experienceRequirements,
          technologies: record.analysis.technologies,
          interviewTopics: record.analysis.interviewTopics,
          keywords: record.analysis.keywords,
        });
  return jobSchema.parse({
    id: record.id,
    userId: record.userId,
    companyName: record.companyName,
    jobTitle: record.jobTitle,
    jobDescription: record.jobDescription,
    jobLocation: record.jobLocation,
    jobUrl: record.jobUrl,
    status: {
      analysisCurrent:
        record.analysis !== null && record.analysis.analyzedDescription === record.jobDescription,
      ...emptyCompanionStatus,
    },
    analysis,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export async function createJob(
  userId: string,
  input: CreateJobBody,
  jobAnalysisModel?: JobAnalysisModel,
): Promise<Job> {
  const analysis = await analyzeForWrite(input.jobDescription, jobAnalysisModel);
  const created = await getPrisma().$transaction((tx) =>
    tx.job.create({
      data: {
        userId,
        companyName: input.companyName,
        jobTitle: input.jobTitle,
        jobDescription: input.jobDescription,
        jobLocation: input.jobLocation,
        jobUrl: input.jobUrl ?? null,
        analysis: {
          create: analysisColumns(input.jobDescription, analysis),
        },
      },
      include: withAnalysis,
    }),
  );
  return toJob(created);
}

export async function listJobs(userId: string): Promise<{ jobs: Job[] }> {
  const rows = await getPrisma().job.findMany({
    where: { userId },
    orderBy: listOrder,
    include: withAnalysis,
  });
  return { jobs: rows.map((row) => toJob(row)) };
}

export async function getJob(userId: string, id: string): Promise<Job> {
  const existing = await getPrisma().job.findFirst({
    where: { id, userId },
    include: withAnalysis,
  });
  if (existing === null) {
    throw new JobError("not_found");
  }
  return toJob(existing);
}

export async function updateJob(
  userId: string,
  id: string,
  patch: UpdateJobBody,
  jobAnalysisModel?: JobAnalysisModel,
): Promise<Job> {
  const existing = await getPrisma().job.findFirst({
    where: { id, userId },
    include: withAnalysis,
  });
  if (existing === null) {
    throw new JobError("not_found");
  }

  if (patch.jobDescription === undefined || patch.jobDescription === existing.jobDescription) {
    const updated = await getPrisma().job.update({
      where: { id: existing.id },
      data: {
        companyName: patch.companyName,
        jobTitle: patch.jobTitle,
        jobDescription: patch.jobDescription,
        jobLocation: patch.jobLocation,
        jobUrl: patch.jobUrl,
      },
      include: withAnalysis,
    });
    return toJob(updated);
  }

  const nextDescription = patch.jobDescription;
  const analysis = await analyzeForWrite(nextDescription, jobAnalysisModel);
  const updated = await getPrisma().$transaction((tx) =>
    tx.job.update({
      where: { id: existing.id },
      data: {
        companyName: patch.companyName,
        jobTitle: patch.jobTitle,
        jobDescription: nextDescription,
        jobLocation: patch.jobLocation,
        jobUrl: patch.jobUrl,
        analysis: {
          upsert: {
            create: analysisColumns(nextDescription, analysis),
            update: analysisColumns(nextDescription, analysis),
          },
        },
      },
      include: withAnalysis,
    }),
  );
  return toJob(updated);
}

export async function deleteJob(userId: string, id: string): Promise<void> {
  const result = await getPrisma().job.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new JobError("not_found");
  }
}
