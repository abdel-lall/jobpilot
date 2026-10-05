import {
  createGeminiAnswerEvaluationModel,
  createGeminiInterviewQuestionModel,
  createStubAnswerEvaluationModel,
  createStubInterviewQuestionModel,
  evaluateAnswer,
  generateInterviewQuestions,
  type AnswerEvaluationModel,
  type GeneratedInterviewQuestion,
  type InterviewQuestionModel,
} from "@jobpilot/ai";
import {
  interviewAttemptSchema,
  interviewPlanSchema,
  normalizeQuestionText,
  type InterviewAttempt,
  type InterviewPlan,
} from "@jobpilot/shared";
import { getPrisma } from "../db.js";
import { InterviewAttemptError } from "./errors.js";

export type InterviewAttemptDependencies = {
  interviewQuestionModel?: InterviewQuestionModel;
  answerEvaluationModel?: AnswerEvaluationModel;
};

type StoredQuestion = {
  id: string;
  position: number;
  text: string;
  category: string;
  expectedConcepts: unknown;
  rubric: string;
  answer: string | null;
  feedback: string | null;
  score: number | null;
};

type StoredAttempt = {
  id: string;
  jobId: string;
  status: "in_progress" | "completed";
  createdAt: Date;
  questions: StoredQuestion[];
};

function isLaterCompleted(candidate: StoredAttempt, current: StoredAttempt): boolean {
  const createdAt = candidate.createdAt.getTime() - current.createdAt.getTime();
  if (createdAt !== 0) {
    return createdAt > 0;
  }
  return candidate.id > current.id;
}

function selectCurrentAttempt(attempts: readonly StoredAttempt[]): StoredAttempt | undefined {
  const inProgress = attempts.find((attempt) => attempt.status === "in_progress");
  if (inProgress !== undefined) {
    return inProgress;
  }
  return attempts.reduce<StoredAttempt | undefined>((latest, attempt) => {
    if (attempt.status !== "completed") {
      return latest;
    }
    if (latest === undefined || isLaterCompleted(attempt, latest)) {
      return attempt;
    }
    return latest;
  }, undefined);
}

function resolveAnswerEvaluationModel(
  override: AnswerEvaluationModel | undefined,
): AnswerEvaluationModel {
  if (override !== undefined) {
    return override;
  }
  const selection = process.env.ANSWER_EVALUATION_MODEL;
  if (selection === "stub") {
    return createStubAnswerEvaluationModel();
  }
  if (selection === undefined || selection === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey !== undefined && apiKey.length > 0) {
      const configured = process.env.GEMINI_MODEL;
      const modelName =
        configured !== undefined && configured.length > 0 ? configured : "gemini-2.5-flash";
      return createGeminiAnswerEvaluationModel(apiKey, modelName);
    }
  }
  throw new InterviewAttemptError("evaluation_failed");
}

function resolveInterviewQuestionModel(
  override: InterviewQuestionModel | undefined,
): InterviewQuestionModel {
  if (override !== undefined) {
    return override;
  }
  const selection = process.env.INTERVIEW_QUESTION_MODEL;
  if (selection === "stub") {
    return createStubInterviewQuestionModel();
  }
  if (selection === undefined || selection === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey !== undefined && apiKey.length > 0) {
      const configured = process.env.GEMINI_MODEL;
      const modelName =
        configured !== undefined && configured.length > 0 ? configured : "gemini-2.5-flash";
      return createGeminiInterviewQuestionModel(apiKey, modelName);
    }
  }
  throw new InterviewAttemptError("generation_failed");
}

function errorBlob(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null || seen.has(value)) {
      return;
    }
    seen.add(value);
    if ("code" in value && typeof value.code === "string") {
      parts.push(value.code);
    }
    if ("message" in value && typeof value.message === "string") {
      parts.push(value.message);
    }
    if ("meta" in value) {
      parts.push(JSON.stringify(value.meta));
    }
    if ("cause" in value) {
      visit(value.cause);
    }
  };
  visit(error);
  return parts.join(" ");
}

function mapWriteError(error: unknown): never {
  if (error instanceof InterviewAttemptError) {
    throw error;
  }
  const blob = errorBlob(error);
  if (blob.includes("InterviewAttempt_one_in_progress_per_job")) {
    throw new InterviewAttemptError("already_in_progress");
  }
  if (blob.includes("normalizedText")) {
    throw new InterviewAttemptError("generation_failed");
  }
  if (blob.includes("P2002") && blob.includes("InterviewAttempt")) {
    throw new InterviewAttemptError("already_in_progress");
  }
  throw error;
}

function toAttempt(attempt: StoredAttempt): { attempt: InterviewAttempt } {
  const questions = [...attempt.questions].sort((left, right) => left.position - right.position);
  return {
    attempt: interviewAttemptSchema.parse({
      id: attempt.id,
      jobId: attempt.jobId,
      status: attempt.status,
      questions: questions.map((question) => ({
        id: question.id,
        position: question.position,
        text: question.text,
        category: question.category,
        expectedConcepts: question.expectedConcepts,
        rubric: question.rubric,
        answer: question.answer,
        feedback: question.feedback,
        score: question.score,
      })),
    }),
  };
}

export async function startInterviewAttempt(
  userId: string,
  jobId: string,
  dependencies: InterviewAttemptDependencies,
): Promise<{ attempt: InterviewAttempt }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: {
      analysis: true,
      interviewPlan: true,
      interviewAttempts: {
        orderBy: { createdAt: "asc" },
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  if (existing === null) {
    throw new InterviewAttemptError("not_found");
  }
  if (
    existing.analysis === null ||
    existing.analysis.analyzedDescription !== existing.jobDescription
  ) {
    throw new InterviewAttemptError("analysis_not_current");
  }
  if (existing.interviewPlan === null) {
    throw new InterviewAttemptError("plan_not_current");
  }
  const parsedPlan = interviewPlanSchema.safeParse(existing.interviewPlan.document);
  if (!parsedPlan.success) {
    throw new InterviewAttemptError("plan_not_current");
  }
  if (existing.interviewAttempts.some((attempt) => attempt.status === "in_progress")) {
    throw new InterviewAttemptError("already_in_progress");
  }

  const storedQuestionTexts = existing.interviewAttempts.flatMap((attempt) =>
    attempt.questions.map((question) => question.text),
  );
  const plan: InterviewPlan = parsedPlan.data;
  let generated: GeneratedInterviewQuestion[];
  try {
    const model = resolveInterviewQuestionModel(dependencies.interviewQuestionModel);
    generated = await generateInterviewQuestions(plan, storedQuestionTexts, model);
  } catch (error) {
    if (error instanceof InterviewAttemptError) {
      throw error;
    }
    throw new InterviewAttemptError("generation_failed");
  }

  const normalizedTexts = generated.map((question) => normalizeQuestionText(question.text));
  if (new Set(normalizedTexts).size !== normalizedTexts.length) {
    throw new InterviewAttemptError("generation_failed");
  }

  try {
    const created = await getPrisma().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Job" WHERE "id" = ${jobId} FOR UPDATE`;
      const attempts = await tx.interviewAttempt.findMany({
        where: { jobId },
        select: { status: true },
      });
      if (attempts.some((item) => item.status === "in_progress")) {
        throw new InterviewAttemptError("already_in_progress");
      }
      const collision = await tx.interviewQuestion.findFirst({
        where: { jobId, normalizedText: { in: normalizedTexts } },
        select: { id: true },
      });
      if (collision !== null) {
        throw new InterviewAttemptError("generation_failed");
      }
      return tx.interviewAttempt.create({
        data: {
          jobId,
          status: "in_progress",
          questions: {
            create: generated.map((question, index) => ({
              jobId,
              position: index + 1,
              text: question.text,
              normalizedText: normalizedTexts[index] ?? normalizeQuestionText(question.text),
              category: question.category,
              expectedConcepts: question.expectedConcepts,
              rubric: question.rubric,
              answer: null,
              feedback: null,
              score: null,
            })),
          },
        },
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      });
    });
    return toAttempt(created);
  } catch (error) {
    mapWriteError(error);
  }
}

export async function readInterviewAttempt(
  userId: string,
  jobId: string,
): Promise<{ attempt: InterviewAttempt }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: {
      interviewAttempts: {
        orderBy: { createdAt: "asc" },
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  if (existing === null) {
    throw new InterviewAttemptError("not_found");
  }
  const attempt = selectCurrentAttempt(existing.interviewAttempts);
  if (attempt === undefined) {
    throw new InterviewAttemptError("not_found");
  }
  return toAttempt(attempt);
}

export async function submitInterviewAnswer(
  userId: string,
  jobId: string,
  questionId: string,
  answer: string,
  dependencies: InterviewAttemptDependencies,
): Promise<{ attempt: InterviewAttempt }> {
  const existing = await getPrisma().job.findFirst({
    where: { id: jobId, userId },
    include: {
      interviewAttempts: {
        orderBy: { createdAt: "asc" },
        include: {
          questions: { orderBy: { position: "asc" } },
        },
      },
    },
  });
  if (existing === null) {
    throw new InterviewAttemptError("not_found");
  }
  const attempt = selectCurrentAttempt(existing.interviewAttempts);
  if (attempt === undefined) {
    throw new InterviewAttemptError("not_found");
  }
  const question = attempt.questions.find((item) => item.id === questionId);
  if (question === undefined) {
    throw new InterviewAttemptError("not_found");
  }
  if (question.answer !== null || question.feedback !== null || question.score !== null) {
    throw new InterviewAttemptError("already_answered");
  }
  if (attempt.status !== "in_progress") {
    throw new InterviewAttemptError("already_completed");
  }

  const trimmed = answer.trim();
  let evaluated: { feedback: string; score: number };
  try {
    const model = resolveAnswerEvaluationModel(dependencies.answerEvaluationModel);
    evaluated = await evaluateAnswer(question.text, question.rubric, trimmed, model);
  } catch (error) {
    if (error instanceof InterviewAttemptError) {
      throw error;
    }
    throw new InterviewAttemptError("evaluation_failed");
  }

  const updated = await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "InterviewAttempt" WHERE "id" = ${attempt.id} FOR UPDATE`;
    const written = await tx.interviewQuestion.updateMany({
      where: {
        id: questionId,
        attemptId: attempt.id,
        answer: null,
        feedback: null,
        score: null,
      },
      data: {
        answer: trimmed,
        feedback: evaluated.feedback,
        score: evaluated.score,
      },
    });
    if (written.count !== 1) {
      throw new InterviewAttemptError("already_answered");
    }
    const current = await tx.interviewAttempt.findFirst({
      where: { id: attempt.id },
      select: { status: true },
    });
    if (current === null || current.status !== "in_progress") {
      throw new InterviewAttemptError("already_completed");
    }
    const scoredCount = await tx.interviewQuestion.count({
      where: { attemptId: attempt.id, score: { not: null } },
    });
    if (scoredCount === 8) {
      await tx.interviewAttempt.update({
        where: { id: attempt.id },
        data: { status: "completed" },
      });
    }
    return tx.interviewAttempt.findFirstOrThrow({
      where: { id: attempt.id },
      include: {
        questions: { orderBy: { position: "asc" } },
      },
    });
  });
  return toAttempt(updated);
}
