import {
  interviewAttemptSchema,
  submitInterviewAnswerBodySchema,
  type InterviewAttempt,
} from "@jobpilot/shared";
import { z } from "zod";
import { authFetch, readErrorMessage } from "@/lib/api";

const interviewAttemptResponseSchema = z
  .object({
    attempt: interviewAttemptSchema,
  })
  .strict();

export function interviewAttemptQueryKey(userId: string, jobId: string) {
  return ["interview-attempt", userId, jobId] as const;
}

export function isInterviewAttemptQuery(query: { queryKey: readonly unknown[] }): boolean {
  return query.queryKey[0] === "interview-attempt";
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("Request failed");
  }
}

function parseAttempt(body: unknown): InterviewAttempt {
  const parsed = interviewAttemptResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.attempt;
}

export async function readInterviewAttempt(
  accessToken: string,
  jobId: string,
): Promise<InterviewAttempt | null> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/interview-attempts/current`, {
    method: "GET",
    accessToken,
  });
  if (response.status === 404) {
    const message = await readErrorMessage(response);
    if (message === "Not found") {
      return null;
    }
    throw new Error(message);
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parseAttempt(await readJsonBody(response));
}

export async function startInterviewAttempt(
  accessToken: string,
  jobId: string,
): Promise<InterviewAttempt> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/interview-attempts`, {
    method: "POST",
    accessToken,
    body: {},
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parseAttempt(await readJsonBody(response));
}

export async function submitInterviewAnswer(
  accessToken: string,
  jobId: string,
  questionId: string,
  answer: string,
): Promise<InterviewAttempt> {
  const parsed = submitInterviewAnswerBodySchema.safeParse({ answer });
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  const response = await authFetch(
    `/jobs/${encodeURIComponent(jobId)}/interview-attempts/current/questions/${encodeURIComponent(questionId)}/answer`,
    {
      method: "POST",
      accessToken,
      body: parsed.data,
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parseAttempt(await readJsonBody(response));
}
