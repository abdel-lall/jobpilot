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

const interviewQuestionFields = {
  id: z.string(),
  position: z.number().int().min(1).max(8),
  text: z.string().trim().min(1).max(2000),
  category: interviewPlanCategorySchema,
  expectedConcepts: z.array(conceptSchema).min(1).max(10),
  rubric: z.string().trim().min(1).max(2000),
};

const unansweredInterviewQuestionSchema = z
  .object({
    ...interviewQuestionFields,
    answer: z.null(),
    feedback: z.null(),
    score: z.null(),
  })
  .strict();

const scoredInterviewQuestionSchema = z
  .object({
    ...interviewQuestionFields,
    answer: z.string().trim().min(1).max(4000),
    feedback: z.string().trim().min(1).max(4000),
    score: z.number().int().min(0).max(100),
  })
  .strict();

export const interviewQuestionSchema = z.union([
  unansweredInterviewQuestionSchema,
  scoredInterviewQuestionSchema,
]);

export const answerEvaluationModelOutputSchema = z
  .object({
    feedback: z.string().trim().min(1).max(4000),
    score: z.number().int().min(0).max(100),
  })
  .strict();

export const submitInterviewAnswerBodySchema = z
  .object({
    answer: z.string().trim().min(1).max(4000),
  })
  .strict();

export const interviewAttemptSchema = z
  .object({
    id: z.string(),
    jobId: z.string(),
    status: z.enum(["in_progress", "completed"]),
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
    const allScored = attempt.questions.every((question) => question.score !== null);
    if (allScored && attempt.status !== "completed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "a fully scored attempt must be completed",
      });
    }
    if (!allScored && attempt.status !== "in_progress") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "an attempt with an unanswered question must be in progress",
      });
    }
  });

export type InterviewQuestionModelItem = z.infer<typeof interviewQuestionModelItemSchema>;
export type InterviewQuestionModelOutput = z.infer<typeof interviewQuestionModelOutputSchema>;
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;
export type InterviewAttempt = z.infer<typeof interviewAttemptSchema>;
export type AnswerEvaluationModelOutput = z.infer<typeof answerEvaluationModelOutputSchema>;
export type SubmitInterviewAnswerBody = z.infer<typeof submitInterviewAnswerBodySchema>;
