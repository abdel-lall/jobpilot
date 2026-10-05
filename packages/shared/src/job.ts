import { z } from "zod";
import { jobAnalysisSchema } from "./job-analysis.js";

function trimmedString(min: number, max: number) {
  return z.string().trim().min(min).max(max);
}

const urlSchema = trimmedString(1, 500).refine((value) => {
  const UrlCtor = (globalThis as { URL?: new (input: string) => { protocol: string } }).URL;
  if (UrlCtor === undefined) {
    return false;
  }
  try {
    const url = new UrlCtor(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
});

const timestampSchema = z.string().datetime();

function hasAtLeastOneField(body: object): boolean {
  return Object.keys(body).length >= 1;
}

export const jobStatusSchema = z
  .object({
    analysisCurrent: z.boolean(),
    tailoredResumePresent: z.boolean(),
    interviewPlanPresent: z.boolean(),
    latestOverallScore: z.number().min(0).max(100).nullable(),
    readinessBadge: z.literal("Interview Ready").nullable(),
  })
  .strict();

export const jobSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    companyName: z.string(),
    jobTitle: z.string(),
    jobDescription: z.string(),
    jobLocation: z.string(),
    jobUrl: z.string().nullable(),
    status: jobStatusSchema,
    analysis: jobAnalysisSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const createJobBodySchema = z
  .object({
    companyName: trimmedString(1, 200),
    jobTitle: trimmedString(1, 200),
    jobDescription: trimmedString(1, 20000),
    jobLocation: trimmedString(1, 200),
    jobUrl: urlSchema.nullable().optional(),
  })
  .strict();

export const updateJobBodySchema = z
  .object({
    companyName: trimmedString(1, 200).optional(),
    jobTitle: trimmedString(1, 200).optional(),
    jobDescription: trimmedString(1, 20000).optional(),
    jobLocation: trimmedString(1, 200).optional(),
    jobUrl: urlSchema.nullable().optional(),
  })
  .strict()
  .refine(hasAtLeastOneField);

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type Job = z.infer<typeof jobSchema>;
export type CreateJobBody = z.infer<typeof createJobBodySchema>;
export type UpdateJobBody = z.infer<typeof updateJobBodySchema>;
