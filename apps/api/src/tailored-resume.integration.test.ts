import { randomUUID } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import { createStubJobAnalysisModel, createStubResumeModel, type ResumeTailoringModel, type ResumeToolClient } from "@jobpilot/ai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { tailoredResumeSchema, type TailoredResume } from "@jobpilot/shared";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createResumeToolClient } from "./tailored-resume/mcp-client.js";

delete process.env.GEMINI_API_KEY;
delete process.env.RESUME_MODEL;
delete process.env.MCP_URL;
delete process.env.MCP_SHARED_SECRET;

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
const resumeFileName = "phase13-secret-resume.pdf";
const storagePath = "phase13-secret-storage-path";

const sampleJob = {
  companyName: "Example Co",
  jobTitle: "Engineer",
  jobDescription: "Build APIs.",
  jobLocation: "Remote",
};

type App = ReturnType<typeof createApp>;

type Sections = {
  skills: unknown[];
  experience: unknown[];
  projects: unknown[];
  education: unknown[];
  certifications: unknown[];
};

type Harness = {
  app: App;
  rejectingApp: App;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  prompts: string[];
  sections: Sections;
  mode: { rewrite: boolean; write?: ResumeTailoringModel["write"] };
};

function createHarness(): Harness {
  const toolCalls: Harness["toolCalls"] = [];
  const prompts: string[] = [];
  const sections: Sections = {
    skills: [],
    experience: [],
    projects: [],
    education: [],
    certifications: [],
  };
  const mode: Harness["mode"] = { rewrite: false };
  const stub = createStubResumeModel();
  const tools: ResumeToolClient = {
    async callTool(name, args) {
      toolCalls.push({ name, args });
      if (name === "search_candidate_experience") {
        return JSON.stringify({ matches: [] });
      }
      if (name === "get_skills") {
        return JSON.stringify({ skills: sections.skills });
      }
      if (name === "get_experience") {
        return JSON.stringify({ experience: sections.experience });
      }
      if (name === "get_projects") {
        return JSON.stringify({ projects: sections.projects });
      }
      if (name === "get_education") {
        return JSON.stringify({ education: sections.education });
      }
      if (name === "get_certifications") {
        return JSON.stringify({ certifications: sections.certifications });
      }
      throw new Error(`unexpected tool ${name}`);
    },
  };
  const model: ResumeTailoringModel = {
    async write(input) {
      prompts.push(input.prompt);
      if (mode.write !== undefined) {
        return mode.write(input);
      }
      const copied = tailoredResumeSchema.parse(await stub.write(input));
      if (!mode.rewrite) {
        return copied;
      }
      return {
        ...copied,
        experience: copied.experience.map((item) => ({
          ...item,
          accomplishments: ["Led the API migration for reliability"],
        })),
      };
    },
  };
  const rejectingModel = {
    async analyze() {
      throw new Error("provider unavailable");
    },
  };
  return {
    app: createApp({
      jobAnalysisModel: createStubJobAnalysisModel(),
      resumeModel: model,
      resumeToolClient: tools,
    }),
    rejectingApp: createApp({
      jobAnalysisModel: rejectingModel,
      resumeModel: model,
      resumeToolClient: tools,
    }),
    toolCalls,
    prompts,
    sections,
    mode,
  };
}

function calendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function timestamps(record: { id: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function registerAndLogin(app: App): Promise<{ token: string; userId: string }> {
  const email = `phase13-${randomUUID()}@example.com`;
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

async function seedProfile(userId: string) {
  const skill = await prisma.skill.create({ data: { userId, name: "TypeScript" } });
  const experience = await prisma.workExperience.create({
    data: {
      userId,
      employer: "Acme",
      jobTitle: "Engineer",
      startDate: calendarDate("2020-01-15"),
      endDate: null,
      accomplishments: ["Led the API migration"],
      technologies: ["TypeScript"],
    },
  });
  const project = await prisma.project.create({
    data: {
      userId,
      name: "Portal",
      description: "Internal portal",
      url: null,
      startDate: null,
      endDate: null,
      accomplishments: [],
      technologies: [],
    },
  });
  const education = await prisma.education.create({
    data: {
      userId,
      institution: "State University",
      degree: "BS",
      fieldOfStudy: "Computer Science",
      startDate: calendarDate("2016-09-01"),
      endDate: null,
    },
  });
  const certification = await prisma.certification.create({
    data: {
      userId,
      name: "AWS Certified",
      issuer: "Amazon",
      issuedOn: calendarDate("2021-05-01"),
      expiresOn: null,
    },
  });
  await prisma.resumeFile.create({
    data: {
      userId,
      fileName: resumeFileName,
      contentType: "application/pdf",
      byteSize: 4,
      storagePath,
    },
  });
  return { skill, experience, project, education, certification };
}

function assignSections(
  sections: Sections,
  seeded: Awaited<ReturnType<typeof seedProfile>>,
): TailoredResume {
  sections.skills = [{ ...timestamps(seeded.skill), name: seeded.skill.name }];
  sections.experience = [
    {
      ...timestamps(seeded.experience),
      employer: seeded.experience.employer,
      jobTitle: seeded.experience.jobTitle,
      startDate: "2020-01-15",
      endDate: null,
      accomplishments: seeded.experience.accomplishments,
      technologies: seeded.experience.technologies,
    },
  ];
  sections.projects = [
    {
      ...timestamps(seeded.project),
      name: seeded.project.name,
      description: seeded.project.description,
      url: seeded.project.url,
      startDate: null,
      endDate: null,
      accomplishments: seeded.project.accomplishments,
      technologies: seeded.project.technologies,
    },
  ];
  sections.education = [
    {
      ...timestamps(seeded.education),
      institution: seeded.education.institution,
      degree: seeded.education.degree,
      fieldOfStudy: seeded.education.fieldOfStudy,
      startDate: "2016-09-01",
      endDate: null,
    },
  ];
  sections.certifications = [
    {
      ...timestamps(seeded.certification),
      name: seeded.certification.name,
      issuer: seeded.certification.issuer,
      issuedOn: "2021-05-01",
      expiresOn: null,
    },
  ];
  return {
    skills: [{ sourceId: seeded.skill.id, name: "TypeScript" }],
    experience: [
      {
        sourceId: seeded.experience.id,
        employer: "Acme",
        jobTitle: "Engineer",
        startDate: "2020-01-15",
        endDate: null,
        accomplishments: ["Led the API migration"],
        technologies: ["TypeScript"],
      },
    ],
    projects: [
      {
        sourceId: seeded.project.id,
        name: "Portal",
        description: "Internal portal",
        url: null,
        startDate: null,
        endDate: null,
        accomplishments: [],
        technologies: [],
      },
    ],
    education: [
      {
        sourceId: seeded.education.id,
        institution: "State University",
        degree: "BS",
        fieldOfStudy: "Computer Science",
        startDate: "2016-09-01",
        endDate: null,
      },
    ],
    certifications: [
      {
        sourceId: seeded.certification.id,
        name: "AWS Certified",
        issuer: "Amazon",
        issuedOn: "2021-05-01",
        expiresOn: null,
      },
    ],
  };
}

async function createCurrentJob(app: App, token: string): Promise<string> {
  const created = await request(app)
    .post("/jobs")
    .set("Authorization", `Bearer ${token}`)
    .send(sampleJob);
  expect(created.status).toBe(201);
  const jobId = created.body.job.id as string;
  await prisma.jobAnalysis.update({
    where: { jobId },
    data: { keywords: ["reliability"] },
  });
  return jobId;
}

function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

async function storedDocument(jobId: string): Promise<{ id: string; document: unknown }> {
  const row = await prisma.tailoredResume.findUnique({ where: { jobId } });
  if (row === null) {
    throw new Error("expected tailored resume");
  }
  return { id: row.id, document: row.document };
}

describe("tailored resume API", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  it("stores one grounded resume and replaces that row on the next generate", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.RESUME_MODEL).toBeUndefined();
    expect(process.env.MCP_URL).toBeUndefined();
    expect(process.env.MCP_SHARED_SECRET).toBeUndefined();
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const seeded = await seedProfile(owner.userId);
    const expected = assignSections(harness.sections, seeded);
    const jobId = await createCurrentJob(harness.app, owner.token);

    const created = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    expect(created.body).toEqual({ resume: expected });

    const names = harness.toolCalls.map((call) => call.name);
    expect(names).toContain("search_candidate_experience");
    expect(names).not.toContain("get_candidate_profile");
    expect(harness.prompts[0]?.includes(resumeFileName)).toBe(false);
    expect(harness.prompts[0]?.includes(storagePath)).toBe(false);
    expect(JSON.stringify(created.body).includes(resumeFileName)).toBe(false);
    expect(JSON.stringify(created.body).includes(storagePath)).toBe(false);

    const job = await request(harness.app).get(`/jobs/${jobId}`).set(auth(owner.token));
    expect(job.status).toBe(200);
    expect(job.body.job.status.tailoredResumePresent).toBe(true);

    const read = await request(harness.app)
      .get(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token));
    expect(read.status).toBe(200);
    expect(read.body).toEqual({ resume: expected });
    const firstRow = await storedDocument(jobId);

    harness.mode.rewrite = true;
    const replaced = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(replaced.status).toBe(200);
    expect(replaced.body.resume.experience[0].accomplishments).toEqual([
      "Led the API migration for reliability",
    ]);
    const rows = await prisma.tailoredResume.findMany({ where: { jobId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(firstRow.id);
    expect(rows[0]?.document).toEqual(replaced.body.resume);
  });

  it("rejects unknown, wrong-type, and other-user source ids without replacing the resume", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const seeded = await seedProfile(owner.userId);
    assignSections(harness.sections, seeded);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const original = await storedDocument(jobId);

    const stub = createStubResumeModel();
    const cases: Array<ResumeTailoringModel["write"]> = [
      async (input) => {
        const copied = tailoredResumeSchema.parse(await stub.write(input));
        return {
          ...copied,
          skills: [{ sourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff", name: "TypeScript" }],
        };
      },
      async (input) => {
        const copied = tailoredResumeSchema.parse(await stub.write(input));
        return {
          ...copied,
          skills: [{ sourceId: seeded.experience.id, name: "TypeScript" }],
        };
      },
    ];

    const other = await registerAndLogin(harness.app);
    const otherExperience = await prisma.workExperience.create({
      data: {
        userId: other.userId,
        employer: "Other Co",
        jobTitle: "Analyst",
        startDate: calendarDate("2021-01-01"),
        accomplishments: ["Watched the queue"],
        technologies: [],
      },
    });
    cases.push(async (input) => {
      const copied = tailoredResumeSchema.parse(await stub.write(input));
      return {
        ...copied,
        experience: copied.experience.map((item) => ({ ...item, sourceId: otherExperience.id })),
      };
    });

    for (const write of cases) {
      harness.mode.write = write;
      const failed = await request(harness.app)
        .post(`/jobs/${jobId}/tailored-resume`)
        .set(auth(owner.token))
        .send({});
      expect(failed.status).toBe(502);
      expect(failed.body).toEqual({ error: "Resume generation failed" });
      const row = await storedDocument(jobId);
      expect(row.id).toBe(original.id);
      expect(row.document).toEqual(original.document);
    }

    const hiddenRead = await request(harness.app)
      .get(`/jobs/${jobId}/tailored-resume`)
      .set(auth(other.token));
    expect(hiddenRead.status).toBe(404);
    expect(hiddenRead.body).toEqual({ error: "Not found" });
    const callsBefore = harness.toolCalls.length;
    const hiddenWrite = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(other.token))
      .send({});
    expect(hiddenWrite.status).toBe(404);
    expect(hiddenWrite.body).toEqual({ error: "Not found" });
    expect(harness.toolCalls.length).toBe(callsBefore);
    expect((await storedDocument(jobId)).document).toEqual(original.document);
  });

  it("rejects an added technology without replacing the resume", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    assignSections(harness.sections, await seedProfile(owner.userId));
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const original = await storedDocument(jobId);
    const stub = createStubResumeModel();
    harness.mode.write = async (input) => {
      const copied = tailoredResumeSchema.parse(await stub.write(input));
      return {
        ...copied,
        experience: copied.experience.map((item) => ({
          ...item,
          technologies: [...item.technologies, "Kubernetes"],
        })),
      };
    };
    const failed = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Resume generation failed" });
    const row = await storedDocument(jobId);
    expect(row.id).toBe(original.id);
    expect(row.document).toEqual(original.document);
  });

  it("returns 409 without calling tools when analysis is missing or stale", async () => {
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
    const callsBeforeMissing = harness.toolCalls.length;
    const missingAnalysis = await request(harness.app)
      .post(`/jobs/${missing.id}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(missingAnalysis.status).toBe(409);
    expect(missingAnalysis.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.toolCalls.length).toBe(callsBeforeMissing);

    const jobId = await createCurrentJob(harness.app, owner.token);
    await prisma.jobAnalysis.update({
      where: { jobId },
      data: { analyzedDescription: "A different description." },
    });
    const callsBeforeStale = harness.toolCalls.length;
    const stale = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(stale.status).toBe(409);
    expect(stale.body).toEqual({ error: "Job analysis is not current" });
    expect(harness.toolCalls.length).toBe(callsBeforeStale);
  });

  it("clears the resume when the description changes and keeps it when analysis fails or the title changes", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    assignSections(harness.sections, await seedProfile(owner.userId));
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const original = await storedDocument(jobId);

    const callsBeforeReject = harness.toolCalls.length;
    const rejected = await request(harness.rejectingApp)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(rejected.status).toBe(502);
    expect(rejected.body).toEqual({ error: "Job analysis failed" });
    expect(harness.toolCalls.length).toBe(callsBeforeReject);
    expect((await storedDocument(jobId)).document).toEqual(original.document);

    const titled = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobTitle: "Staff Engineer" });
    expect(titled.status).toBe(200);
    expect(titled.body.job.status.tailoredResumePresent).toBe(true);
    expect((await storedDocument(jobId)).id).toBe(original.id);

    const described = await request(harness.app)
      .patch(`/jobs/${jobId}`)
      .set(auth(owner.token))
      .send({ jobDescription: "Build reliable APIs." });
    expect(described.status).toBe(200);
    expect(described.body.job.status.tailoredResumePresent).toBe(false);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(0);
    const missing = await request(harness.app)
      .get(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token));
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: "Not found" });
  });

  it("deletes the resume row when the job is deleted", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    assignSections(harness.sections, await seedProfile(owner.userId));
    const jobId = await createCurrentJob(harness.app, owner.token);
    const created = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(created.status).toBe(200);
    const deleted = await request(harness.app).delete(`/jobs/${jobId}`).set(auth(owner.token));
    expect(deleted.status).toBe(204);
    expect(await prisma.tailoredResume.count({ where: { jobId } })).toBe(0);
  });

  it("does not call tools for a keyed body or a missing token", async () => {
    const harness = createHarness();
    const owner = await registerAndLogin(harness.app);
    const jobId = await createCurrentJob(harness.app, owner.token);
    const callsBefore = harness.toolCalls.length;
    const keyed = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set(auth(owner.token))
      .send({ resume: true });
    expect(keyed.status).toBe(400);
    expect(keyed.body).toEqual({ error: "Invalid input" });
    const missing = await request(harness.app).post(`/jobs/${jobId}/tailored-resume`).send({});
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "Unauthorized" });
    const invalid = await request(harness.app)
      .post(`/jobs/${jobId}/tailored-resume`)
      .set("Authorization", "Bearer not-a-token")
      .send({});
    expect(invalid.status).toBe(401);
    expect(invalid.body).toEqual({ error: "Unauthorized" });
    expect(harness.toolCalls.length).toBe(callsBefore);
  });

  it("returns 502 and writes nothing when resume generation cannot be resolved", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.RESUME_MODEL).toBeUndefined();
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
            requiredSkills: [],
            preferredSkills: [],
            responsibilities: [],
            experienceRequirements: [],
            technologies: [],
            interviewTopics: [],
            keywords: [],
          },
        },
      },
    });
    const failed = await request(bare)
      .post(`/jobs/${inserted.id}/tailored-resume`)
      .set(auth(owner.token))
      .send({});
    expect(failed.status).toBe(502);
    expect(failed.body).toEqual({ error: "Resume generation failed" });
    expect(await prisma.tailoredResume.count({ where: { jobId: inserted.id } })).toBe(0);
  });

  it("sends the MCP secret and user id as headers and keeps the user id out of the body", async () => {
    const userId = "abcdefab-cdef-4abc-8def-abcdefabcdef";
    const secret = "phase13-header-secret";
    const recorded: { headers?: IncomingHttpHeaders; body?: string } = {};
    const server = createServer((req, response) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on("end", () => {
        recorded.headers = req.headers;
        recorded.body = Buffer.concat(chunks).toString("utf8");
        response.writeHead(500);
        response.end();
        server.close();
      });
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a port");
    }
    const client = createResumeToolClient({
      url: `http://127.0.0.1:${address.port}/mcp`,
      secret,
      userId,
    });
    await expect(client.callTool("get_skills", {})).rejects.toThrow();
    expect(recorded.headers?.["x-jobpilot-mcp-secret"]).toBe(secret);
    expect(recorded.headers?.["x-jobpilot-user-id"]).toBe(userId);
    expect(recorded.body?.includes(userId)).toBe(false);
  });
});
