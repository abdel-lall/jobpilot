import { tailoredResumeSchema, type TailoredResume } from "@jobpilot/shared";
import { z } from "zod";
import { authFetch, readErrorMessage } from "@/lib/api";

const tailoredResumeResponseSchema = z
  .object({
    resume: tailoredResumeSchema,
  })
  .strict();

export function tailoredResumeQueryKey(userId: string, jobId: string) {
  return ["tailored-resume", userId, jobId] as const;
}

export function isTailoredResumeQuery(query: { queryKey: readonly unknown[] }): boolean {
  return query.queryKey[0] === "tailored-resume";
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("Request failed");
  }
}

function parseResume(body: unknown): TailoredResume {
  const parsed = tailoredResumeResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.resume;
}

export async function readTailoredResume(
  accessToken: string,
  jobId: string,
): Promise<TailoredResume | null> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/tailored-resume`, {
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
  return parseResume(await readJsonBody(response));
}

export async function generateTailoredResume(
  accessToken: string,
  jobId: string,
): Promise<TailoredResume> {
  const response = await authFetch(`/jobs/${encodeURIComponent(jobId)}/tailored-resume`, {
    method: "POST",
    accessToken,
    body: {},
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return parseResume(await readJsonBody(response));
}
