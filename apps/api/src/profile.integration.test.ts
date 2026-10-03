import { randomUUID } from "node:crypto";
import { createStubEmbeddingClient, type EmbeddingClient } from "@jobpilot/ai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_EMBEDDING_MODEL;
delete process.env.EMBEDDING_MODEL;

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

const app = createApp({ embeddingClient: createStubEmbeddingClient() });
const unresolvedApp = createApp();
const createdEmails: string[] = [];
const password = "password1";

type JsonObject = Record<string, unknown>;

type ProfileRecord = JsonObject & { id: string; userId: string };

type ResourceCase = {
  label: string;
  path: string;
  listKey: string;
  itemKey: string;
  createBody: JsonObject;
  patchBody: JsonObject;
  invalidBody: JsonObject;
  clearBody: JsonObject | null;
  unchangedField: string;
};

const resources: ResourceCase[] = [
  {
    label: "skill",
    path: "/profile/skills",
    listKey: "skills",
    itemKey: "skill",
    createBody: { name: "TypeScript" },
    patchBody: { name: "Go" },
    invalidBody: { name: "   " },
    clearBody: null,
    unchangedField: "createdAt",
  },
  {
    label: "education",
    path: "/profile/education",
    listKey: "education",
    itemKey: "education",
    createBody: {
      institution: "State University",
      degree: "B.S.",
      fieldOfStudy: "Computer Science",
      startDate: "2016-09-01",
      endDate: "2020-05-15",
    },
    patchBody: { degree: "M.S." },
    invalidBody: {
      institution: "State University",
      degree: "B.S.",
      fieldOfStudy: "Computer Science",
      startDate: "2020-05-15",
      endDate: "2016-09-01",
    },
    clearBody: { endDate: null },
    unchangedField: "institution",
  },
  {
    label: "experience",
    path: "/profile/experience",
    listKey: "experience",
    itemKey: "experience",
    createBody: {
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2021-01-04",
      endDate: "2022-06-01",
      accomplishments: ["Shipped the billing service"],
      technologies: ["TypeScript", "PostgreSQL"],
    },
    patchBody: { jobTitle: "Senior Engineer" },
    invalidBody: {
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2021-01-04",
      accomplishments: [],
      technologies: [],
    },
    clearBody: { endDate: null },
    unchangedField: "employer",
  },
  {
    label: "project",
    path: "/profile/projects",
    listKey: "projects",
    itemKey: "project",
    createBody: {
      name: "JobPilot",
      description: "A job application assistant.",
      url: "https://example.com/jobpilot",
      startDate: "2024-02-01",
      endDate: null,
      accomplishments: [],
      technologies: ["React"],
    },
    patchBody: { description: "Updated description." },
    invalidBody: {
      name: "JobPilot",
      description: "A job application assistant.",
      url: "not-a-url",
      accomplishments: [],
      technologies: [],
    },
    clearBody: { url: null },
    unchangedField: "name",
  },
  {
    label: "certification",
    path: "/profile/certifications",
    listKey: "certifications",
    itemKey: "certification",
    createBody: {
      name: "AWS Cloud Practitioner",
      issuer: "Amazon Web Services",
      issuedOn: "2023-06-01",
      expiresOn: "2026-06-01",
    },
    patchBody: { issuer: "Amazon" },
    invalidBody: {
      name: "AWS Cloud Practitioner",
      issuer: "Amazon Web Services",
      issuedOn: "2026-06-01",
      expiresOn: "2023-06-01",
    },
    clearBody: { expiresOn: null },
    unchangedField: "name",
  },
];

function uniqueEmail(): string {
  const email = `phase5-${randomUUID()}@example.com`;
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

function records(body: JsonObject, key: string): ProfileRecord[] {
  const value = body[key];
  if (!Array.isArray(value)) {
    throw new Error(`expected ${key} array`);
  }
  return value as ProfileRecord[];
}

function record(body: JsonObject, key: string): ProfileRecord {
  const value = body[key];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`expected ${key} object`);
  }
  return value as ProfileRecord;
}

describe("profile API", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  });

  describe.each(resources)("$label", (resource) => {
    it("returns an empty list", async () => {
      const owner = await registerAndLogin();
      const response = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ [resource.listKey]: [] });
    });

    it("rejects a missing access token", async () => {
      const response = await request(app).get(resource.path);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Unauthorized" });
    });

    it("creates, lists, partially updates, and deletes a record", async () => {
      const owner = await registerAndLogin();
      const created = await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.createBody);

      expect(created.status).toBe(201);
      const createdRecord = record(created.body as JsonObject, resource.itemKey);
      expect(createdRecord).toMatchObject({ ...resource.createBody, userId: owner.userId });
      expect(createdRecord.id).toEqual(expect.any(String));
      expect(createdRecord.createdAt).toEqual(expect.any(String));
      expect(createdRecord.updatedAt).toEqual(expect.any(String));
      expect(JSON.stringify(created.body)).not.toContain("password");

      const listed = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(listed.status).toBe(200);
      expect(records(listed.body as JsonObject, resource.listKey)).toEqual([createdRecord]);

      const updated = await request(app)
        .patch(`${resource.path}/${createdRecord.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.patchBody);
      expect(updated.status).toBe(200);
      const updatedRecord = record(updated.body as JsonObject, resource.itemKey);
      expect(updatedRecord).toMatchObject({
        ...resource.createBody,
        ...resource.patchBody,
        userId: owner.userId,
        id: createdRecord.id,
      });
      expect(updatedRecord[resource.unchangedField]).toBe(createdRecord[resource.unchangedField]);

      const deleted = await request(app)
        .delete(`${resource.path}/${createdRecord.id}`)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(deleted.status).toBe(204);
      expect(deleted.text).toBe("");

      const afterDelete = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(afterDelete.body).toEqual({ [resource.listKey]: [] });
    });

    it("rejects invalid input without echoing the body", async () => {
      const owner = await registerAndLogin();
      const response = await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.invalidBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid input" });
      expect(JSON.stringify(response.body)).not.toContain(JSON.stringify(resource.invalidBody));

      const listed = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(listed.body).toEqual({ [resource.listKey]: [] });
    });

    it("rejects a body that includes userId", async () => {
      const owner = await registerAndLogin();
      const response = await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ ...resource.createBody, userId: "00000000-0000-4000-8000-000000000001" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "Invalid input" });

      const listed = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(listed.body).toEqual({ [resource.listKey]: [] });
    });

    it("hides another user's row and rejects their update and delete", async () => {
      const owner = await registerAndLogin();
      const other = await registerAndLogin();
      const created = await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.createBody);
      const createdRecord = record(created.body as JsonObject, resource.itemKey);

      await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${other.token}`)
        .send(resource.createBody);

      const ownerList = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      const otherList = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${other.token}`);
      const ownerIds = records(ownerList.body as JsonObject, resource.listKey).map((row) => row.id);
      const otherIds = records(otherList.body as JsonObject, resource.listKey).map((row) => row.id);

      expect(ownerIds).toEqual([createdRecord.id]);
      expect(otherIds).not.toContain(createdRecord.id);
      expect(otherIds).toHaveLength(1);

      const patched = await request(app)
        .patch(`${resource.path}/${createdRecord.id}`)
        .set("Authorization", `Bearer ${other.token}`)
        .send(resource.patchBody);
      expect(patched.status).toBe(404);
      expect(patched.body).toEqual({ error: "Not found" });

      const deleted = await request(app)
        .delete(`${resource.path}/${createdRecord.id}`)
        .set("Authorization", `Bearer ${other.token}`);
      expect(deleted.status).toBe(404);
      expect(deleted.body).toEqual({ error: "Not found" });

      const stillThere = await request(app)
        .get(resource.path)
        .set("Authorization", `Bearer ${owner.token}`);
      expect(records(stillThere.body as JsonObject, resource.listKey).map((row) => row.id)).toEqual([
        createdRecord.id,
      ]);
    });
  });

  it("clears nullable fields and leaves omitted fields unchanged", async () => {
    const owner = await registerAndLogin();

    for (const resource of resources) {
      if (resource.clearBody === null) {
        continue;
      }
      const created = await request(app)
        .post(resource.path)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.createBody);
      const createdRecord = record(created.body as JsonObject, resource.itemKey);
      const updated = await request(app)
        .patch(`${resource.path}/${createdRecord.id}`)
        .set("Authorization", `Bearer ${owner.token}`)
        .send(resource.clearBody);

      expect(updated.status).toBe(200);
      const updatedRecord = record(updated.body as JsonObject, resource.itemKey);
      expect(updatedRecord).toMatchObject({
        ...createdRecord,
        ...resource.clearBody,
        updatedAt: updatedRecord.updatedAt,
      });
      expect(updatedRecord[resource.unchangedField]).toBe(createdRecord[resource.unchangedField]);
    }
  });

  it("rejects an empty patch and leaves the row unchanged", async () => {
    const owner = await registerAndLogin();
    const created = await request(app)
      .post("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "TypeScript" });
    const createdRecord = record(created.body as JsonObject, "skill");

    const patched = await request(app)
      .patch(`/profile/skills/${createdRecord.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});

    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "Invalid input" });

    const listed = await request(app)
      .get("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(records(listed.body as JsonObject, "skills")).toEqual([createdRecord]);
  });

  it("returns 404 for a malformed path id", async () => {
    const owner = await registerAndLogin();

    const patched = await request(app)
      .patch("/profile/skills/not-a-uuid")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Nope" });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "Not found" });

    const deleted = await request(app)
      .delete("/profile/skills/not-a-uuid")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: "Not found" });
  });

  it("returns 404 for a missing id", async () => {
    const owner = await registerAndLogin();
    const missingId = "00000000-0000-4000-8000-000000000099";

    const patched = await request(app)
      .patch(`/profile/skills/${missingId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Nope" });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "Not found" });

    const deleted = await request(app)
      .delete(`/profile/skills/${missingId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: "Not found" });
  });

  it("allows credentialed preflight for PATCH and DELETE only from WEB_ORIGIN", async () => {
    const previous = process.env.WEB_ORIGIN;
    process.env.WEB_ORIGIN = "http://localhost:5173";
    try {
      const patchPreflight = await request(app)
        .options("/profile/skills/not-a-uuid")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "PATCH")
        .set("Access-Control-Request-Headers", "content-type,authorization");
      expect(patchPreflight.status).toBe(204);
      expect(patchPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(patchPreflight.headers["access-control-allow-credentials"]).toBe("true");
      expect(patchPreflight.headers["access-control-allow-methods"]).toBe(
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
      expect(patchPreflight.headers["access-control-allow-origin"]).not.toBe("*");

      const deletePreflight = await request(app)
        .options("/profile/skills/not-a-uuid")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "DELETE")
        .set("Access-Control-Request-Headers", "content-type,authorization");
      expect(deletePreflight.status).toBe(204);
      expect(deletePreflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(deletePreflight.headers["access-control-allow-methods"]).toContain("DELETE");
      expect(deletePreflight.headers["access-control-allow-methods"]).toContain("PATCH");

      const other = await request(app)
        .options("/profile/skills/not-a-uuid")
        .set("Origin", "http://evil.example")
        .set("Access-Control-Request-Method", "PATCH");
      expect(other.headers["access-control-allow-origin"]).toBeUndefined();
      expect(other.headers["access-control-allow-credentials"]).toBeUndefined();
    } finally {
      if (previous === undefined) {
        delete process.env.WEB_ORIGIN;
      } else {
        process.env.WEB_ORIGIN = previous;
      }
    }
  });

  it("rejects a startDate later than the stored endDate and leaves the row unchanged", async () => {
    const owner = await registerAndLogin();
    await request(app).post("/profile/experience").set("Authorization", `Bearer ${owner.token}`).send({
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2020-01-01",
      endDate: "2021-01-01",
      accomplishments: ["Shipped the billing service"],
      technologies: ["TypeScript"],
    });

    const before = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    const existing = records(before.body as JsonObject, "experience")[0];
    if (existing === undefined) {
      throw new Error("expected experience");
    }

    const patched = await request(app)
      .patch(`/profile/experience/${existing.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ startDate: "2022-01-01" });

    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "Invalid input" });

    const after = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(after.body).toEqual(before.body);
  });

  it("rejects an endDate earlier than the stored startDate and leaves the row unchanged", async () => {
    const owner = await registerAndLogin();
    await request(app).post("/profile/experience").set("Authorization", `Bearer ${owner.token}`).send({
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2020-01-01",
      endDate: "2021-01-01",
      accomplishments: ["Shipped the billing service"],
      technologies: ["TypeScript"],
    });

    const before = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    const existing = records(before.body as JsonObject, "experience")[0];
    if (existing === undefined) {
      throw new Error("expected experience");
    }

    const patched = await request(app)
      .patch(`/profile/experience/${existing.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ endDate: "2019-01-01" });

    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "Invalid input" });

    const after = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(after.body).toEqual(before.body);
  });

  it("rejects an issuedOn later than the stored expiresOn and leaves the row unchanged", async () => {
    const owner = await registerAndLogin();
    await request(app)
      .post("/profile/certifications")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "AWS Cloud Practitioner",
        issuer: "Amazon Web Services",
        issuedOn: "2023-06-01",
        expiresOn: "2025-06-01",
      });

    const before = await request(app)
      .get("/profile/certifications")
      .set("Authorization", `Bearer ${owner.token}`);
    const existing = records(before.body as JsonObject, "certifications")[0];
    if (existing === undefined) {
      throw new Error("expected certification");
    }

    const patched = await request(app)
      .patch(`/profile/certifications/${existing.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ issuedOn: "2026-01-01" });

    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "Invalid input" });

    const after = await request(app)
      .get("/profile/certifications")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(after.body).toEqual(before.body);
  });

  it("stores trimmed accomplishments and technologies in input order, including duplicates", async () => {
    const owner = await registerAndLogin();
    const created = await request(app)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        employer: "Example Co",
        jobTitle: "Engineer",
        startDate: "2021-01-04",
        accomplishments: ["  Zod  ", "  Express  ", "Zod"],
        technologies: ["  PostgreSQL  ", "TypeScript", "  TypeScript  "],
      });

    expect(created.status).toBe(201);
    expect(record(created.body as JsonObject, "experience")).toMatchObject({
      accomplishments: ["Zod", "Express", "Zod"],
      technologies: ["PostgreSQL", "TypeScript", "TypeScript"],
    });
  });

  it("rejects an accomplishment that trims to empty and does not replace the stored array", async () => {
    const owner = await registerAndLogin();
    const created = await request(app)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        employer: "Example Co",
        jobTitle: "Engineer",
        startDate: "2021-01-04",
        accomplishments: ["Shipped the billing service"],
        technologies: ["TypeScript"],
      });
    const createdRecord = record(created.body as JsonObject, "experience");

    const patched = await request(app)
      .patch(`/profile/experience/${createdRecord.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ accomplishments: ["Shipped the billing service", "   "] });

    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "Invalid input" });

    const listed = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(records(listed.body as JsonObject, "experience")).toEqual([createdRecord]);
  });

  it("orders rows by createdAt ascending and then id ascending", async () => {
    const owner = await registerAndLogin();
    const first = await request(app)
      .post("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Later name" });
    const second = await request(app)
      .post("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Earlier name" });
    const firstRecord = record(first.body as JsonObject, "skill");
    const secondRecord = record(second.body as JsonObject, "skill");
    const stamp = new Date("2020-01-01T00:00:00.000Z");
    await prisma.skill.update({ where: { id: firstRecord.id }, data: { createdAt: stamp } });
    await prisma.skill.update({ where: { id: secondRecord.id }, data: { createdAt: stamp } });

    const listed = await request(app)
      .get("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`);
    const rows = records(listed.body as JsonObject, "skills");
    const sorted = [...rows].sort((left, right) => {
      const created = String(left.createdAt).localeCompare(String(right.createdAt));
      if (created !== 0) {
        return created;
      }
      return left.id.localeCompare(right.id);
    });

    expect(rows.map((row) => row.id)).toEqual(sorted.map((row) => row.id));
    expect(rows.map((row) => row.id)).toEqual([firstRecord.id, secondRecord.id].sort());
  });

  it("stores, replaces, and deletes embeddings for the phase 12 document", async () => {
    const stub = createStubEmbeddingClient();
    const documents: string[] = [];
    const queries: string[] = [];
    const recordingClient: EmbeddingClient = {
      async embedDocument(text) {
        documents.push(text);
        const vector = await stub.embedDocument(text);
        if (text.includes("Senior Engineer") || text.includes("Updated description.")) {
          const replaced = vector.slice();
          replaced[0] = 0;
          replaced[1] = 1;
          return replaced;
        }
        return vector;
      },
      async embedQuery(text) {
        queries.push(text);
        return stub.embedQuery(text);
      },
    };
    const recordingApp = createApp({ embeddingClient: recordingClient });
    const owner = await registerAndLogin();
    const experienceBody = {
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2021-01-04",
      endDate: "2022-06-01",
      accomplishments: ["Shipped the billing service"],
      technologies: ["TypeScript", "PostgreSQL"],
    };
    const experienceDocument = [
      "Employer: Example Co",
      "Job title: Engineer",
      "Start date: 2021-01-04",
      "End date: 2022-06-01",
      "Accomplishments:",
      "- Shipped the billing service",
      "Technologies: TypeScript, PostgreSQL",
    ].join("\n");
    const mergedExperienceDocument = experienceDocument.replace(
      "Job title: Engineer",
      "Job title: Senior Engineer",
    );
    const projectBody = {
      name: "JobPilot",
      description: "A job application assistant.",
      url: "https://example.com/jobpilot",
      startDate: "2024-02-01",
      endDate: null,
      accomplishments: [],
      technologies: ["React"],
    };
    const projectDocument = [
      "Name: JobPilot",
      "Description: A job application assistant.",
      "URL: https://example.com/jobpilot",
      "Start date: 2024-02-01",
      "End date: none",
      "Accomplishments:",
      "none",
      "Technologies: React",
    ].join("\n");
    const mergedProjectDocument = projectDocument.replace(
      "Description: A job application assistant.",
      "Description: Updated description.",
    );

    const createdExperience = await request(recordingApp)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(experienceBody);
    expect(createdExperience.status).toBe(201);
    const experience = record(createdExperience.body as JsonObject, "experience");
    expect(experience).not.toHaveProperty("embedding");
    expect(experience).toMatchObject(experienceBody);
    expect(await storedEmbedding("WorkExperience", experience.id)).toEqual(stubVector());

    const updatedExperience = await request(recordingApp)
      .patch(`/profile/experience/${experience.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobTitle: "Senior Engineer" });
    expect(updatedExperience.status).toBe(200);
    expect(record(updatedExperience.body as JsonObject, "experience")).not.toHaveProperty("embedding");
    expect(await storedEmbedding("WorkExperience", experience.id)).toEqual(replacedVector());

    const createdProject = await request(recordingApp)
      .post("/profile/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(projectBody);
    expect(createdProject.status).toBe(201);
    const project = record(createdProject.body as JsonObject, "project");
    expect(project).not.toHaveProperty("embedding");
    expect(await storedEmbedding("Project", project.id)).toEqual(stubVector());

    const updatedProject = await request(recordingApp)
      .patch(`/profile/projects/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ description: "Updated description." });
    expect(updatedProject.status).toBe(200);
    expect(await storedEmbedding("Project", project.id)).toEqual(replacedVector());

    expect(documents).toEqual([
      experienceDocument,
      mergedExperienceDocument,
      projectDocument,
      mergedProjectDocument,
    ]);
    expect(queries).toEqual([]);

    const deleted = await request(recordingApp)
      .delete(`/profile/experience/${experience.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deleted.status).toBe(204);
    expect(await storedEmbedding("WorkExperience", experience.id)).toBeNull();
    const deletedProject = await request(recordingApp)
      .delete(`/profile/projects/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(deletedProject.status).toBe(204);
    expect(await storedEmbedding("Project", project.id)).toBeNull();
  });

  it("does not embed skills, education, certifications, or invalid experience writes", async () => {
    let calls = 0;
    const countingClient: EmbeddingClient = {
      async embedDocument() {
        calls += 1;
        return stubVector();
      },
      async embedQuery() {
        calls += 1;
        return stubVector();
      },
    };
    const countingApp = createApp({ embeddingClient: countingClient });
    const owner = await registerAndLogin();

    const missingToken = await request(countingApp).post("/profile/experience").send({
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2021-01-04",
      accomplishments: ["Shipped the billing service"],
      technologies: [],
    });
    expect(missingToken.status).toBe(401);
    const invalid = await request(countingApp)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        employer: "Example Co",
        jobTitle: "Engineer",
        startDate: "2021-01-04",
        accomplishments: [],
        technologies: [],
      });
    expect(invalid.status).toBe(400);

    const skill = await request(countingApp)
      .post("/profile/skills")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "TypeScript" });
    const education = await request(countingApp)
      .post("/profile/education")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        institution: "State University",
        degree: "B.S.",
        fieldOfStudy: "Computer Science",
        startDate: "2016-09-01",
        endDate: "2020-05-15",
      });
    const certification = await request(countingApp)
      .post("/profile/certifications")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "AWS Cloud Practitioner",
        issuer: "Amazon Web Services",
        issuedOn: "2023-06-01",
        expiresOn: "2026-06-01",
      });
    expect(skill.status).toBe(201);
    expect(education.status).toBe(201);
    expect(certification.status).toBe(201);
    expect(calls).toBe(0);
  });

  it("returns 502 and leaves create and update rows unchanged when embedding fails", async () => {
    const rejectingClient: EmbeddingClient = {
      async embedDocument() {
        throw new Error("provider unavailable");
      },
      async embedQuery() {
        throw new Error("provider unavailable");
      },
    };
    const rejectingApp = createApp({ embeddingClient: rejectingClient });
    const owner = await registerAndLogin();
    const experienceBody = {
      employer: "Example Co",
      jobTitle: "Engineer",
      startDate: "2021-01-04",
      endDate: "2022-06-01",
      accomplishments: ["Shipped the billing service"],
      technologies: ["TypeScript"],
    };

    const created = await request(rejectingApp)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(experienceBody);
    expect(created.status).toBe(502);
    expect(created.body).toEqual({ error: "Embedding failed" });
    expect(await prisma.workExperience.count({ where: { userId: owner.userId } })).toBe(0);

    const stored = await request(app)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send(experienceBody);
    const experience = record(stored.body as JsonObject, "experience");
    const previousVector = await storedEmbedding("WorkExperience", experience.id);

    const updated = await request(rejectingApp)
      .patch(`/profile/experience/${experience.id}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ jobTitle: "Should Roll Back" });
    expect(updated.status).toBe(502);
    expect(updated.body).toEqual({ error: "Embedding failed" });
    const listed = await request(app)
      .get("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(records(listed.body as JsonObject, "experience")).toEqual([experience]);
    expect(await storedEmbedding("WorkExperience", experience.id)).toEqual(previousVector);

    for (const vector of [new Array<number>(768).fill(0), [1, 2, 3]]) {
      const invalidApp = createApp({
        embeddingClient: {
          async embedDocument() {
            return vector;
          },
          async embedQuery() {
            return vector;
          },
        },
      });
      const failed = await request(invalidApp)
        .post("/profile/experience")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({
          employer: "Other Co",
          jobTitle: "Engineer",
          startDate: "2021-01-04",
          accomplishments: ["Shipped the billing service"],
          technologies: [],
        });
      expect(failed.status).toBe(502);
      expect(failed.body).toEqual({ error: "Embedding failed" });
    }
    expect(await prisma.workExperience.count({ where: { userId: owner.userId, employer: "Other Co" } })).toBe(0);
  });

  it("returns 502 and writes nothing when experience create has no embedding client", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(process.env.GEMINI_EMBEDDING_MODEL).toBeUndefined();
    expect(process.env.EMBEDDING_MODEL).toBeUndefined();
    const owner = await registerAndLogin();
    const created = await request(unresolvedApp)
      .post("/profile/experience")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        employer: "Example Co",
        jobTitle: "Engineer",
        startDate: "2021-01-04",
        accomplishments: ["Shipped the billing service"],
        technologies: [],
      });
    expect(created.status).toBe(502);
    expect(created.body).toEqual({ error: "Embedding failed" });
    expect(await prisma.workExperience.count({ where: { userId: owner.userId } })).toBe(0);
  });
});

function stubVector(): number[] {
  const vector = new Array<number>(768).fill(0);
  vector[0] = 1;
  return vector;
}

function replacedVector(): number[] {
  const vector = stubVector();
  vector[0] = 0;
  vector[1] = 1;
  return vector;
}

async function storedEmbedding(
  table: "WorkExperience" | "Project",
  id: string,
): Promise<number[] | null> {
  const rows =
    table === "WorkExperience"
      ? await prisma.$queryRaw<Array<{ embedding: string | null }>>`
          SELECT embedding::text AS embedding FROM "WorkExperience" WHERE id = ${id}
        `
      : await prisma.$queryRaw<Array<{ embedding: string | null }>>`
          SELECT embedding::text AS embedding FROM "Project" WHERE id = ${id}
        `;
  const embedding = rows[0]?.embedding;
  if (embedding === undefined || embedding === null) {
    return null;
  }
  return embedding
    .slice(1, -1)
    .split(",")
    .map((component) => Number(component.trim()));
}
