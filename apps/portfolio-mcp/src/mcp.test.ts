import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import type { EmbeddingClient } from "@jobpilot/ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PrismaClient } from "@jobpilot/database";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startHttpServer, type ListeningServer } from "./http.js";

delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_EMBEDDING_MODEL;
delete process.env.EMBEDDING_MODEL;

const databaseUrl = process.env.DATABASE_URL;
const sharedSecret = process.env.MCP_SHARED_SECRET;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

if (sharedSecret === undefined || sharedSecret.length === 0) {
  throw new Error("MCP_SHARED_SECRET is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const toolNames = [
  "get_candidate_profile",
  "get_skills",
  "get_experience",
  "get_projects",
  "get_project_details",
  "get_education",
  "get_certifications",
  "search_candidate_experience",
];

type ToolResult = Awaited<ReturnType<Client["callTool"]>>;

function formatCalendarDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCalendarDateOrNull(value: Date | null): string | null {
  return value === null ? null : formatCalendarDate(value);
}

function timestamps(record: { id: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toolText(result: ToolResult): { text: string; isError: boolean } {
  if (!("content" in result) || !Array.isArray(result.content) || result.content.length !== 1) {
    throw new Error("Expected one content part");
  }
  const part: unknown = result.content[0];
  if (typeof part !== "object" || part === null || !("type" in part) || part.type !== "text" || !("text" in part) || typeof part.text !== "string") {
    throw new Error("Expected text content");
  }
  if (!("isError" in result) || typeof result.isError !== "boolean") {
    throw new Error("Expected isError");
  }
  return { text: part.text, isError: result.isError };
}

async function connectClient(port: number, userId: string): Promise<Client> {
  const client = new Client({ name: "phase11-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: {
      headers: {
        "x-jobpilot-mcp-secret": sharedSecret as string,
        "x-jobpilot-user-id": userId,
      },
    },
  });
  await client.connect(transport);
  return client;
}

describe("portfolio mcp", () => {
  let server: ListeningServer;
  const userIds: string[] = [];

  beforeAll(async () => {
    server = await startHttpServer(0, "127.0.0.1");
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
    }
  });

  it("returns only the context user's profile through the MCP client", async () => {
    const alphaHash = "phase11-password-hash-alpha";
    const betaHash = "phase11-password-hash-beta";
    const resumeFileName = "phase11-resume-alpha.pdf";
    const storagePath = "phase11-storage-path-alpha";

    const alpha = await prisma.user.create({
      data: {
        email: `phase11-alpha-${randomUUID()}@example.com`,
        passwordHash: alphaHash,
        skills: { create: { name: "alpha-skill" } },
        educations: {
          create: {
            institution: "alpha-institution",
            degree: "alpha-degree",
            fieldOfStudy: "alpha-field",
            startDate: new Date("2018-09-01T00:00:00.000Z"),
            endDate: null,
          },
        },
        workExperiences: {
          create: {
            employer: "alpha-employer",
            jobTitle: "alpha-title",
            startDate: new Date("2021-03-04T00:00:00.000Z"),
            endDate: new Date("2022-04-05T00:00:00.000Z"),
            accomplishments: ["alpha-experience-accomplishment-1", "alpha-experience-accomplishment-2"],
            technologies: ["alpha-experience-tech-1", "alpha-experience-tech-2"],
          },
        },
        projects: {
          create: [
            {
              name: "alpha-project-early",
              description: "alpha-project-early-description",
              url: "https://alpha.example/early",
              startDate: new Date("2019-01-02T00:00:00.000Z"),
              endDate: new Date("2019-06-03T00:00:00.000Z"),
              accomplishments: ["alpha-early-accomplishment-1", "alpha-early-accomplishment-2"],
              technologies: ["alpha-early-tech-1", "alpha-early-tech-2"],
              createdAt: new Date("2020-01-01T00:00:00.000Z"),
            },
            {
              name: "alpha-project-late",
              description: "alpha-project-late-description",
              url: null,
              startDate: null,
              endDate: null,
              accomplishments: [],
              technologies: [],
              createdAt: new Date("2020-06-01T00:00:00.000Z"),
            },
          ],
        },
        certifications: {
          create: {
            name: "alpha-certification",
            issuer: "alpha-issuer",
            issuedOn: new Date("2023-07-08T00:00:00.000Z"),
            expiresOn: null,
          },
        },
        resumeFiles: {
          create: {
            fileName: resumeFileName,
            contentType: "application/pdf",
            byteSize: 3,
            storagePath,
          },
        },
      },
    });
    userIds.push(alpha.id);
    const beta = await prisma.user.create({
      data: {
        email: `phase11-beta-${randomUUID()}@example.com`,
        passwordHash: betaHash,
        skills: { create: { name: "beta-skill" } },
        educations: {
          create: {
            institution: "beta-institution",
            degree: "beta-degree",
            fieldOfStudy: "beta-field",
            startDate: new Date("2017-01-01T00:00:00.000Z"),
            endDate: new Date("2017-12-31T00:00:00.000Z"),
          },
        },
        workExperiences: {
          create: {
            employer: "beta-employer",
            jobTitle: "beta-title",
            startDate: new Date("2016-01-01T00:00:00.000Z"),
            endDate: null,
            accomplishments: ["beta-experience-accomplishment"],
            technologies: ["beta-experience-tech"],
          },
        },
        projects: {
          create: [
            {
              name: "beta-project-early",
              description: "beta-project-early-description",
              url: "https://beta.example/early",
              startDate: new Date("2015-01-01T00:00:00.000Z"),
              endDate: null,
              accomplishments: ["beta-project-accomplishment"],
              technologies: ["beta-project-tech"],
              createdAt: new Date("2015-02-01T00:00:00.000Z"),
            },
            {
              name: "beta-project-late",
              description: "beta-project-late-description",
              url: null,
              startDate: null,
              endDate: null,
              accomplishments: [],
              technologies: [],
              createdAt: new Date("2015-08-01T00:00:00.000Z"),
            },
          ],
        },
        certifications: {
          create: {
            name: "beta-certification",
            issuer: "beta-issuer",
            issuedOn: new Date("2014-05-06T00:00:00.000Z"),
            expiresOn: new Date("2014-05-07T00:00:00.000Z"),
          },
        },
      },
    });
    userIds.push(beta.id);

    const listOrder = [{ createdAt: "asc" as const }, { id: "asc" as const }];
    const [skills, education, experience, projects, certifications, betaProjects] = await Promise.all([
      prisma.skill.findMany({ where: { userId: alpha.id }, orderBy: listOrder }),
      prisma.education.findMany({ where: { userId: alpha.id }, orderBy: listOrder }),
      prisma.workExperience.findMany({ where: { userId: alpha.id }, orderBy: listOrder }),
      prisma.project.findMany({ where: { userId: alpha.id }, orderBy: listOrder }),
      prisma.certification.findMany({ where: { userId: alpha.id }, orderBy: listOrder }),
      prisma.project.findMany({ where: { userId: beta.id }, orderBy: listOrder }),
    ]);

    const expectedSkills = {
      skills: skills.map((row) => ({ ...timestamps(row), name: row.name })),
    };
    const expectedEducation = {
      education: education.map((row) => ({
        ...timestamps(row),
        institution: row.institution,
        degree: row.degree,
        fieldOfStudy: row.fieldOfStudy,
        startDate: formatCalendarDate(row.startDate),
        endDate: formatCalendarDateOrNull(row.endDate),
      })),
    };
    const expectedExperience = {
      experience: experience.map((row) => ({
        ...timestamps(row),
        employer: row.employer,
        jobTitle: row.jobTitle,
        startDate: formatCalendarDate(row.startDate),
        endDate: formatCalendarDateOrNull(row.endDate),
        accomplishments: row.accomplishments,
        technologies: row.technologies,
      })),
    };
    const expectedProjects = {
      projects: projects.map((row) => ({
        ...timestamps(row),
        name: row.name,
        description: row.description,
        url: row.url,
        startDate: formatCalendarDateOrNull(row.startDate),
        endDate: formatCalendarDateOrNull(row.endDate),
        accomplishments: row.accomplishments,
        technologies: row.technologies,
      })),
    };
    const expectedCertifications = {
      certifications: certifications.map((row) => ({
        ...timestamps(row),
        name: row.name,
        issuer: row.issuer,
        issuedOn: formatCalendarDate(row.issuedOn),
        expiresOn: formatCalendarDateOrNull(row.expiresOn),
      })),
    };

    const client = await connectClient(server.port, alpha.id);
    const successfulTexts: string[] = [];
    try {
      const listed = await client.listTools();
      expect(listed.tools.map((tool) => tool.name).sort()).toEqual([...toolNames].sort());
      const searchTool = listed.tools.find((tool) => tool.name === "search_candidate_experience");
      expect(searchTool).toBeDefined();
      expect(Object.keys(searchTool?.inputSchema.properties ?? {}).sort()).toEqual(["query"]);
      for (const tool of listed.tools) {
        const properties = tool.inputSchema.properties ?? {};
        expect(properties).not.toHaveProperty("userId");
        expect(properties).not.toHaveProperty("email");
      }

      const skillsResult = toolText(await client.callTool({ name: "get_skills", arguments: {} }));
      const experienceResult = toolText(await client.callTool({ name: "get_experience", arguments: {} }));
      const projectsResult = toolText(await client.callTool({ name: "get_projects", arguments: {} }));
      const educationResult = toolText(await client.callTool({ name: "get_education", arguments: {} }));
      const certificationsResult = toolText(
        await client.callTool({ name: "get_certifications", arguments: {} }),
      );
      const profileResult = toolText(await client.callTool({ name: "get_candidate_profile", arguments: {} }));
      const earlyProject = expectedProjects.projects[0];
      const lateProject = expectedProjects.projects[1];
      if (earlyProject === undefined || lateProject === undefined) {
        throw new Error("Expected two projects");
      }
      const projectResult = toolText(
        await client.callTool({
          name: "get_project_details",
          arguments: { projectId: earlyProject.id },
        }),
      );
      const overriddenSkills = toolText(
        await client.callTool({
          name: "get_skills",
          arguments: { userId: beta.id },
        }),
      );
      const overriddenProject = toolText(
        await client.callTool({
          name: "get_project_details",
          arguments: { projectId: earlyProject.id, userId: beta.id },
        }),
      );
      const betaProject = betaProjects[0];
      if (betaProject === undefined) {
        throw new Error("Expected a beta project");
      }
      const missingProject = toolText(
        await client.callTool({
          name: "get_project_details",
          arguments: { projectId: betaProject.id },
        }),
      );
      const invalidProject = toolText(
        await client.callTool({
          name: "get_project_details",
          arguments: { projectId: "not-a-uuid" },
        }),
      );

      expect(skillsResult.isError).toBe(false);
      expect(JSON.parse(skillsResult.text)).toEqual(expectedSkills);
      expect(experienceResult.isError).toBe(false);
      expect(JSON.parse(experienceResult.text)).toEqual(expectedExperience);
      expect(projectsResult.isError).toBe(false);
      expect(JSON.parse(projectsResult.text)).toEqual(expectedProjects);
      expect(expectedProjects.projects.map((project) => project.name)).toEqual([
        "alpha-project-early",
        "alpha-project-late",
      ]);
      expect(earlyProject.accomplishments).toEqual([
        "alpha-early-accomplishment-1",
        "alpha-early-accomplishment-2",
      ]);
      expect(educationResult.isError).toBe(false);
      expect(JSON.parse(educationResult.text)).toEqual(expectedEducation);
      expect(expectedEducation.education[0]?.startDate).toBe("2018-09-01");
      expect(certificationsResult.isError).toBe(false);
      expect(JSON.parse(certificationsResult.text)).toEqual(expectedCertifications);
      expect(profileResult.isError).toBe(false);
      expect(JSON.parse(profileResult.text)).toEqual({
        skills: expectedSkills.skills,
        experience: expectedExperience.experience,
        projects: expectedProjects.projects,
        education: expectedEducation.education,
        certifications: expectedCertifications.certifications,
      });
      expect(projectResult.isError).toBe(false);
      expect(JSON.parse(projectResult.text)).toEqual({ project: earlyProject });
      expect(overriddenSkills.isError).toBe(false);
      expect(JSON.parse(overriddenSkills.text)).toEqual(expectedSkills);
      expect(overriddenProject.isError).toBe(false);
      expect(JSON.parse(overriddenProject.text)).toEqual({ project: earlyProject });
      expect(lateProject.name).toBe("alpha-project-late");
      expect(missingProject).toEqual({ text: "Not found", isError: true });
      expect(invalidProject).toEqual({ text: "Invalid input", isError: true });

      successfulTexts.push(
        skillsResult.text,
        experienceResult.text,
        projectsResult.text,
        educationResult.text,
        certificationsResult.text,
        profileResult.text,
        projectResult.text,
        overriddenSkills.text,
        overriddenProject.text,
      );
    } finally {
      await client.close();
    }

    const betaClient = await connectClient(server.port, beta.id);
    try {
      const betaSkills = toolText(await betaClient.callTool({ name: "get_skills", arguments: {} }));
      expect(betaSkills.isError).toBe(false);
      expect(JSON.parse(betaSkills.text)).toMatchObject({ skills: [{ name: "beta-skill" }] });
      expect(betaSkills.text).not.toContain("alpha-skill");
      expect(betaSkills.text).not.toContain(resumeFileName);
      expect(betaSkills.text).not.toContain(storagePath);
      expect(betaSkills.text).not.toContain(alphaHash);
      expect(betaSkills.text).not.toContain(betaHash);
    } finally {
      await betaClient.close();
    }

    const betaFacts = [
      "beta-skill",
      "beta-institution",
      "beta-degree",
      "beta-field",
      "beta-employer",
      "beta-title",
      "beta-experience-accomplishment",
      "beta-experience-tech",
      "beta-project-early",
      "beta-project-early-description",
      "beta-project-accomplishment",
      "beta-project-tech",
      "beta-project-late",
      "beta-project-late-description",
      "beta-certification",
      "beta-issuer",
    ];
    for (const text of successfulTexts) {
      for (const fact of betaFacts) {
        expect(text).not.toContain(fact);
      }
      expect(text).not.toContain(resumeFileName);
      expect(text).not.toContain(storagePath);
      expect(text).not.toContain(alphaHash);
      expect(text).not.toContain(betaHash);
      expect(text).not.toContain(alpha.email);
      expect(text).not.toContain(beta.email);
      expect(text).not.toContain('"userId"');
    }
  });

  it("rejects a missing secret and an invalid user id", async () => {
    const missingSecret = await fetch(`http://127.0.0.1:${server.port}/mcp`, { method: "POST" });
    expect(missingSecret.status).toBe(401);
    expect(await missingSecret.json()).toEqual({ error: "Unauthorized" });

    const invalidUser = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
      method: "POST",
      headers: {
        "x-jobpilot-mcp-secret": sharedSecret as string,
        "x-jobpilot-user-id": "not-a-uuid",
      },
    });
    expect(invalidUser.status).toBe(401);
    expect(await invalidUser.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns the specified status for GET, DELETE, and other paths", async () => {
    for (const method of ["GET", "DELETE", "PUT", "PATCH", "OPTIONS"] as const) {
      const response = await fetch(`http://127.0.0.1:${server.port}/mcp`, { method });
      expect(response.status).toBe(405);
      expect(await response.json()).toEqual({ error: "Method not allowed" });
    }

    const methodNotAllowed = JSON.stringify({ error: "Method not allowed" });
    const headResponse = await fetch(`http://127.0.0.1:${server.port}/mcp`, { method: "HEAD" });
    expect(headResponse.status).toBe(405);
    expect(headResponse.headers.get("content-type")).toBe("application/json");
    expect(headResponse.headers.get("content-length")).toBe(String(Buffer.byteLength(methodNotAllowed)));

    const otherPath = await fetch(`http://127.0.0.1:${server.port}/health`, { method: "POST" });
    expect(otherPath.status).toBe(404);
    expect(await otherPath.json()).toEqual({ error: "Not found" });
  });

  it("ranks the context user's experience and projects together and ignores another user", async () => {
    const alpha = await prisma.user.create({
      data: {
        email: `phase12-alpha-${randomUUID()}@example.com`,
        passwordHash: "phase12-password-hash-alpha",
      },
    });
    const beta = await prisma.user.create({
      data: {
        email: `phase12-beta-${randomUUID()}@example.com`,
        passwordHash: "phase12-password-hash-beta",
      },
    });
    userIds.push(alpha.id, beta.id);
    const nearer = await prisma.workExperience.create({
      data: {
        userId: alpha.id,
        employer: "alpha-near-employer",
        jobTitle: "alpha-near-title",
        startDate: new Date("2021-03-04T00:00:00.000Z"),
        endDate: new Date("2022-04-05T00:00:00.000Z"),
        accomplishments: ["alpha-near-accomplishment"],
        technologies: ["alpha-near-tech"],
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      },
    });
    const farther = await prisma.project.create({
      data: {
        userId: alpha.id,
        name: "alpha-far-project",
        description: "alpha-far-description",
        url: null,
        startDate: null,
        endDate: null,
        accomplishments: [],
        technologies: [],
        createdAt: new Date("2024-01-02T00:00:00.000Z"),
      },
    });
    const other = await prisma.workExperience.create({
      data: {
        userId: beta.id,
        employer: "beta-nearer-employer",
        jobTitle: "beta-nearer-title",
        startDate: new Date("2016-01-01T00:00:00.000Z"),
        endDate: null,
        accomplishments: ["beta-nearer-accomplishment"],
        technologies: ["beta-nearer-tech"],
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
      },
    });
    await setEmbedding("WorkExperience", nearer.id, angled(0.4));
    await setEmbedding("Project", farther.id, angled(1.2));
    await setEmbedding("WorkExperience", other.id, angled(0));

    const searchServer = await startHttpServer(0, "127.0.0.1", queryClient(angled(0)));
    const client = await connectClient(searchServer.port, alpha.id);
    try {
      const expected = {
        matches: [
          {
            kind: "experience",
            experience: {
              ...timestamps(nearer),
              employer: nearer.employer,
              jobTitle: nearer.jobTitle,
              startDate: formatCalendarDate(nearer.startDate),
              endDate: formatCalendarDateOrNull(nearer.endDate),
              accomplishments: nearer.accomplishments,
              technologies: nearer.technologies,
            },
          },
          {
            kind: "project",
            project: {
              ...timestamps(farther),
              name: farther.name,
              description: farther.description,
              url: farther.url,
              startDate: formatCalendarDateOrNull(farther.startDate),
              endDate: formatCalendarDateOrNull(farther.endDate),
              accomplishments: farther.accomplishments,
              technologies: farther.technologies,
            },
          },
        ],
      };
      const result = toolText(
        await client.callTool({
          name: "search_candidate_experience",
          arguments: { query: "billing systems" },
        }),
      );
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.text)).toEqual(expected);
      expect(result.text).not.toContain("beta-nearer-employer");

      const overridden = toolText(
        await client.callTool({
          name: "search_candidate_experience",
          arguments: { query: "billing systems", userId: beta.id },
        }),
      );
      expect(overridden.isError).toBe(false);
      expect(JSON.parse(overridden.text)).toEqual(expected);
      expect(overridden.text).not.toContain("beta-nearer-employer");
    } finally {
      await client.close();
      await searchServer.close();
    }
  });

  it("keeps eight combined matches and omits null embeddings", async () => {
    const owner = await prisma.user.create({
      data: {
        email: `phase12-limit-${randomUUID()}@example.com`,
        passwordHash: "phase12-password-hash-limit",
      },
    });
    userIds.push(owner.id);
    const createdAt = new Date("2024-01-01T00:00:00.000Z");
    const ranked: Array<{ kind: "experience" | "project"; token: string; id: string }> = [];
    for (let index = 0; index < 12; index += 1) {
      const token = `limit-rank-${String(index).padStart(2, "0")}`;
      if (index % 2 === 0) {
        const row = await prisma.workExperience.create({
          data: {
            userId: owner.id,
            employer: token,
            jobTitle: "Engineer",
            startDate: new Date("2020-01-01T00:00:00.000Z"),
            endDate: null,
            accomplishments: [token],
            technologies: [],
            createdAt,
          },
        });
        await setEmbedding("WorkExperience", row.id, angled(0.05 * (index + 1)));
        ranked.push({ kind: "experience", token, id: row.id });
      } else {
        const row = await prisma.project.create({
          data: {
            userId: owner.id,
            name: token,
            description: token,
            url: null,
            startDate: null,
            endDate: null,
            accomplishments: [],
            technologies: [],
            createdAt,
          },
        });
        await setEmbedding("Project", row.id, angled(0.05 * (index + 1)));
        ranked.push({ kind: "project", token, id: row.id });
      }
    }
    const absent = await prisma.workExperience.create({
      data: {
        userId: owner.id,
        employer: "limit-null-employer",
        jobTitle: "Engineer",
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: null,
        accomplishments: ["limit-null-accomplishment"],
        technologies: [],
        createdAt,
      },
    });

    const searchServer = await startHttpServer(0, "127.0.0.1", queryClient(angled(0)));
    const client = await connectClient(searchServer.port, owner.id);
    try {
      const result = toolText(
        await client.callTool({
          name: "search_candidate_experience",
          arguments: { query: "nearest work" },
        }),
      );
      expect(result.isError).toBe(false);
      const body = JSON.parse(result.text) as {
        matches: Array<{ kind: string; experience?: { employer: string }; project?: { name: string } }>;
      };
      expect(body.matches).toHaveLength(8);
      expect(body.matches.map((match) => match.kind)).toEqual([
        "experience",
        "project",
        "experience",
        "project",
        "experience",
        "project",
        "experience",
        "project",
      ]);
      expect(body.matches[0]?.experience?.employer).toBe("limit-rank-00");
      expect(body.matches[7]?.project?.name).toBe("limit-rank-07");
      expect(result.text).not.toContain("limit-rank-08");
      expect(result.text).not.toContain("limit-null-employer");
      expect(result.text).not.toContain(absent.id);
      expect(ranked.slice(0, 8).map((row) => row.token)).toEqual([
        "limit-rank-00",
        "limit-rank-01",
        "limit-rank-02",
        "limit-rank-03",
        "limit-rank-04",
        "limit-rank-05",
        "limit-rank-06",
        "limit-rank-07",
      ]);
    } finally {
      await client.close();
      await searchServer.close();
    }
  });

  it("rejects an invalid query without embedding and reports search failure", async () => {
    let calls = 0;
    const clientImpl: EmbeddingClient = {
      async embedDocument() {
        calls += 1;
        return angled(0);
      },
      async embedQuery(text) {
        calls += 1;
        if (text === "reject-provider") {
          throw new Error("provider token sk-live");
        }
        if (text === "short-vector") {
          return [1, 2, 3];
        }
        if (text === "zero-vector") {
          return new Array<number>(768).fill(0);
        }
        return angled(0);
      },
    };
    const searchServer = await startHttpServer(0, "127.0.0.1", clientImpl);
    const owner = await prisma.user.create({
      data: {
        email: `phase12-invalid-${randomUUID()}@example.com`,
        passwordHash: "phase12-password-hash-invalid",
      },
    });
    userIds.push(owner.id);
    const client = await connectClient(searchServer.port, owner.id);
    try {
      for (const query of [undefined, 12, "   ", "a".repeat(2001)]) {
        const result = toolText(
          await client.callTool({
            name: "search_candidate_experience",
            arguments: query === undefined ? {} : { query },
          }),
        );
        expect(result).toEqual({ text: "Invalid input", isError: true });
      }
      expect(calls).toBe(0);

      for (const query of ["reject-provider", "short-vector", "zero-vector"]) {
        const result = toolText(
          await client.callTool({
            name: "search_candidate_experience",
            arguments: { query },
          }),
        );
        expect(result).toEqual({ text: "Search failed", isError: true });
        expect(result.text).not.toContain("sk-live");
      }

      const empty = toolText(
        await client.callTool({
          name: "search_candidate_experience",
          arguments: { query: "  usable query  " },
        }),
      );
      expect(empty.isError).toBe(false);
      expect(JSON.parse(empty.text)).toEqual({ matches: [] });
    } finally {
      await client.close();
      await searchServer.close();
    }
  });
});

function angled(theta: number): number[] {
  const vector = new Array<number>(768).fill(0);
  vector[0] = Math.cos(theta);
  vector[1] = Math.sin(theta);
  return vector;
}

function queryClient(vector: number[]): EmbeddingClient {
  return {
    async embedDocument() {
      throw new Error("embedDocument is not used by search");
    },
    async embedQuery() {
      return vector;
    },
  };
}

async function setEmbedding(
  table: "WorkExperience" | "Project",
  id: string,
  vector: number[],
): Promise<void> {
  const literal = `[${vector.join(",")}]`;
  if (table === "WorkExperience") {
    await prisma.$executeRaw`
      UPDATE "WorkExperience" SET embedding = ${literal}::vector WHERE id = ${id}
    `;
    return;
  }
  await prisma.$executeRaw`
    UPDATE "Project" SET embedding = ${literal}::vector WHERE id = ${id}
  `;
}
