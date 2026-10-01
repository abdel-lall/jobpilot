import { jobSchema, type CreateJobBody, type Job, type UpdateJobBody } from "@jobpilot/shared";
import { z } from "zod";
import { authFetch, readErrorMessage } from "@/lib/api";

const jobListSchema = z.object({ jobs: z.array(jobSchema) }).strict();
const jobRecordSchema = z.object({ job: jobSchema }).strict();

export function jobsQueryKey(userId: string) {
  return ["jobs", userId] as const;
}

export function isJobsQuery(query: { queryKey: readonly unknown[] }): boolean {
  return query.queryKey[0] === "jobs";
}

export function requestErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0 && error.message !== "Failed to fetch") {
    return error.message;
  }
  return "Request failed";
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("Request failed");
  }
}

export async function listJobs(accessToken: string): Promise<Job[]> {
  const response = await authFetch("/jobs", { method: "GET", accessToken });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const parsed = jobListSchema.safeParse(await readJsonBody(response));
  if (!parsed.success) {
    throw new Error("Request failed");
  }
  return parsed.data.jobs;
}

export async function createJob(accessToken: string, body: CreateJobBody): Promise<void> {
  const response = await authFetch("/jobs", { method: "POST", accessToken, body });
  if (response.status !== 201) {
    throw new Error(await readErrorMessage(response));
  }
  if (!jobRecordSchema.safeParse(await readJsonBody(response)).success) {
    throw new Error("Request failed");
  }
}

export async function updateJob(accessToken: string, id: string, body: UpdateJobBody): Promise<void> {
  const response = await authFetch(`/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    accessToken,
    body,
  });
  if (response.status !== 200) {
    throw new Error(await readErrorMessage(response));
  }
  if (!jobRecordSchema.safeParse(await readJsonBody(response)).success) {
    throw new Error("Request failed");
  }
}

export async function deleteJob(accessToken: string, id: string): Promise<void> {
  const response = await authFetch(`/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    accessToken,
  });
  if (response.status !== 204) {
    throw new Error(await readErrorMessage(response));
  }
}
