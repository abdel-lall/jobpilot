import { z } from "zod";
import { jobAnalysisSchema } from "./job-analysis.js";

export const interviewPlanCategorySchema = z.enum([
  "Data structures and algorithms",
  "Frontend",
  "Backend",
  "System design",
  "Machine learning",
  "AI/LLM systems",
  "Behavioral questions",
]);

const interviewPlanCategoriesSchema = z
  .array(interviewPlanCategorySchema)
  .min(1)
  .max(7)
  .refine((categories) => new Set(categories).size === categories.length);

export const interviewPlanModelOutputSchema = z
  .object({
    categories: interviewPlanCategoriesSchema,
  })
  .strict();

export const interviewPlanSchema = z
  .object({
    categories: interviewPlanCategoriesSchema,
    interviewTopics: jobAnalysisSchema.shape.interviewTopics,
  })
  .strict();

export type InterviewPlanCategory = z.infer<typeof interviewPlanCategorySchema>;
export type InterviewPlanModelOutput = z.infer<typeof interviewPlanModelOutputSchema>;
export type InterviewPlan = z.infer<typeof interviewPlanSchema>;
