import { randomUUID } from "node:crypto";
import {
  createStubJobAnalysisModel,
  type InterviewPlanModel,
  type InterviewQuestionModel,
  type InterviewQuestionModelInput,
} from "@jobpilot/ai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { interviewAttemptSchema } from "@jobpilot/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

delete process.env.GEMINI_API_KEY;
delete process.env.INTERVIEW_QUESTION_MODEL;

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

const threeCategoryPlan = {
  categories: ["Backend", "Frontend", "Behavioral questions"],
  interviewTopics: ["apis"],
};

type App = ReturnType<typeof createApp>;

type Harness = {
  app: App;
  rejectingApp: App;
  calls: InterviewQuestionModelInput[];
};

function questionModel(calls: InterviewQuestionModelInput[]): InterviewQuestionModel {
  return {
    async generate(input) {
      calls.push(input);
      return {
        questions: Array.from({ length: input.count }, (_, index) => ({
          text: `${input.category} question ${index + 1}`,
          category: "Frontend",
          expectedConcepts: ["concept"],
          rubric: "rubric",
        })),
      };
    },
  };
}

function createHarness(): Harness {
  const calls: InterviewQuestionModelInput[] = [];
  const planModel: InterviewPlanModel = {
    async plan() {
      return { categories: ["System design"] };
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
      interviewPlanModel: planModel,
      interviewQuestionModel: questionModel(calls),
    }),
    rejectingApp: createApp({
      jobAnalysisModel: rejectingAnalysis,
      interviewPlanModel: planModel,
      interviewQuestionModel: questionModel(calls),
    }),
    calls,
  };
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function registerAndLogin(app: App): Promise<{ token: string; userId: string }> {
  const email = `phase16-${randomUUID()}@example.com`;
  createdEmails.push(email);
  const registered = await request(app).post("/auth/register").send({ email, password });
  expect(registered.status).toBe(201);
  const loggedIn = await request(app).post("/auth/login").send({ email, password });
  expect(loggedIn.status).toBe(200);
  return {
    token: loggedIn.body.accessToken as string,
    userId: loggedIn.body.user.id as string,
  };
}

async function createCurrentJob(app: App, token: string): Promise<string> {
  const created = await request(app).post("/jobs").set(auth(token)).send(sampleJob);
  expect(created.status).toBe(201);
  return created.body.job.id as string;
}

async function seedPlan(jobId: string, document: unknown = threeCategoryPlan): Promise<void> {
  await prisma.interviewPlan.create({
    data: { jobId, document: document as object },
  });
}

describe("interview attempt", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it("stores 8 questions with counts 3, 3, and 2, then rejects a second start", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await seedPlan(jobId);

    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const attempt = interviewAttemptSchema.parse(created.body.attempt);
    expect(created.body).toEqual({ attempt });
    expect(harness.calls.map((call) => [call.category, call.count])).toEqual([
      ["Backend", 3],
      ["Frontend", 3],
      ["Behavioral questions", 2],
    ]);
    expect(attempt.questions.map((question) => question.category)).toEqual([
      "Backend",
      "Backend",
      "Backend",
      "Frontend",
      "Frontend",
      "Frontend",
      "Behavioral questions",
      "Behavioral questions",
    ]);
    expect(attempt.questions.every((question) => question.answer === null)).toBe(true);
    expect(attempt.questions.every((question) => question.feedback === null)).toBe(true);
    expect(attempt.questions.every((question) => question.score === null)).toBe(true);
    expect(attempt.status).toBe("in_progress");

    const storedQuestions = await prisma.interviewQuestion.findMany({
      where: { jobId },
      orderBy: { position: "asc" },
    });
    expect(storedQuestions).toHaveLength(8);
    expect(storedQuestions.map((question) => question.category)).toEqual(
      attempt.questions.map((question) => question.category),
    );
    expect(storedQuestions.every((question) => question.answer === null)).toBe(true);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(1);

    const listed = await request(harness.app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(listed.status).toBe(200);
    expect(listed.body.job.status.latestOverallScore).toBeNull();
    expect(listed.body.job.status.readinessBadge).toBeNull();
    expect(listed.body.job.attempt).toBeUndefined();

    const read = await request(harness.app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ attempt });
    expect(harness.calls).toHaveLength(3);

    const again = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: "Interview attempt already in progress" });
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(1);
    expect(await prisma.interviewQuestion.count({ where: { jobId } })).toBe(8);
    expect(harness.calls).toHaveLength(3);
  });

  it("uses 3 rounds, returns 502, and writes nothing when every text is a duplicate", async () => {
    const calls: InterviewQuestionModelInput[] = [];
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: {
        async generate(input) {
          calls.push(input);
          return {
            questions: Array.from({ length: 8 }, () => ({
              text: "Hello World",
              category: "Frontend",
              expectedConcepts: ["concept"],
              rubric: "rubric",
            })),
          };
        },
      },
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId, {
      categories: ["Backend"],
      interviewTopics: ["apis"],
    });
    const attemptsBefore = await prisma.interviewAttempt.count({ where: { jobId } });
    const questionsBefore = await prisma.interviewQuestion.count({ where: { jobId } });

    const failed = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Interview question generation failed" });
    expect(calls).toHaveLength(3);
    expect(calls[0]?.count).toBe(8);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(attemptsBefore);
    expect(await prisma.interviewQuestion.count({ where: { jobId } })).toBe(questionsBefore);
  });

  it("returns 404 for another user on start and read", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const other = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await seedPlan(jobId);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const callsBefore = harness.calls.length;

    const started = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(other.token))
      .send({});
    expect(started.status).toBe(404);
    expect(started.body).toEqual({ error: "Not found" });
    const read = await request(harness.app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(other.token));
    expect(read.status).toBe(404);
    expect(read.body).toEqual({ error: "Not found" });
    const missing = await request(harness.app)
      .post(`/jobs/${randomUUID()}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Not found" });
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
    const missingAnalysis = await request(harness.app)
      .post(`/jobs/${missing.id}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(missingAnalysis.status).toBe(409);
    expect(missingAnalysis.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.calls).toHaveLength(0);
    expect(await prisma.interviewAttempt.count({ where: { jobId: missing.id } })).toBe(0);

    const jobId = await createCurrentJob(harness.app, owner.token);
    await prisma.jobAnalysis.update({
      where: { jobId },
      data: { analyzedDescription: "A different description." },
    });
    const stale = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.calls).toHaveLength(0);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(0);
  });

  it("returns 409 without calling the model when the plan is missing", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const failed = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(409);
    expect(failed.body).toEqual({ error: "Interview plan is not current" });
    expect(harness.calls).toHaveLength(0);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(0);
  });

  it("keeps the attempt across a failed analysis, a title change, a plan replace, and a description change, then deletes it with the job", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await seedPlan(jobId);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const attemptId = interviewAttemptSchema.parse(created.body.attempt).id;
    const callsBefore = harness.calls.length;

    const rejected = await request(harness.rejectingApp)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(rejected.status).toBe(502);
    expect(rejected.body).toEqual({ error: "Job analysis failed" });
    expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.id).toBe(attemptId);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(1);
    expect(harness.calls.length).toBe(callsBefore);

    const titled = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobTitle: "Staff Engineer" });
    expect(titled.status).toBe(200);
    expect(titled.body.job.status.latestOverallScore).toBeNull();
    expect(titled.body.job.status.readinessBadge).toBeNull();
    expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.id).toBe(attemptId);

    const replaced = await request(harness.app)
      .post(`/jobs/${jobId}/interview-plan`)
      .set(auth(owner.token))
      .send({});
    expect(replaced.status).toBe(200);
    expect(replaced.body.plan.categories).toEqual(["System design"]);
    expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.id).toBe(attemptId);
    expect(await prisma.interviewQuestion.count({ where: { jobId } })).toBe(8);

    const described = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(described.status).toBe(200);
    expect(described.body.job.status.analysisCurrent).toBe(true);
    expect(described.body.job.status.interviewPlanPresent).toBe(false);
    expect(described.body.job.status.latestOverallScore).toBeNull();
    expect(described.body.job.status.readinessBadge).toBeNull();
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
    expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.id).toBe(attemptId);
    const read = await request(harness.app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    expect(interviewAttemptSchema.parse(read.body.attempt).questions).toHaveLength(8);
    expect(harness.calls.length).toBe(callsBefore);

    const deleted = await request(harness.app).delete(`/jobs/${jobId}`).set(auth(owner.token));
    expect(deleted.status).toBe(204);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(0);
    expect(await prisma.interviewQuestion.count({ where: { jobId } })).toBe(0);
  });

  it("returns 400 for a keyed body and 401 for a missing or invalid token", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await seedPlan(jobId);
    const keyed = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({ attempt: true });
    expect(keyed.status).toBe(400);
    expect(keyed.body).toEqual({ error: "Invalid input" });
    const missingPost = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .send({});
    expect(missingPost.status).toBe(401);
    expect(missingPost.body).toEqual({ error: "Unauthorized" });
    const invalidPost = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set("Authorization", "Bearer not-a-token")
      .send({});
    expect(invalidPost.status).toBe(401);
    expect(invalidPost.body).toEqual({ error: "Unauthorized" });
    const missingGet = await request(harness.app).get(`/jobs/${jobId}/interview-attempts/current`);
    expect(missingGet.status).toBe(401);
    expect(missingGet.body).toEqual({ error: "Unauthorized" });
    const invalidGet = await request(harness.app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set("Authorization", "Bearer not-a-token");
    expect(invalidGet.status).toBe(401);
    expect(invalidGet.body).toEqual({ error: "Unauthorized" });
    expect(harness.calls).toHaveLength(0);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(0);
  });

  it("returns 502 and writes nothing when createApp has no model and both env vars are unset", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.INTERVIEW_QUESTION_MODEL).toBeUndefined();
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
        interviewPlan: {
          create: {
            document: {
              categories: ["Backend"],
              interviewTopics: ["stub-topic-1", "stub-topic-2"],
            },
          },
        },
      },
    });
    const failed = await request(bare)
      .post(`/jobs/${inserted.id}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Interview question generation failed" });
    expect(await prisma.interviewAttempt.count({ where: { jobId: inserted.id } })).toBe(0);
    expect(await prisma.interviewQuestion.count({ where: { jobId: inserted.id } })).toBe(0);
  });
});
