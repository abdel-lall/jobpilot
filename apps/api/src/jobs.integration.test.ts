import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

delete process.env.GEMINI_API_KEY;

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

if (jwtSecret === undefined || jwtSecret.length === 0) {
  throw new Error("JWT_SECRET is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const app = createApp();
const createdEmails: string[] = [];
const password = "password1";

const sampleJob = {
  companyName: "Example Co",
  jobTitle: "Engineer",
  jobDescription: "Build APIs.",
  jobLocation: "Remote",
  jobUrl: "https://example.com/jobs/engineer",
};

const emptyStatus = {
  analysisCurrent: false,
  tailoredResumePresent: false,
  interviewPlanPresent: false,
  latestOverallScore: null,
  readinessBadge: null,
};

type JsonObject = Record<string, unknown>;

type JobRecord = JsonObject & {
  id: string;
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  jobLocation: string;
  jobUrl: string | null;
  status: JsonObject;
  createdAt: string;
  updatedAt: string;
};

function uniqueEmail(): string {
  const email = `phase8-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

async function registerAndLogin(): Promise<{ token: string; userId: string }> {
  const email = uniqueEmail();
  const registered = await request(app).post("/auth/register").send({ email, password });
  expect(registered.status).toBe(201);
  const loggedIn = await request(app).post("/auth/login").send({ email, password });
  expect(loggedIn.status).toBe(200);
  return {
    token: loggedIn.body.accessToken as string,
    userId: loggedIn.body.user.id as string,
  };
}

function jobRecord(body: JsonObject): JobRecord {
  const value = body.job;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected job object");
  }
  return value as JobRecord;
}

function jobRecords(body: JsonObject): JobRecord[] {
  const value = body.jobs;
  if (!Array.isArray(value)) {
    throw new Error("expected jobs array");
  }
  return value as JobRecord[];
}

describe("jobs API", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it("returns an empty list and rejects a missing access token", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const owner = await registerAndLogin();
    const listed = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ jobs: [] });

    const missing = await request(app).get("/jobs");
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "Unauthorized" });
  });

  it("creates, lists, gets, partially updates, and deletes a job", async () => {
    const owner = await registerAndLogin();
    const created = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(sampleJob);

    expect(created.status).toBe(201);
    const createdJob = jobRecord(created.body as JsonObject);
    expect(createdJob).toMatchObject({
      ...sampleJob,
      userId: owner.userId,
      status: emptyStatus,
    });
    expect(createdJob.id).toEqual(expect.any(String));
    expect(createdJob.createdAt).toEqual(expect.any(String));
    expect(createdJob.updatedAt).toEqual(expect.any(String));

    const listed = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(jobRecords(listed.body as JsonObject)).toEqual([createdJob]);
    expect(jobRecords(listed.body as JsonObject)[0]?.status).toEqual(emptyStatus);

    const fetched = await request(app)
      .get(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(fetched.status).toBe(200);
    expect(jobRecord(fetched.body as JsonObject)).toEqual(createdJob);

    const updated = await request(app)
      .patch(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobTitle: "Senior Engineer" });
    expect(updated.status).toBe(200);
    const updatedJob = jobRecord(updated.body as JsonObject);
    expect(updatedJob).toMatchObject({
      ...sampleJob,
      jobTitle: "Senior Engineer",
      userId: owner.userId,
      id: createdJob.id,
      status: emptyStatus,
    });
    expect(updatedJob.companyName).toBe(createdJob.companyName);
    expect(updatedJob.jobDescription).toBe(createdJob.jobDescription);
    expect(updatedJob.jobLocation).toBe(createdJob.jobLocation);
    expect(updatedJob.jobUrl).toBe(createdJob.jobUrl);

    const described = await request(app)
      .patch(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobDescription: "Build APIs and keep status empty." });
    expect(described.status).toBe(200);
    const describedJob = jobRecord(described.body as JsonObject);
    expect(describedJob.jobDescription).toBe("Build APIs and keep status empty.");
    expect(describedJob.status).toEqual(emptyStatus);
    expect(describedJob.jobTitle).toBe("Senior Engineer");

    const deleted = await request(app)
      .delete(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const afterDelete = await request(app)
      .get(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(afterDelete.status).toBe(404);
    expect(afterDelete.body).toEqual({ error: "Not found" });
  });

  it("rejects invalid input, including userId, status, a bad jobUrl, a blank description, and an empty patch", async () => {
    const owner = await registerAndLogin();
    const created = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(sampleJob);
    const createdJob = jobRecord(created.body as JsonObject);

    const withUserId = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, userId: owner.userId });
    expect(withUserId.status).toBe(400);
    expect(withUserId.body).toEqual({ error: "Invalid input" });

    const withStatus = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, status: emptyStatus });
    expect(withStatus.status).toBe(400);
    expect(withStatus.body).toEqual({ error: "Invalid input" });

    const badUrl = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, jobUrl: "ftp://example.com/jobs/engineer" });
    expect(badUrl.status).toBe(400);
    expect(badUrl.body).toEqual({ error: "Invalid input" });

    const blankDescription = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, jobDescription: "   " });
    expect(blankDescription.status).toBe(400);
    expect(blankDescription.body).toEqual({ error: "Invalid input" });

    const emptyPatch = await request(app)
      .patch(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(emptyPatch.status).toBe(400);
    expect(emptyPatch.body).toEqual({ error: "Invalid input" });

    const listed = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
    expect(jobRecords(listed.body as JsonObject)).toEqual([createdJob]);
  });

  it("hides another user's job and returns 404 for their get, update, and delete", async () => {
    const owner = await registerAndLogin();
    const other = await registerAndLogin();
    const created = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(sampleJob);
    const createdJob = jobRecord(created.body as JsonObject);

    const otherList = await request(app).get("/jobs").set("Authorization", `Bearer ${other.token}`);
    expect(otherList.status).toBe(200);
    expect(otherList.body).toEqual({ jobs: [] });

    const ownerList = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
    expect(jobRecords(ownerList.body as JsonObject).map((job) => job.id)).toEqual([createdJob.id]);

    const foreignGet = await request(app)
      .get(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(foreignGet.status).toBe(404);
    expect(foreignGet.body).toEqual({ error: "Not found" });

    const foreignPatch = await request(app)
      .patch(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ jobTitle: "Taken" });
    expect(foreignPatch.status).toBe(404);
    expect(foreignPatch.body).toEqual({ error: "Not found" });

    const foreignDelete = await request(app)
      .delete(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(foreignDelete.status).toBe(404);
    expect(foreignDelete.body).toEqual({ error: "Not found" });

    const stillThere = await request(app)
      .get(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(stillThere.status).toBe(200);
    expect(jobRecord(stillThere.body as JsonObject)).toEqual(createdJob);
  });

  it("returns 404 for a malformed path id", async () => {
    const owner = await registerAndLogin();
    const fetched = await request(app)
      .get("/jobs/not-a-uuid")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(fetched.status).toBe(404);
    expect(fetched.body).toEqual({ error: "Not found" });

    const patched = await request(app)
      .patch("/jobs/not-a-uuid")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobTitle: "Engineer" });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "Not found" });

    const deleted = await request(app)
      .delete("/jobs/not-a-uuid")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: "Not found" });
  });

  it("stores an omitted or null jobUrl as null, clears it with null, and leaves omitted patch fields unchanged", async () => {
    const owner = await registerAndLogin();
    const omitted = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        companyName: "Example Co",
        jobTitle: "Engineer",
        jobDescription: "Build APIs.",
        jobLocation: "Remote",
      });
    expect(omitted.status).toBe(201);
    expect(jobRecord(omitted.body as JsonObject).jobUrl).toBeNull();

    const explicitNull = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, jobUrl: null });
    expect(explicitNull.status).toBe(201);
    const stored = jobRecord(explicitNull.body as JsonObject);
    expect(stored.jobUrl).toBeNull();

    const withUrl = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(sampleJob);
    const createdJob = jobRecord(withUrl.body as JsonObject);

    const cleared = await request(app)
      .patch(`/jobs/${createdJob.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobUrl: null });
    expect(cleared.status).toBe(200);
    const clearedJob = jobRecord(cleared.body as JsonObject);
    expect(clearedJob.jobUrl).toBeNull();
    expect(clearedJob.companyName).toBe(createdJob.companyName);
    expect(clearedJob.jobTitle).toBe(createdJob.jobTitle);
    expect(clearedJob.jobDescription).toBe(createdJob.jobDescription);
    expect(clearedJob.jobLocation).toBe(createdJob.jobLocation);
    expect(clearedJob.status).toEqual(emptyStatus);
  });

  it("orders jobs by createdAt ascending and then id ascending", async () => {
    const owner = await registerAndLogin();
    const first = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, jobTitle: "Later" });
    const second = await request(app)
      .post("/jobs")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ ...sampleJob, jobTitle: "Earlier" });
    const firstJob = jobRecord(first.body as JsonObject);
    const secondJob = jobRecord(second.body as JsonObject);
    const stamp = new Date("2020-01-01T00:00:00.000Z");
    await prisma.job.update({ where: { id: firstJob.id }, data: { createdAt: stamp } });
    await prisma.job.update({ where: { id: secondJob.id }, data: { createdAt: stamp } });

    const listed = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
    const rows = jobRecords(listed.body as JsonObject);
    expect(rows.map((row) => row.id)).toEqual([firstJob.id, secondJob.id].sort());
    expect(rows.every((row) => JSON.stringify(row.status) === JSON.stringify(emptyStatus))).toBe(
      true,
    );
  });

  it("deletes the job without removing profile rows or resume files", async () => {
    const storageDir = await mkdtemp(path.join(tmpdir(), "phase8-jobs-"));
    const previous = process.env.RESUME_STORAGE_DIR;
    process.env.RESUME_STORAGE_DIR = storageDir;
    try {
      const owner = await registerAndLogin();
      const skill = await request(app)
        .post("/profile/skills")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ name: "TypeScript" });
      expect(skill.status).toBe(201);

      const resume = await request(app)
        .post("/profile/resumes")
        .set("Authorization", `Bearer ${owner.token}`)
        .attach("file", Buffer.from("phase8-resume"), {
          filename: "phase8-resume.pdf",
          contentType: "application/pdf",
        });
      expect(resume.status).toBe(201);
      const resumeId = (resume.body.resumeFile as { id: string }).id;

      const created = await request(app)
        .post("/jobs")
        .set("Authorization", `Bearer ${owner.token}`)
        .send(sampleJob);
      const createdJob = jobRecord(created.body as JsonObject);

      const deleted = await request(app)
        .delete(`/jobs/${createdJob.id}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(deleted.status).toBe(204);

      const skills = await request(app)
        .get("/profile/skills")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(skills.status).toBe(200);
      expect(skills.body.skills).toEqual([skill.body.skill]);

      const resumes = await request(app)
        .get("/profile/resumes")
        .set("Authorization", `Bearer ${owner.token}`);
      expect(resumes.status).toBe(200);
      expect(resumes.body.resumeFiles).toEqual([
        expect.objectContaining({ id: resumeId, fileName: "phase8-resume.pdf" }),
      ]);

      const jobs = await request(app).get("/jobs").set("Authorization", `Bearer ${owner.token}`);
      expect(jobs.body).toEqual({ jobs: [] });
    } finally {
      if (previous === undefined) {
        delete process.env.RESUME_STORAGE_DIR;
      } else {
        process.env.RESUME_STORAGE_DIR = previous;
      }
      await rm(storageDir, { recursive: true, force: true });
    }
  });
});
