import {
  jobSchema,
  type CreateJobBody,
  type Job,
  type UpdateJobBody,
} from "@jobpilot/shared";
import { getAuthenticatedUser } from "../auth/service.js";
import { getPrisma } from "../db.js";
import { JobError } from "./errors.js";

const listOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];

const emptyStatus = {
  analysisCurrent: false,
  tailoredResumePresent: false,
  interviewPlanPresent: false,
  latestOverallScore: null,
  readinessBadge: null,
} as const;

async function requireUser(authorization: string | undefined) {
  return getAuthenticatedUser(authorization);
}

function toJob(record: {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  jobLocation: string;
  jobUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Job {
  return jobSchema.parse({
    id: record.id,
    userId: record.userId,
    companyName: record.companyName,
    jobTitle: record.jobTitle,
    jobDescription: record.jobDescription,
    jobLocation: record.jobLocation,
    jobUrl: record.jobUrl,
    status: emptyStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export async function createJob(
  authorization: string | undefined,
  input: CreateJobBody,
): Promise<Job> {
  const user = await requireUser(authorization);
  const created = await getPrisma().job.create({
    data: {
      userId: user.id,
      companyName: input.companyName,
      jobTitle: input.jobTitle,
      jobDescription: input.jobDescription,
      jobLocation: input.jobLocation,
      jobUrl: input.jobUrl ?? null,
    },
  });
  return toJob(created);
}

export async function listJobs(
  authorization: string | undefined,
): Promise<{ jobs: Job[] }> {
  const user = await requireUser(authorization);
  const rows = await getPrisma().job.findMany({
    where: { userId: user.id },
    orderBy: listOrder,
  });
  return { jobs: rows.map((row) => toJob(row)) };
}

export async function getJob(authorization: string | undefined, id: string): Promise<Job> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().job.findFirst({ where: { id, userId: user.id } });
  if (existing === null) {
    throw new JobError("not_found");
  }
  return toJob(existing);
}

export async function updateJob(
  authorization: string | undefined,
  id: string,
  patch: UpdateJobBody,
): Promise<Job> {
  const user = await requireUser(authorization);
  const existing = await getPrisma().job.findFirst({ where: { id, userId: user.id } });
  if (existing === null) {
    throw new JobError("not_found");
  }
  const updated = await getPrisma().job.update({
    where: { id: existing.id },
    data: {
      companyName: patch.companyName,
      jobTitle: patch.jobTitle,
      jobDescription: patch.jobDescription,
      jobLocation: patch.jobLocation,
      jobUrl: patch.jobUrl,
    },
  });
  return toJob(updated);
}

export async function deleteJob(authorization: string | undefined, id: string): Promise<void> {
  const user = await requireUser(authorization);
  const result = await getPrisma().job.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    throw new JobError("not_found");
  }
}
