import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  tailoredResumeSchema,
  tailoredResumeStructuredSchema,
  type JobAnalysis,
  type TailoredResume,
} from "@jobpilot/shared";
import { describe, expect, it } from "vitest";
import {
  assertTailoredResumeGrounded,
  createStubResumeModel,
  tailorResume,
  type GroundingProfile,
  type ResumeTailoringModel,
  type ResumeToolClient,
  type ResumeToolResults,
} from "./tailored-resume.js";

delete process.env.GEMINI_API_KEY;

const resumeSections = ["skills", "experience", "projects", "education", "certifications"] as const;

function containsSchemaRef(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsSchemaRef(item));
  }
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return Object.entries(value).some(([key, nested]) => key === "$ref" || containsSchemaRef(nested));
}

function collectMaxItems(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectMaxItems(item));
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  const found: number[] = [];
  for (const [key, nested] of Object.entries(value)) {
    if (key === "maxItems" && typeof nested === "number") {
      found.push(nested);
    } else {
      found.push(...collectMaxItems(nested));
    }
  }
  return found;
}

describe("tailored resume structured output", () => {
  it("converts the schema to JSON Schema without $ref", () => {
    const schema: unknown = toJsonSchema(tailoredResumeSchema);

    expect(containsSchemaRef(schema)).toBe(false);
    expect(schema).toMatchObject({
      type: "object",
      properties: Object.fromEntries(resumeSections.map((section) => [section, { type: "array" }])),
    });
    expect(collectMaxItems(schema)).toEqual(expect.arrayContaining([50, 20, 30]));
  });

  it("converts the Gemini schema without $ref or large maxItems", () => {
    const schema: unknown = toJsonSchema(tailoredResumeStructuredSchema);
    const maxItems = collectMaxItems(schema);

    expect(containsSchemaRef(schema)).toBe(false);
    expect(maxItems.some((value) => value >= 50)).toBe(false);
    expect(maxItems).toEqual(expect.arrayContaining([20, 30]));
    expect(schema).toMatchObject({
      type: "object",
      properties: Object.fromEntries(resumeSections.map((section) => [section, { type: "array" }])),
    });
  });
});

const skillId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const experienceId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const projectId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const educationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const certificationId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const unknownId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const analysis: JobAnalysis = {
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  responsibilities: ["Build APIs"],
  experienceRequirements: ["Five years"],
  technologies: ["Node"],
  interviewTopics: ["Systems"],
  keywords: ["reliability"],
};

const searchQuery = [
  "Required skills: TypeScript",
  "Preferred skills:",
  "Responsibilities: Build APIs",
  "Experience requirements: Five years",
  "Technologies: Node",
  "Interview topics: Systems",
  "Keywords: reliability",
].join("\n");

const timestamps = {
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z",
};

const toolResults: ResumeToolResults = {
  search: JSON.stringify({ matches: [{ employer: "Not Copied" }] }),
  skills: JSON.stringify({
    skills: [{ id: skillId, name: "TypeScript", ...timestamps }],
  }),
  experience: JSON.stringify({
    experience: [
      {
        id: experienceId,
        employer: "Secret Employer",
        jobTitle: "Engineer",
        startDate: "2020-01-15",
        endDate: null,
        accomplishments: ["Led the API migration"],
        technologies: ["TypeScript"],
        ...timestamps,
      },
    ],
  }),
  projects: JSON.stringify({
    projects: [
      {
        id: projectId,
        name: "Portal",
        description: "Internal portal",
        url: null,
        startDate: null,
        endDate: null,
        accomplishments: [],
        technologies: [],
        ...timestamps,
      },
    ],
  }),
  education: JSON.stringify({
    education: [
      {
        id: educationId,
        institution: "State University",
        degree: "BS",
        fieldOfStudy: "Computer Science",
        startDate: "2016-09-01",
        endDate: null,
        ...timestamps,
      },
    ],
  }),
  certifications: JSON.stringify({
    certifications: [
      {
        id: certificationId,
        name: "AWS Certified",
        issuer: "Amazon",
        issuedOn: "2021-05-01",
        expiresOn: null,
        ...timestamps,
      },
    ],
  }),
};

const copiedResume: TailoredResume = {
  skills: [{ sourceId: skillId, name: "TypeScript" }],
  experience: [
    {
      sourceId: experienceId,
      employer: "Secret Employer",
      jobTitle: "Engineer",
      startDate: "2020-01-15",
      endDate: null,
      accomplishments: ["Led the API migration"],
      technologies: ["TypeScript"],
    },
  ],
  projects: [
    {
      sourceId: projectId,
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
      sourceId: educationId,
      institution: "State University",
      degree: "BS",
      fieldOfStudy: "Computer Science",
      startDate: "2016-09-01",
      endDate: null,
    },
  ],
  certifications: [
    {
      sourceId: certificationId,
      name: "AWS Certified",
      issuer: "Amazon",
      issuedOn: "2021-05-01",
      expiresOn: null,
    },
  ],
};

describe("tailored resume strict validation", () => {
  it("parses a valid resume and rejects arrays above the existing limits", () => {
    expect(tailoredResumeSchema.parse(copiedResume)).toEqual(copiedResume);

    for (const section of resumeSections) {
      const item = copiedResume[section][0];
      expect(
        tailoredResumeSchema.safeParse({
          ...copiedResume,
          [section]: Array.from({ length: 51 }, () => item),
        }).success,
      ).toBe(false);
    }

    const experience = copiedResume.experience[0];
    expect(experience).toBeDefined();
    expect(
      tailoredResumeSchema.safeParse({
        ...copiedResume,
        experience: [
          {
            ...experience,
            accomplishments: Array.from({ length: 21 }, () => "Led the API migration"),
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      tailoredResumeSchema.safeParse({
        ...copiedResume,
        experience: [
          {
            ...experience,
            technologies: Array.from({ length: 31 }, () => "TypeScript"),
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects oversized model output before the workflow returns a resume", async () => {
    const model: ResumeTailoringModel = {
      async write() {
        return {
          ...copiedResume,
          skills: Array.from({ length: 51 }, () => copiedResume.skills[0]),
        };
      },
    };

    await expect(tailorResume(analysis, recordingTools(toolResults, []), model)).rejects.toThrow();
  });
});

function recordingTools(results: ResumeToolResults, events: string[]): ResumeToolClient {
  return {
    async callTool(name, args) {
      events.push(`${name}:${JSON.stringify(args)}`);
      if (name === "search_candidate_experience") {
        return results.search;
      }
      if (name === "get_skills") {
        return results.skills;
      }
      if (name === "get_experience") {
        return results.experience;
      }
      if (name === "get_projects") {
        return results.projects;
      }
      if (name === "get_education") {
        return results.education;
      }
      if (name === "get_certifications") {
        return results.certifications;
      }
      throw new Error(`unexpected tool ${name}`);
    },
  };
}

const profile: GroundingProfile = {
  skills: [{ id: skillId, name: "TypeScript" }],
  experience: [
    {
      id: experienceId,
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
      id: projectId,
      name: "Portal",
      description: "Internal portal",
      url: null,
      startDate: null,
      endDate: null,
      accomplishments: ["Shipped the portal"],
      technologies: ["TypeScript"],
    },
  ],
  education: [
    {
      id: educationId,
      institution: "State University",
      degree: "BS",
      fieldOfStudy: "Computer Science",
      startDate: "2016-09-01",
      endDate: null,
    },
  ],
  certifications: [
    {
      id: certificationId,
      name: "AWS Certified",
      issuer: "Amazon",
      issuedOn: "2021-05-01",
      expiresOn: null,
    },
  ],
};

const keywordAnalysis: JobAnalysis = {
  requiredSkills: [],
  preferredSkills: [],
  responsibilities: [],
  experienceRequirements: [],
  technologies: [],
  interviewTopics: [],
  keywords: ["reliability"],
};

function exactResume(): TailoredResume {
  return {
    skills: [{ sourceId: skillId, name: "TypeScript" }],
    experience: [
      {
        sourceId: experienceId,
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
        sourceId: projectId,
        name: "Portal",
        description: "Internal portal",
        url: null,
        startDate: null,
        endDate: null,
        accomplishments: ["Shipped the portal"],
        technologies: ["TypeScript"],
      },
    ],
    education: [
      {
        sourceId: educationId,
        institution: "State University",
        degree: "BS",
        fieldOfStudy: "Computer Science",
        startDate: "2016-09-01",
        endDate: null,
      },
    ],
    certifications: [
      {
        sourceId: certificationId,
        name: "AWS Certified",
        issuer: "Amazon",
        issuedOn: "2021-05-01",
        expiresOn: null,
      },
    ],
  };
}

function withExperience(
  patch: Partial<TailoredResume["experience"][number]>,
): TailoredResume {
  const resume = exactResume();
  const current = resume.experience[0];
  if (current === undefined) {
    throw new Error("expected experience");
  }
  resume.experience[0] = { ...current, ...patch };
  return resume;
}

describe("tailored resume workflow", () => {
  it("searches before the section tools and the model, and keeps profile text out of the prefix", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const events: string[] = [];
    let prompt = "";
    const model: ResumeTailoringModel = {
      async write(input) {
        events.push("write");
        prompt = input.prompt;
        return createStubResumeModel().write(input);
      },
    };

    const result = await tailorResume(analysis, recordingTools(toolResults, events), model);

    expect(events).toEqual([
      `search_candidate_experience:${JSON.stringify({ query: searchQuery })}`,
      `get_skills:${JSON.stringify({})}`,
      `get_experience:${JSON.stringify({})}`,
      `get_projects:${JSON.stringify({})}`,
      `get_education:${JSON.stringify({})}`,
      `get_certifications:${JSON.stringify({})}`,
      "write",
    ]);
    expect(events.join("\n").includes("get_candidate_profile")).toBe(false);
    expect(events.join("\n").includes("get_project_details")).toBe(false);
    expect(searchQuery.includes("Secret Employer")).toBe(false);
    const marker = "MCP tool results:";
    const prefix = prompt.slice(0, prompt.indexOf(marker) + marker.length);
    expect(prefix.includes("Secret Employer")).toBe(false);
    expect(prompt.includes("Secret Employer")).toBe(true);
    expect(prefix.includes(JSON.stringify(analysis))).toBe(true);
    expect(result).toEqual(copiedResume);
    expect(JSON.stringify(result).includes("Not Copied")).toBe(false);
  });

  it("tells the model to preserve null source fields exactly", async () => {
    let prompt = "";
    const model: ResumeTailoringModel = {
      async write(input) {
        prompt = input.prompt;
        return createStubResumeModel().write(input);
      },
    };

    const result = await tailorResume(analysis, recordingTools(toolResults, []), model);

    expect(prompt).toContain("When the source value is null, output JSON null");
    expect(prompt).toContain("experience endDate: if the source endDate is null, output null");
    expect(prompt).toContain("project url: if the source url is null, output null");
    expect(prompt).toContain("project startDate: if the source startDate is null, output null");
    expect(prompt).toContain("project endDate: if the source endDate is null, output null");
    expect(prompt).toContain("education endDate: if the source endDate is null, output null");
    expect(prompt).toContain("certification expiresOn: if the source expiresOn is null, output null");
    expect(prompt).toContain('the string "Present"');
    expect(prompt).toContain("current date");
    expect(result.experience[0]?.endDate).toBeNull();
    expect(result.projects[0]?.url).toBeNull();
    expect(result.projects[0]?.startDate).toBeNull();
    expect(result.projects[0]?.endDate).toBeNull();
    expect(result.education[0]?.endDate).toBeNull();
    expect(result.certifications[0]?.expiresOn).toBeNull();
  });

  it("rejects an extra model key and invalid tool JSON before write", async () => {
    const extra: ResumeTailoringModel = {
      async write() {
        return { extra: true };
      },
    };
    await expect(tailorResume(analysis, recordingTools(toolResults, []), extra)).rejects.toThrow();

    const events: string[] = [];
    const invalidResults: ResumeToolResults = { ...toolResults, search: "{" };
    const model: ResumeTailoringModel = {
      async write() {
        events.push("write");
        return copiedResume;
      },
    };
    await expect(tailorResume(analysis, recordingTools(invalidResults, []), model)).rejects.toThrow();
    expect(events).toEqual([]);
  });

  it("slices the search query to 2000 characters", async () => {
    const events: string[] = [];
    const longAnalysis: JobAnalysis = {
      ...analysis,
      keywords: ["k".repeat(2500)],
    };
    const model: ResumeTailoringModel = {
      async write(input) {
        return createStubResumeModel().write(input);
      },
    };
    await tailorResume(longAnalysis, recordingTools(toolResults, events), model);
    const queryEvent = events.find((event) => event.startsWith("search_candidate_experience:"));
    const parsed: unknown = JSON.parse(queryEvent?.slice("search_candidate_experience:".length) ?? "{}");
    if (parsed === null || typeof parsed !== "object" || !("query" in parsed)) {
      throw new Error("expected query");
    }
    const query = parsed.query;
    expect(typeof query).toBe("string");
    if (typeof query === "string") {
      expect(query.length).toBeLessThanOrEqual(2000);
      expect(query.startsWith("Required skills: TypeScript")).toBe(true);
      expect(query.includes("k".repeat(2500))).toBe(false);
    }
  });

  it("rejects a missing section key, a non-array section, and invalid JSON in the stub", async () => {
    const stub = createStubResumeModel();
    const input = { prompt: "prompt", toolResults };
    await expect(
      stub.write({ ...input, toolResults: { ...toolResults, skills: "not-json" } }),
    ).rejects.toThrow();
    await expect(
      stub.write({ ...input, toolResults: { ...toolResults, skills: "{}" } }),
    ).rejects.toThrow();
    await expect(
      stub.write({
        ...input,
        toolResults: { ...toolResults, experience: JSON.stringify({ experience: {} }) },
      }),
    ).rejects.toThrow();
  });
});

describe("tailored resume grounding", () => {
  it("accepts an exact copy and a bullet that only adds an analysis keyword", () => {
    expect(() => assertTailoredResumeGrounded(exactResume(), profile, keywordAnalysis)).not.toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration for reliability"] }),
        profile,
        keywordAnalysis,
      ),
    ).not.toThrow();
  });

  it("rejects an unknown source id and a source id from another section", () => {
    expect(() =>
      assertTailoredResumeGrounded(withExperience({ sourceId: unknownId }), profile, keywordAnalysis),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        {
          ...exactResume(),
          skills: [{ sourceId: experienceId, name: "TypeScript" }],
        },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
  });

  it("rejects unsupported claims", () => {
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration by 40 percent"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ technologies: ["TypeScript", "Kubernetes"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration with Kubernetes"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(withExperience({ employer: "Contoso" }), profile, keywordAnalysis),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration at Contoso"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(withExperience({ jobTitle: "Architect" }), profile, keywordAnalysis),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration as Architect"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ startDate: "2019-01-15" }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Led the API migration in 2019"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        withExperience({ accomplishments: ["Won a hackathon"] }),
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
  });

  it("accepts null source fields and rejects invented replacements", () => {
    const resume = exactResume();
    expect(resume.experience[0]?.endDate).toBeNull();
    expect(resume.projects[0]?.url).toBeNull();
    expect(resume.projects[0]?.startDate).toBeNull();
    expect(resume.projects[0]?.endDate).toBeNull();
    expect(resume.education[0]?.endDate).toBeNull();
    expect(resume.certifications[0]?.expiresOn).toBeNull();
    expect(() => assertTailoredResumeGrounded(resume, profile, keywordAnalysis)).not.toThrow();

    expect(() =>
      assertTailoredResumeGrounded(withExperience({ endDate: "2026-10-05" }), profile, keywordAnalysis),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(withExperience({ endDate: "Present" }), profile, keywordAnalysis),
    ).toThrow();

    const project = resume.projects[0];
    const education = resume.education[0];
    const certification = resume.certifications[0];
    if (project === undefined || education === undefined || certification === undefined) {
      throw new Error("expected resume sections");
    }
    expect(() =>
      assertTailoredResumeGrounded(
        { ...resume, projects: [{ ...project, url: "https://example.com/no-url" }] },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        { ...resume, projects: [{ ...project, startDate: "2024-01-01" }] },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        { ...resume, projects: [{ ...project, endDate: "2026-10-05" }] },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        { ...resume, education: [{ ...education, endDate: "2020-05-15" }] },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
    expect(() =>
      assertTailoredResumeGrounded(
        { ...resume, certifications: [{ ...certification, expiresOn: "2026-07-24" }] },
        profile,
        keywordAnalysis,
      ),
    ).toThrow();
  });

  it("requires a project start date to equal the cited record, including null", () => {
    const resume = exactResume();
    expect(() => assertTailoredResumeGrounded(resume, profile, keywordAnalysis)).not.toThrow();
    const current = resume.projects[0];
    if (current === undefined) {
      throw new Error("expected project");
    }
    resume.projects[0] = { ...current, startDate: "2020-01-15" };
    expect(() => assertTailoredResumeGrounded(resume, profile, keywordAnalysis)).toThrow();
  });
});
