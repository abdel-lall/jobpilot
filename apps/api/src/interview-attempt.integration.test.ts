import { randomUUID } from "node:crypto";
import {
  createStubAnswerEvaluationModel,
  createStubJobAnalysisModel,
  type AnswerEvaluationModel,
  type AnswerEvaluationModelInput,
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
delete process.env.ANSWER_EVALUATION_MODEL;

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

function evaluationModel(calls: AnswerEvaluationModelInput[]): AnswerEvaluationModel {
  const stub = createStubAnswerEvaluationModel();
  return {
    async evaluate(input) {
      calls.push(input);
      return stub.evaluate(input);
    },
  };
}

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

async function answerAll(
  app: App,
  token: string,
  jobId: string,
  questions: { id: string }[],
  answer: string,
): Promise<void> {
  for (const question of questions) {
    const scored = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
      .set(auth(token))
      .send({ answer });
    expect(scored.status).toBe(200);
  }
}

function uniqueQuestionModel(): InterviewQuestionModel {
  return {
    async generate(input) {
      return {
        questions: Array.from({ length: input.count }, (_, index) => {
          const base = `${input.category} question ${index + 1}`;
          return {
            text: input.avoidedQuestionTexts.includes(base) ? `${base} retake` : base,
            category: "Frontend",
            expectedConcepts: ["concept"],
            rubric: "rubric",
          };
        }),
      };
    },
  };
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

  it("stores one trimmed answer, rejects a repeat, and leaves the other questions unanswered", async () => {
    const evaluationCalls: AnswerEvaluationModelInput[] = [];
    const harness = createHarness();
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel(harness.calls),
      answerEvaluationModel: evaluationModel(evaluationCalls),
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const started = interviewAttemptSchema.parse(created.body.attempt);
    const question = started.questions[0];
    if (question === undefined) {
      throw new Error("missing question");
    }

    const scored = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
      .set(auth(owner.token))
      .send({ answer: "  I would add an index.  " });
    expect(scored.status).toBe(200);
    const attempt = interviewAttemptSchema.parse(scored.body.attempt);
    expect(scored.body).toEqual({ attempt });
    expect(attempt.status).toBe("in_progress");
    expect(attempt.questions[0]).toMatchObject({
      id: question.id,
      answer: "I would add an index.",
      feedback: "stub-feedback",
      score: 80,
    });
    expect(attempt.questions.slice(1).every((item) => item.answer === null)).toBe(true);
    expect(attempt.questions.slice(1).every((item) => item.feedback === null)).toBe(true);
    expect(attempt.questions.slice(1).every((item) => item.score === null)).toBe(true);
    expect(evaluationCalls).toHaveLength(1);
    expect(Object.keys(evaluationCalls[0] ?? {})).toEqual([
      "questionText",
      "rubric",
      "answer",
      "prompt",
    ]);
    expect(evaluationCalls[0]?.answer).toBe("I would add an index.");
    expect(evaluationCalls[0]?.questionText).toBe(question.text);
    expect(evaluationCalls[0]?.rubric).toBe(question.rubric);

    const listed = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(listed.status).toBe(200);
    expect(listed.body.job.status.latestOverallScore).toBeNull();
    expect(listed.body.job.status.readinessBadge).toBeNull();

    const read = await request(app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ attempt });

    const stored = await prisma.interviewQuestion.findMany({
      where: { attemptId: attempt.id },
      orderBy: { position: "asc" },
    });
    expect(stored[0]?.answer).toBe("I would add an index.");
    expect(stored[0]?.feedback).toBe("stub-feedback");
    expect(stored[0]?.score).toBe(80);
    expect(
      stored
        .slice(1)
        .every((item) => item.answer === null && item.feedback === null && item.score === null),
    ).toBe(true);

    const again = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
      .set(auth(owner.token))
      .send({ answer: "A different answer." });
    expect(again.status).toBe(409);
    expect(again.body).toEqual({ error: "Question already answered" });
    expect(evaluationCalls).toHaveLength(1);
    const unchanged = await prisma.interviewQuestion.findUnique({ where: { id: question.id } });
    expect(unchanged?.answer).toBe("I would add an index.");
    expect(unchanged?.feedback).toBe("stub-feedback");
    expect(unchanged?.score).toBe(80);
    expect((await prisma.interviewAttempt.findUnique({ where: { id: attempt.id } }))?.status).toBe(
      "in_progress",
    );
  });

  it("returns 502 and writes nothing when the model score is 101", async () => {
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: {
        async evaluate() {
          return { feedback: "too high", score: 101 };
        },
      },
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const questionId = interviewAttemptSchema.parse(created.body.attempt).questions[0]?.id;
    if (questionId === undefined) {
      throw new Error("missing question");
    }
    const failed = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${questionId}/answer`)
      .set(auth(owner.token))
      .send({ answer: "I would add an index." });
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Answer evaluation failed" });
    const stored = await prisma.interviewQuestion.findUnique({ where: { id: questionId } });
    expect(stored?.answer).toBeNull();
    expect(stored?.feedback).toBeNull();
    expect(stored?.score).toBeNull();
    expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.status).toBe(
      "in_progress",
    );
  });

  it("marks the attempt completed only on the eighth score and rejects a repeated-text retake", async () => {
    const evaluationCalls: AnswerEvaluationModelInput[] = [];
    const questionCalls: InterviewQuestionModelInput[] = [];
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel(questionCalls),
      answerEvaluationModel: evaluationModel(evaluationCalls),
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const started = interviewAttemptSchema.parse(created.body.attempt);

    for (let index = 0; index < started.questions.length; index += 1) {
      const question = started.questions[index];
      if (question === undefined) {
        throw new Error("missing question");
      }
      const scored = await request(app)
        .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
        .set(auth(owner.token))
        .send({ answer: `Answer ${index + 1}` });
      expect(scored.status).toBe(200);
      const attempt = interviewAttemptSchema.parse(scored.body.attempt);
      if (index < 7) {
        expect(attempt.status).toBe("in_progress");
      } else {
        expect(attempt.status).toBe("completed");
        expect(attempt.questions.every((item) => item.score === 80)).toBe(true);
      }
    }

    const read = await request(app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    const completed = interviewAttemptSchema.parse(read.body.attempt);
    expect(completed.status).toBe("completed");
    expect(completed.questions).toHaveLength(8);
    expect(completed.questions.every((item) => typeof item.score === "number")).toBe(true);

    const listed = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(listed.body.job.status.latestOverallScore).toBe(80);
    expect(listed.body.job.status.readinessBadge).toBe("Interview Ready");

    const again = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(again.status).toBe(502);
    expect(again.body).toEqual({ error: "Interview question generation failed" });
    expect(evaluationCalls).toHaveLength(8);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(1);
  });

  it("rejects another user, an unknown question, an invalid body, and a missing token without calling the model", async () => {
    const evaluationCalls: AnswerEvaluationModelInput[] = [];
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: evaluationModel(evaluationCalls),
    });
    const owner = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const questionId = interviewAttemptSchema.parse(created.body.attempt).questions[0]?.id;
    if (questionId === undefined) {
      throw new Error("missing question");
    }
    const answerPath = `/jobs/${jobId}/interview-attempts/current/questions/${questionId}/answer`;

    const crossUser = await request(app)
      .post(answerPath)
      .set(auth(other.token))
      .send({ answer: "I would add an index." });
    expect(crossUser.status).toBe(404);
    expect(crossUser.body).toEqual({ error: "Not found" });

    const missingQuestion = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${randomUUID()}/answer`)
      .set(auth(owner.token))
      .send({ answer: "I would add an index." });
    expect(missingQuestion.status).toBe(404);
    expect(missingQuestion.body).toEqual({ error: "Not found" });

    const blank = await request(app).post(answerPath).set(auth(owner.token)).send({ answer: "   " });
    expect(blank.status).toBe(400);
    expect(blank.body).toEqual({ error: "Invalid input" });

    const missingAnswer = await request(app).post(answerPath).set(auth(owner.token)).send({});
    expect(missingAnswer.status).toBe(400);
    expect(missingAnswer.body).toEqual({ error: "Invalid input" });

    const unknownKey = await request(app)
      .post(answerPath)
      .set(auth(owner.token))
      .send({ answer: "I would add an index.", extra: true });
    expect(unknownKey.status).toBe(400);
    expect(unknownKey.body).toEqual({ error: "Invalid input" });

    const missingToken = await request(app)
      .post(answerPath)
      .send({ answer: "I would add an index." });
    expect(missingToken.status).toBe(401);
    expect(missingToken.body).toEqual({ error: "Unauthorized" });

    const invalidToken = await request(app)
      .post(answerPath)
      .set("Authorization", "Bearer not-a-token")
      .send({ answer: "I would add an index." });
    expect(invalidToken.status).toBe(401);
    expect(invalidToken.body).toEqual({ error: "Unauthorized" });

    expect(evaluationCalls).toHaveLength(0);
    const stored = await prisma.interviewQuestion.findUnique({ where: { id: questionId } });
    expect(stored?.answer).toBeNull();
    expect(stored?.feedback).toBeNull();
    expect(stored?.score).toBeNull();
  });

  it("returns 502 and writes nothing when createApp has no evaluation model and both env vars are unset", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.ANSWER_EVALUATION_MODEL).toBeUndefined();
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    await seedPlan(jobId);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const questionId = interviewAttemptSchema.parse(created.body.attempt).questions[0]?.id;
    if (questionId === undefined) {
      throw new Error("missing question");
    }
    const bare = createApp();
    const failed = await request(bare)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${questionId}/answer`)
      .set(auth(owner.token))
      .send({ answer: "I would add an index." });
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Answer evaluation failed" });
    const stored = await prisma.interviewQuestion.findUnique({ where: { id: questionId } });
    expect(stored?.answer).toBeNull();
    expect(stored?.feedback).toBeNull();
    expect(stored?.score).toBeNull();
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(1);
  });

  it("completes the attempt when overlapping answers score the last two questions", async () => {
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: evaluationModel([]),
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const started = interviewAttemptSchema.parse(created.body.attempt);
    const attemptId = started.id;
    const trailing = started.questions.slice(6);
    const waitingQuestion = trailing[0];
    const heldQuestion = trailing[1];
    if (waitingQuestion === undefined || heldQuestion === undefined) {
      throw new Error("missing question");
    }
    for (const question of started.questions.slice(0, 6)) {
      const scored = await request(app)
        .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
        .set(auth(owner.token))
        .send({ answer: `Answer ${question.position}` });
      expect(scored.status).toBe(200);
      expect(interviewAttemptSchema.parse(scored.body.attempt).status).toBe("in_progress");
    }

    let markLocked: () => void = () => {};
    const locked = new Promise<void>((resolve) => {
      markLocked = resolve;
    });
    let releaseHold: () => void = () => {};
    const holdGate = new Promise<void>((resolve) => {
      releaseHold = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "InterviewAttempt" WHERE "id" = ${attemptId} FOR UPDATE`;
        markLocked();
        await holdGate;
        await tx.interviewQuestion.update({
          where: { id: heldQuestion.id },
          data: { answer: "from-holder", feedback: "holder-feedback", score: 70 },
        });
      },
      { maxWait: 20_000, timeout: 20_000 },
    );

    try {
      await Promise.race([
        locked,
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error("lock was not acquired"));
          }, 5_000);
        }),
      ]);

      let settled = false;
      const pendingScore = request(app)
        .post(
          `/jobs/${jobId}/interview-attempts/current/questions/${waitingQuestion.id}/answer`,
        )
        .set(auth(owner.token))
        .send({ answer: "I would add an index." })
        .then((response) => {
          settled = true;
          return response;
        });

      await new Promise((resolve) => {
        setTimeout(resolve, 1_000);
      });
      expect(settled).toBe(false);
      const duringLock = await prisma.interviewQuestion.findUnique({
        where: { id: waitingQuestion.id },
      });
      expect(duringLock?.answer).toBeNull();
      expect(duringLock?.score).toBeNull();
      expect((await prisma.interviewAttempt.findUnique({ where: { id: attemptId } }))?.status).toBe(
        "in_progress",
      );

      releaseHold();
      const scored = await pendingScore;
      await holder;
      expect(scored.status).toBe(200);
      const attempt = interviewAttemptSchema.parse(scored.body.attempt);
      expect(attempt.status).toBe("completed");
      expect(attempt.questions.every((question) => question.score !== null)).toBe(true);
      expect(attempt.questions.find((question) => question.id === waitingQuestion.id)?.score).toBe(80);
      expect(attempt.questions.find((question) => question.id === heldQuestion.id)).toMatchObject({
        answer: "from-holder",
        feedback: "holder-feedback",
        score: 70,
      });
      expect((await prisma.interviewAttempt.findUnique({ where: { id: attemptId } }))?.status).toBe(
        "completed",
      );
    } finally {
      releaseHold();
    }
  }, 20_000);

  it("returns 409 when the same question is submitted twice at once", async () => {
    const evaluationCalls: AnswerEvaluationModelInput[] = [];
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: evaluationModel(evaluationCalls),
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const question = interviewAttemptSchema.parse(created.body.attempt).questions[0];
    if (question === undefined) {
      throw new Error("missing question");
    }
    const path = `/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`;
    const [first, second] = await Promise.all([
      request(app).post(path).set(auth(owner.token)).send({ answer: "I would add an index." }),
      request(app).post(path).set(auth(owner.token)).send({ answer: "I would add an index." }),
    ]);
    const statuses = [first.status, second.status].sort((left, right) => left - right);
    expect(statuses).toEqual([200, 409]);
    const conflict = first.status === 409 ? first : second;
    const success = first.status === 200 ? first : second;
    expect(conflict.body).toEqual({ error: "Question already answered" });
    const attempt = interviewAttemptSchema.parse(success.body.attempt);
    expect(attempt.status).toBe("in_progress");
    expect(attempt.questions[0]).toMatchObject({
      answer: "I would add an index.",
      feedback: "stub-feedback",
      score: 80,
    });
    expect(attempt.questions.slice(1).every((item) => item.score === null)).toBe(true);
    const stored = await prisma.interviewQuestion.findUnique({ where: { id: question.id } });
    expect(stored?.answer).toBe("I would add an index.");
    expect(stored?.feedback).toBe("stub-feedback");
    expect(stored?.score).toBe(80);
    expect((await prisma.interviewAttempt.findUnique({ where: { id: attempt.id } }))?.status).toBe(
      "in_progress",
    );
    expect(evaluationCalls.length).toBeGreaterThan(0);
  });

  it("does not insert a second attempt when one completes while start is still generating", async () => {
    let markEntered: () => void = () => {};
    const entered = new Promise<void>((resolve) => {
      markEntered = resolve;
    });
    let releaseGeneration: () => void = () => {};
    const generationGate = new Promise<void>((resolve) => {
      releaseGeneration = resolve;
    });
    let blocked = false;
    const blockingQuestions: InterviewQuestionModel = {
      async generate(input) {
        if (!blocked) {
          blocked = true;
          markEntered();
          await generationGate;
        }
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
    const blockingApp = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: blockingQuestions,
    });
    const fastApp = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: evaluationModel([]),
    });
    const owner = await registerAndLogin(blockingApp);
    const jobId = await createCurrentJob(blockingApp, owner.token);
    await seedPlan(jobId);

    let settled = false;
    const pendingStart = request(blockingApp)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({})
      .then((response) => {
        settled = true;
        return response;
      });

    try {
      await Promise.race([
        entered,
        new Promise<never>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error("question generation did not start"));
          }, 5_000);
        }),
      ]);

      const created = await request(fastApp)
        .post(`/jobs/${jobId}/interview-attempts`)
        .set(auth(owner.token))
        .send({});
      expect(created.status).toBe(200);
      const started = interviewAttemptSchema.parse(created.body.attempt);
      for (const question of started.questions) {
        const scored = await request(fastApp)
          .post(`/jobs/${jobId}/interview-attempts/current/questions/${question.id}/answer`)
          .set(auth(owner.token))
          .send({ answer: `Answer ${question.position}` });
        expect(scored.status).toBe(200);
      }
      const read = await request(fastApp)
        .get(`/jobs/${jobId}/interview-attempts/current`)
        .set(auth(owner.token));
      expect(read.status).toBe(200);
      expect(interviewAttemptSchema.parse(read.body.attempt).status).toBe("completed");
      expect(settled).toBe(false);

      releaseGeneration();
      const blockedStart = await pendingStart;
      expect(blockedStart.status).toBe(502);
      expect(blockedStart.body).toEqual({ error: "Interview question generation failed" });
      expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(1);
      expect((await prisma.interviewAttempt.findFirst({ where: { jobId } }))?.id).toBe(started.id);
    } finally {
      releaseGeneration();
    }
  }, 20_000);

  it("stores 79.875 and no badge when one score is 79", async () => {
    let calls = 0;
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: {
        async evaluate() {
          calls += 1;
          return { feedback: "stub-feedback", score: calls === 1 ? 79 : 80 };
        },
      },
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const started = interviewAttemptSchema.parse(created.body.attempt);
    await answerAll(app, owner.token, jobId, started.questions, "I would add an index.");

    const listed = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(listed.status).toBe(200);
    expect(listed.body.job.status.latestOverallScore).toBe(79.875);
    expect(listed.body.job.status.readinessBadge).toBeNull();
  });

  it("keeps history, freezes the dashboard during a retake, and clears the badge when the retake fails", async () => {
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: uniqueQuestionModel(),
      answerEvaluationModel: createStubAnswerEvaluationModel(),
    });
    const owner = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    await seedPlan(jobId);
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const started = interviewAttemptSchema.parse(created.body.attempt);
    await answerAll(app, owner.token, jobId, started.questions, "I would add an index.");

    const completedRead = await request(app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    const completed = interviewAttemptSchema.parse(completedRead.body.attempt);
    expect(completed.id).toBe(started.id);
    expect(completed.status).toBe("completed");

    const passed = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(passed.body.job.status.latestOverallScore).toBe(80);
    expect(passed.body.job.status.readinessBadge).toBe("Interview Ready");

    const retake = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(retake.status).toBe(200);
    const second = interviewAttemptSchema.parse(retake.body.attempt);
    expect(second.status).toBe("in_progress");
    expect(second.id).not.toBe(started.id);
    const firstTexts = new Set(started.questions.map((question) => question.text));
    expect(second.questions.every((question) => !firstTexts.has(question.text))).toBe(true);
    expect(second.questions.every((question) => question.score === null)).toBe(true);

    const during = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(during.body.job.status.latestOverallScore).toBe(80);
    expect(during.body.job.status.readinessBadge).toBe("Interview Ready");
    const current = await request(app)
      .get(`/jobs/${jobId}/interview-attempts/current`)
      .set(auth(owner.token));
    expect(interviewAttemptSchema.parse(current.body.attempt).id).toBe(second.id);

    const oldQuestionId = started.questions[0]?.id;
    if (oldQuestionId === undefined) {
      throw new Error("missing question");
    }
    const stale = await request(app)
      .post(`/jobs/${jobId}/interview-attempts/current/questions/${oldQuestionId}/answer`)
      .set(auth(owner.token))
      .send({ answer: "fail" });
    expect(stale.status).toBe(404);
    expect(stale.body).toEqual({ error: "Not found" });

    await answerAll(app, owner.token, jobId, second.questions, "fail");
    const failed = await request(app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(failed.body.job.status.latestOverallScore).toBe(0);
    expect(failed.body.job.status.readinessBadge).toBeNull();

    const stored = await prisma.interviewAttempt.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
      include: { questions: true },
    });
    expect(stored).toHaveLength(2);
    expect(stored[0]?.questions.every((question) => question.score === 80)).toBe(true);
    expect(stored[1]?.questions.every((question) => question.score === 0)).toBe(true);
    const firstNormalized = new Set(stored[0]?.questions.map((question) => question.normalizedText));
    expect(
      stored[1]?.questions.every((question) => !firstNormalized.has(question.normalizedText)),
    ).toBe(true);
  });

  it("does not award the badge on another job", async () => {
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
      answerEvaluationModel: createStubAnswerEvaluationModel(),
    });
    const owner = await registerAndLogin(app);
    const readyId = await createCurrentJob(app, owner.token);
    const otherId = await createCurrentJob(app, owner.token);
    await seedPlan(readyId);
    const created = await request(app)
      .post(`/jobs/${readyId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    const started = interviewAttemptSchema.parse(created.body.attempt);
    await answerAll(app, owner.token, readyId, started.questions, "I would add an index.");

    const ready = await request(app).get(`/jobs/${readyId}`).set(auth(owner.token));
    expect(ready.body.job.status.latestOverallScore).toBe(80);
    expect(ready.body.job.status.readinessBadge).toBe("Interview Ready");
    const other = await request(app).get(`/jobs/${otherId}`).set(auth(owner.token));
    expect(other.body.job.status.latestOverallScore).toBeNull();
    expect(other.body.job.status.readinessBadge).toBeNull();
  });

  it("removes analysis, tailored resume, plan, attempts, and questions when the job is deleted", async () => {
    const app = createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      interviewQuestionModel: questionModel([]),
    });
    const owner = await registerAndLogin(app);
    const other = await registerAndLogin(app);
    const jobId = await createCurrentJob(app, owner.token);
    const otherJobId = await createCurrentJob(app, other.token);
    await seedPlan(jobId);
    await prisma.tailoredResume.create({
      data: { jobId, document: { marker: "phase18-resume" } },
    });
    const created = await request(app)
      .post(`/jobs/${jobId}/interview-attempts`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);

    const deleted = await request(app).delete(`/jobs/${jobId}`).set(auth(owner.token));
    expect(deleted.status).toBe(204);
    expect(await prisma.job.count({ where: { id: jobId } })).toBe(0);
    expect(await prisma.jobAnalysis.count({ where: { jobId } })).toBe(0);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(0);
    expect(await prisma.interviewPlan.count({ where: { jobId } })).toBe(0);
    expect(await prisma.interviewAttempt.count({ where: { jobId } })).toBe(0);
    expect(await prisma.interviewQuestion.count({ where: { jobId } })).toBe(0);
    const remaining = await request(app).get(`/jobs/${otherJobId}`).set(auth(other.token));
    expect(remaining.status).toBe(200);
    expect(remaining.body.job.id).toBe(otherJobId);
  });
});
