import { randomUUID } from "node:crypto";
import {
  createStubJobAnalysisModel,
  type InterviewPlanModel,
  type InterviewPlanModelInput,
} from "@jobpilot/ai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { interviewPlanSchema } from "@jobpilot/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

delete process.env.GEMINI_API_KEY;
delete process.env.INTERVIEW_PLAN_MODEL;

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

const createdEmails: string[] = [];
const password = "password1";

const sampleJob = {
  companyName: "Example Co",
  jobTitle: "Engineer",
  jobDescription: "Build APIs.",
  jobLocation: "Remote",
};

const stubAnalysisColumns = {
  requiredSkills: ["stub-required"],
  preferredSkills: ["stub-preferred"],
  responsibilities: ["stub-responsibility"],
  experienceRequirements: ["stub-experience"],
  technologies: ["stub-technology"],
  interviewTopics: ["stub-topic-1", "stub-topic-2"],
  keywords: ["Build APIs."],
};

type App = ReturnType<typeof createApp>;

type Harness = {
  app: App;
  rejectingApp: App;
  calls: InterviewPlanModelInput[];
  result: { value: unknown };
};

function createHarness(): Harness {
  const calls: InterviewPlanModelInput[] = [];
  const result = { value: { categories: ["Backend", "Behavioral questions"] } as unknown };
  const model: InterviewPlanModel = {
    async plan(input) {
      calls.push(input);
      return result.value;
    },
  };
  const rejectingAnalysis = {
    async analyze() {
      throw new Error("provider unavailable");
    },
  };
  return {
    app: createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewPlanModel: model,
    }),
    rejectingApp: createApp({
      jobAnalysisModel: rejectingAnalysis,
      interviewPlanModel: model,
    }),
    calls,
    result,
  };
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function registerAndLogin(app: App): Promise<{ token: string; userId: string; email: string }> {
  const email = `phase15-${randomUUID()}@example.com`;
  createdEmails.push(email);
  const registered = await request(app).post("/auth/register").send({ email, password });
  expect(registered.status).toBe(201);
  const loggedIn = await request(app).post("/auth/login").send({ email, password });
  expect(loggedIn.status).toBe(200);
  return {
    token: loggedIn.body.accessToken as string,
    userId: loggedIn.body.user.id as string,
    email,
  };
}

async function createCurrentJob(app: App, token: string): Promise<string> {
  const created = await request(app).post("/jobs").set(auth(token)).send(sampleJob);
  expect(created.status).toBe(201);
  expect(created.body.job.status.interviewPlanPresent).toBe(false);
  return created.body.job.id as string;
}

async function storedPlan(jobId: string): Promise<{ id: string; document: unknown } | null> {
  return prisma.interviewPlan.findUnique({
    where: { jobId },
    select: { id: true, document: true },
  });
}

describe("interview plan", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it("stores one plan, replaces that row, and reads the same document", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const missing = await request(harness.app)
      .get(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Not found" });

    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const plan = interviewPlanSchema.parse(created.body.plan);
    expect(created.body).toEqual({ plan });
    expect(plan.categories).toEqual(["Backend", "Behavioral questions"]);
    expect(plan.interviewTopics).toEqual(["stub-topic-1", "stub-topic-2"]);
    expect(harness.calls).toHaveLength(1);
    expect(Object.keys(harness.calls[0] ?? {})).toEqual(["analysis", "prompt"]);
    expect(harness.calls[0]?.analysis.interviewTopics).toEqual(["stub-topic-1", "stub-topic-2"]);
    expect(harness.calls[0]?.prompt.includes(owner.email)).toBe(false);
    expect(harness.calls[0]?.prompt.includes("stub-required")).toBe(true);
    const stored = await storedPlan(jobId);
    expect(stored?.document).toEqual(plan);
    const listed = await request(harness.app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(listed.status).toBe(200);
    expect(listed.body.job.status.interviewPlanPresent).toBe(true);
    const read = await request(harness.app)
      .get(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ plan });

    harness.result.value = { categories: ["Frontend", "System design"] };
    const replaced = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(replaced.status).toBe(200);
    const next = interviewPlanSchema.parse(replaced.body.plan);
    expect(next.categories).toEqual(["Frontend", "System design"]);
    expect(next.interviewTopics).toEqual(["stub-topic-1", "stub-topic-2"]);
    const rows = await prisma.interviewPlan.findMany({ where: { jobId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(stored?.id);
    expect(rows[0]?.document).toEqual(next);
  });

  it("rejects an unknown category without replacing the stored plan", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const original = await storedPlan(jobId);
    harness.result.value = { categories: ["Cooking"] };
    const failed = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Interview plan generation failed" });
    const row = await storedPlan(jobId);
    expect(row?.id).toBe(original?.id);
    expect(row?.document).toEqual(original?.document);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(1);
  });

  it("returns 404 for another user on generate and read", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const other = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await request(harness.app).post(`/jobs/${jobId}/interview-plan`).set(auth(owner.token)).send({});
    const callsBefore = harness.calls.length;
    const generated = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(other.token))
      .send({});
    expect(generated.status).toBe(404);
    expect(generated.body).toEqual({ error: "Not found" });
    const read = await request(harness.app)
      .get(`/jobs/${jobId}/interview-plan`)
      .set(auth(other.token));
    expect(read.status).toBe(404);
    expect(read.body).toEqual({ error: "Not found" });
    expect(harness.calls.length).toBe(callsBefore);
  });

  it("returns 409 without calling the model when analysis is missing or stale", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const missing = await prisma.job.create({
      data: {
        userId: owner.userId,
        companyName: "Example Co",
        jobTitle: "Engineer",
        jobDescription: "Build APIs.",
        jobLocation: "Remote",
      },
    });
    const callsBeforeMissing = harness.calls.length;
    const missingAnalysis = await request(harness.app)
      .post(`/jobs/${missing.id}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(missingAnalysis.status).toBe(409);
    expect(missingAnalysis.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.calls.length).toBe(callsBeforeMissing);
    expect(await prisma.interviewPlan.count({ where: { jobId: missing.id } })).toBe(0);

    const jobId = await createCurrentJob(harness.app, owner.token);
    await prisma.jobAnalysis.update({
      where: { jobId },
      data: { analyzedDescription: "A different description." },
    });
    const callsBeforeStale = harness.calls.length;
    const stale = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.calls.length).toBe(callsBeforeStale);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
  });

  it("clears the plan and tailored resume on description change, and keeps both when analysis fails or the title changes", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    await prisma.tailoredResume.create({
      data: { jobId, document: { marker: "phase15-resume" } },
    });
    const original = await storedPlan(jobId);
    const callsBefore = harness.calls.length;

    const rejected = await request(harness.rejectingApp)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(rejected.status).toBe(502);
    expect(rejected.body).toEqual({ error: "Job analysis failed" });
    expect(harness.calls.length).toBe(callsBefore);
    expect((await storedPlan(jobId))?.id).toBe(original?.id);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(1);

    const titled = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobTitle: "Staff Engineer" });
    expect(titled.status).toBe(200);
    expect(titled.body.job.status.interviewPlanPresent).toBe(true);
    expect(titled.body.job.status.tailoredResumePresent).toBe(true);
    expect((await storedPlan(jobId))?.id).toBe(original?.id);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(1);
    expect(harness.calls.length).toBe(callsBefore);

    const described = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(described.status).toBe(200);
    expect(described.body.job.status.analysisCurrent).toBe(true);
    expect(described.body.job.status.interviewPlanPresent).toBe(false);
    expect(described.body.job.status.tailoredResumePresent).toBe(false);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(0);
    expect(harness.calls.length).toBe(callsBefore);
    const cleared = await request(harness.app)
      .get(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token));
    expect(cleared.status).toBe(404);
    expect(cleared.body).toEqual({ error: "Not found" });
  });

  it("deletes the plan when the job is deleted", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const deleted = await request(harness.app).delete(`/jobs/${jobId}`).set(auth(owner.token));
    expect(deleted.status).toBe(204);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
  });

  it("returns 400 for a keyed body and 401 for a missing or invalid token", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const callsBefore = harness.calls.length;
    const keyed = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({ plan: true });
    expect(keyed.status).toBe(400);
    expect(keyed.body).toEqual({ error: "Invalid input" });
    const missingPost = await request(harness.app).post(`/jobs/${jobId}/interview-plan`).send({});
    expect(missingPost.status).toBe(401);
    expect(missingPost.body).toEqual({ error: "Unauthorized" });
    const invalidPost = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set("Authorization", "Bearer not-a-token")
      .send({});
    expect(invalidPost.status).toBe(401);
    expect(invalidPost.body).toEqual({ error: "Unauthorized" });
    const missingGet = await request(harness.app).get(`/jobs/${jobId}/interview-plan`);
    expect(missingGet.status).toBe(401);
    expect(missingGet.body).toEqual({ error: "Unauthorized" });
    const invalidGet = await request(harness.app)
      .get(`/jobs/${jobId}/interview-plan`)
      .set("Authorization", "Bearer not-a-token");
    expect(invalidGet.status).toBe(401);
    expect(invalidGet.body).toEqual({ error: "Unauthorized" });
    expect(harness.calls.length).toBe(callsBefore);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
  });

  it("returns 502 and writes nothing when createApp has no model and both env vars are unset", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.INTERVIEW_PLAN_MODEL).toBeUndefined();
    const bare = createApp();
    const owner = await registerAndLogin(bare);
    const inserted = await prisma.job.create({
      data: {
        userId: owner.userId,
        companyName: "Example Co",
        jobTitle: "Engineer",
        jobDescription: "Build APIs.",
        jobLocation: "Remote",
        analysis: {
          create: {
            analyzedDescription: "Build APIs.",
            ...stubAnalysisColumns,
          },
        },
      },
    });
    const failed = await request(bare)
      .post(`/jobs/${inserted.id}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Interview plan generation failed" });
    expect(await prisma.interviewPlan.count({ where: { jobId: inserted.id } })).toBe(0);
  });
});
