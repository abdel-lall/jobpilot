import { interviewPlanSchema, type InterviewPlan } from "@jobpilot/shared";
import { z } from "zod";
import { authFetch, readErrorMessage } from "@/lib/api";

const interviewPlanResponseSchema = z
  .object({
    plan: interviewPlanSchema,
  })
  .strict();

export function interviewPlanQueryKey(userId: string, jobId: string) {
  return ["interview-plan", userId, jobId] as const;
}

export function isInterviewPlanQuery(query: { queryKey: readonly unknown[] }): boolean {
  return query.queryKey[0] === "interview-plan";
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("Request failed");
  }
}

function parsePlan(body: unknown): InterviewPlan {
  const parsed = interviewPlanResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.plan;
}

export async function readInterviewPlan(
  accessToken: string,
  jobId: string,
): Promise<InterviewPlan | null> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/interview-plan`, {
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
  return parsePlan(await readJsonBody(response));
}

export async function generateInterviewPlan(
  accessToken: string,
  jobId: string,
): Promise<InterviewPlan> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/interview-plan`, {
    method: "POST",
    accessToken,
    body: {},
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parsePlan(await readJsonBody(response));
}
