import { z } from "zod";

const analysisItemSchema = z.string().trim().min(1).max(200);
const analysisListSchema = z.array(analysisItemSchema).max(50);

export const jobAnalysisSchema = z
  .object({
    requiredSkills: analysisListSchema,
    preferredSkills: analysisListSchema,
    responsibilities: analysisListSchema,
    experienceRequirements: analysisListSchema,
    technologies: analysisListSchema,
    interviewTopics: analysisListSchema,
    keywords: analysisListSchema,
  })
  .strict();

export type JobAnalysis = z.infer<typeof jobAnalysisSchema>;
