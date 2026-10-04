import {
  createGeminiInterviewPlanModel,
  createStubInterviewPlanModel,
  planInterview,
  type InterviewPlanModel,
} from "@jobpilot/ai";
import {
  interviewPlanSchema,
  jobAnalysisSchema,
  type InterviewPlan,
  type JobAnalysis,
} from "@jobpilot/shared";
import { getPrisma } from "../db.js";
import { InterviewPlanError } from "./errors.js";

export type InterviewPlanDependencies = {
  interviewPlanModel?: InterviewPlanModel;
};

function resolveInterviewPlanModel(override: InterviewPlanModel | undefined): InterviewPlanModel {
  if (override !== undefined) {
    return override;
  }
  const selection = process.env.INTERVIEW_PLAN_MODEL;
  if (selection === "stub") {
    return createStubInterviewPlanModel();
  }
  if (selection === undefined || selection === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey !== undefined && apiKey.length > 0) {
      const configured = process.env.GEMINI_MODEL;
      const modelName =
        configured !== undefined && configured.length > 0 ? configured : "gemini-2.5-flash";
      return createGeminiInterviewPlanModel(apiKey, modelName);
    }
  }
  throw new InterviewPlanError("generation_failed");
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

export async function generateInterviewPlan(
  userId: string,
  jobId: string,
  dependencies: InterviewPlanDependencies,
): Promise<{ plan: InterviewPlan }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: { analysis: true },
  });
  if (existing === null) {
    throw new InterviewPlanError("not_found");
  }
  if (
    existing.analysis === null ||
    existing.analysis.analyzedDescription !== existing.jobDescription
  ) {
    throw new InterviewPlanError("analysis_not_current");
  }

  let plan: InterviewPlan;
  try {
    const model = resolveInterviewPlanModel(dependencies.interviewPlanModel);
    plan = await planInterview(toAnalysis(existing.analysis), model);
  } catch (error) {
    if (error instanceof InterviewPlanError) {
      throw error;
    }
    throw new InterviewPlanError("generation_failed");
  }

  await getPrisma().interviewPlan.upsert({
    where: { jobId },
    create: { jobId, document: plan },
    update: { document: plan },
  });
  return { plan };
}

export async function readInterviewPlan(
  userId: string,
  jobId: string,
): Promise<{ plan: InterviewPlan }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: { interviewPlan: true },
  });
  if (existing === null || existing.interviewPlan === null) {
    throw new InterviewPlanError("not_found");
  }
  return { plan: interviewPlanSchema.parse(existing.interviewPlan.document) };
}
