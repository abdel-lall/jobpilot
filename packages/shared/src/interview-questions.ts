import { z } from "zod";
import { interviewPlanCategorySchema } from "./interview-plan.js";

export function normalizeQuestionText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

const conceptSchema = z.string().trim().min(1).max(200);

export const interviewQuestionModelItemSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
    category: z.string(),
    expectedConcepts: z.array(conceptSchema).min(1).max(10),
    rubric: z.string().trim().min(1).max(2000),
  })
  .strict();

export const interviewQuestionModelOutputSchema = z
  .object({
    questions: z.array(z.unknown()).max(8),
  })
  .strict();

export const interviewQuestionStructuredSchema = z
  .object({
    questions: z.array(interviewQuestionModelItemSchema).max(8),
  })
  .strict();

export const interviewQuestionSchema = z
  .object({
    id: z.string(),
    position: z.number().int().min(1).max(8),
    text: z.string().trim().min(1).max(2000),
    category: interviewPlanCategorySchema,
    expectedConcepts: z.array(conceptSchema).min(1).max(10),
    rubric: z.string().trim().min(1).max(2000),
    answer: z.null(),
    feedback: z.null(),
    score: z.null(),
  })
  .strict();

export const interviewAttemptSchema = z
  .object({
    id: z.string(),
    jobId: z.string(),
    status: z.literal("in_progress"),
    questions: z.array(interviewQuestionSchema).length(8),
  })
  .strict()
  .superRefine((attempt, context) => {
    for (let index = 0; index < attempt.questions.length; index += 1) {
      if (attempt.questions[index]?.position !== index + 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "position"],
          message: "positions must be 1 through 8 in order",
        });
      }
    }
  });

export type InterviewQuestionModelItem = z.infer<typeof interviewQuestionModelItemSchema>;
export type InterviewQuestionModelOutput = z.infer<typeof interviewQuestionModelOutputSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewAttempt = z.infer<typeof interviewAttemptSchema>;
