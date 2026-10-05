import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  tailoredResumeSchema,
  tailoredResumeStructuredSchema,
  type JobAnalysis,
  type TailoredResume,
} from "@jobpilot/shared";

export type ResumeToolClient = {
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
};

export type ResumeToolResults = {
  search: string;
  skills: string;
  experience: string;
  projects: string;
  education: string;
  certifications: string;
};

export type ResumeTailoringModelInput = {
  prompt: string;
  toolResults: ResumeToolResults;
};

export type ResumeTailoringModel = {
  write(input: ResumeTailoringModelInput): Promise<unknown>;
};

export type GroundingSkill = {
  id: string;
  name: string;
};

export type GroundingExperience = {
  id: string;
  employer: string;
  jobTitle: string;
  startDate: string;
  endDate: string | null;
  accomplishments: string[];
  technologies: string[];
};

export type GroundingProject = {
  id: string;
  name: string;
  description: string;
  url: string | null;
  startDate: string | null;
  endDate: string | null;
  accomplishments: string[];
  technologies: string[];
};

export type GroundingEducation = {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string | null;
};

export type GroundingCertification = {
  id: string;
  name: string;
  issuer: string;
  issuedOn: string;
  expiresOn: string | null;
};

export type GroundingProfile = {
  skills: GroundingSkill[];
  experience: GroundingExperience[];
  projects: GroundingProject[];
  education: GroundingEducation[];
  certifications: GroundingCertification[];
};

const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "from",
  "by",
  "with",
  "as",
  "into",
  "over",
  "after",
  "before",
  "during",
  "without",
  "within",
  "through",
  "than",
  "then",
  "that",
  "this",
  "these",
  "those",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "its",
  "their",
  "them",
  "they",
  "using",
]);

const ResumeState = Annotation.Root({
  analysis: Annotation<JobAnalysis>,
  search: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  skills: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  experience: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  projects: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  education: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  certifications: Annotation<string>({
    reducer: (_current, update) => update,
    default: () => "",
  }),
  resume: Annotation<TailoredResume | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

function labeledLine(label: string, items: string[]): string {
  if (items.length === 0) {
    return `${label}:`;
  }
  return `${label}: ${items.join(", ")}`;
}

function searchQuery(analysis: JobAnalysis): string {
  const joined = [
    labeledLine("Required skills", analysis.requiredSkills),
    labeledLine("Preferred skills", analysis.preferredSkills),
    labeledLine("Responsibilities", analysis.responsibilities),
    labeledLine("Experience requirements", analysis.experienceRequirements),
    labeledLine("Technologies", analysis.technologies),
    labeledLine("Interview topics", analysis.interviewTopics),
    labeledLine("Keywords", analysis.keywords),
  ].join("\n");
  const trimmed = joined.slice(0, 2000).trim();
  return trimmed.length === 0 ? "job" : trimmed;
}

function analysisJson(analysis: JobAnalysis): string {
  return JSON.stringify({
    requiredSkills: analysis.requiredSkills,
    preferredSkills: analysis.preferredSkills,
    responsibilities: analysis.responsibilities,
    experienceRequirements: analysis.experienceRequirements,
    technologies: analysis.technologies,
    interviewTopics: analysis.interviewTopics,
    keywords: analysis.keywords,
  });
}

function resumePrompt(analysis: JobAnalysis, toolResults: ResumeToolResults): string {
  return `Write one tailored resume for this job analysis. Use only the MCP tool results below. Do not add numeric metrics, technologies, employers, job titles, dates, or accomplishments that are absent from those results. Each item must cite the source profile record id from the tool results.

Copy nullable source fields exactly. When the source value is null, output JSON null. Never invent a substitute date, URL, placeholder, the string "Present", or the current date. "Present" is display text only and must not be stored or returned.
- experience endDate: if the source endDate is null, output null
- project url: if the source url is null, output null
- project startDate: if the source startDate is null, output null
- project endDate: if the source endDate is null, output null
- education endDate: if the source endDate is null, output null
- certification expiresOn: if the source expiresOn is null, output null

Job analysis:
${analysisJson(analysis)}

MCP tool results:
search_candidate_experience:
${toolResults.search}
get_skills:
${toolResults.skills}
get_experience:
${toolResults.experience}
get_projects:
${toolResults.projects}
get_education:
${toolResults.education}
get_certifications:
${toolResults.certifications}`;
}

function parseToolJson(text: string): void {
  JSON.parse(text);
}

export async function tailorResume(
  analysis: JobAnalysis,
  tools: ResumeToolClient,
  model: ResumeTailoringModel,
): Promise<TailoredResume> {
  const graph = new StateGraph(ResumeState)
    .addNode("retrieve", async (state) => {
      const search = await tools.callTool("search_candidate_experience", {
        query: searchQuery(state.analysis),
      });
      return { search };
    })
    .addNode("load_sections", async () => {
      const skills = await tools.callTool("get_skills", {});
      const experience = await tools.callTool("get_experience", {});
      const projects = await tools.callTool("get_projects", {});
      const education = await tools.callTool("get_education", {});
      const certifications = await tools.callTool("get_certifications", {});
      return { skills, experience, projects, education, certifications };
    })
    .addNode("draft", async (state) => {
      const toolResults: ResumeToolResults = {
        search: state.search,
        skills: state.skills,
        experience: state.experience,
        projects: state.projects,
        education: state.education,
        certifications: state.certifications,
      };
      const prompt = resumePrompt(state.analysis, toolResults);
      parseToolJson(toolResults.search);
      parseToolJson(toolResults.skills);
      parseToolJson(toolResults.experience);
      parseToolJson(toolResults.projects);
      parseToolJson(toolResults.education);
      parseToolJson(toolResults.certifications);
      const raw = await model.write({ prompt, toolResults });
      return { resume: tailoredResumeSchema.parse(raw) };
    })
    .addEdge(START, "retrieve")
    .addEdge("retrieve", "load_sections")
    .addEdge("load_sections", "draft")
    .addEdge("draft", END)
    .compile();

  const result = await graph.invoke({ analysis });
  if (result.resume === null) {
    throw new Error("Resume generation failed");
  }
  return result.resume;
}

function requireObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid tool result");
  }
  return value as Record<string, unknown>;
}

function requireSection(parsed: unknown, key: string): unknown[] {
  const record = requireObject(parsed);
  if (!(key in record) || !Array.isArray(record[key])) {
    throw new Error("Invalid tool result");
  }
  return record[key];
}

function requireString(record: Record<string, unknown>, key: string): string {
  if (!(key in record) || typeof record[key] !== "string") {
    throw new Error("Invalid tool result");
  }
  return record[key];
}

function requireNullableString(record: Record<string, unknown>, key: string): string | null {
  if (!(key in record)) {
    throw new Error("Invalid tool result");
  }
  const value = record[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Invalid tool result");
  }
  return value;
}

function requireStringArray(record: Record<string, unknown>, key: string): string[] {
  if (!(key in record) || !Array.isArray(record[key])) {
    throw new Error("Invalid tool result");
  }
  const values: string[] = [];
  for (const item of record[key]) {
    if (typeof item !== "string") {
      throw new Error("Invalid tool result");
    }
    values.push(item);
  }
  return values;
}

function copySkill(value: unknown): TailoredResume["skills"][number] {
  const record = requireObject(value);
  return {
    sourceId: requireString(record, "id"),
    name: requireString(record, "name"),
  };
}

function copyExperience(value: unknown): TailoredResume["experience"][number] {
  const record = requireObject(value);
  return {
    sourceId: requireString(record, "id"),
    employer: requireString(record, "employer"),
    jobTitle: requireString(record, "jobTitle"),
    startDate: requireString(record, "startDate"),
    endDate: requireNullableString(record, "endDate"),
    accomplishments: requireStringArray(record, "accomplishments"),
    technologies: requireStringArray(record, "technologies"),
  };
}

function copyProject(value: unknown): TailoredResume["projects"][number] {
  const record = requireObject(value);
  return {
    sourceId: requireString(record, "id"),
    name: requireString(record, "name"),
    description: requireString(record, "description"),
    url: requireNullableString(record, "url"),
    startDate: requireNullableString(record, "startDate"),
    endDate: requireNullableString(record, "endDate"),
    accomplishments: requireStringArray(record, "accomplishments"),
    technologies: requireStringArray(record, "technologies"),
  };
}

function copyEducation(value: unknown): TailoredResume["education"][number] {
  const record = requireObject(value);
  return {
    sourceId: requireString(record, "id"),
    institution: requireString(record, "institution"),
    degree: requireString(record, "degree"),
    fieldOfStudy: requireString(record, "fieldOfStudy"),
    startDate: requireString(record, "startDate"),
    endDate: requireNullableString(record, "endDate"),
  };
}

function copyCertification(value: unknown): TailoredResume["certifications"][number] {
  const record = requireObject(value);
  return {
    sourceId: requireString(record, "id"),
    name: requireString(record, "name"),
    issuer: requireString(record, "issuer"),
    issuedOn: requireString(record, "issuedOn"),
    expiresOn: requireNullableString(record, "expiresOn"),
  };
}

export function createStubResumeModel(): ResumeTailoringModel {
  return {
    async write(input) {
      const skills = requireSection(JSON.parse(input.toolResults.skills), "skills").map(copySkill);
      const experience = requireSection(JSON.parse(input.toolResults.experience), "experience").map(
        copyExperience,
      );
      const projects = requireSection(JSON.parse(input.toolResults.projects), "projects").map(copyProject);
      const education = requireSection(JSON.parse(input.toolResults.education), "education").map(
        copyEducation,
      );
      const certifications = requireSection(
        JSON.parse(input.toolResults.certifications),
        "certifications",
      ).map(copyCertification);
      JSON.parse(input.toolResults.search);
      return tailoredResumeSchema.parse({
        skills,
        experience,
        projects,
        education,
        certifications,
      });
    },
  };
}

export function createGeminiResumeModel(apiKey: string, modelName: string): ResumeTailoringModel {
  const chat = new ChatGoogleGenerativeAI({
    apiKey,
    model: modelName,
  });
  const structured = chat.withStructuredOutput(tailoredResumeStructuredSchema);
  return {
    async write(input) {
      return structured.invoke(input.prompt);
    },
  };
}

function contentTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0 && !FUNCTION_WORDS.has(token));
}

function addTokens(target: Set<string>, value: string): void {
  for (const token of contentTokens(value)) {
    target.add(token);
  }
}

function analysisTokenSet(analysis: JobAnalysis): Set<string> {
  const tokens = new Set<string>();
  const lists = [
    analysis.requiredSkills,
    analysis.preferredSkills,
    analysis.responsibilities,
    analysis.experienceRequirements,
    analysis.technologies,
    analysis.interviewTopics,
    analysis.keywords,
  ];
  for (const list of lists) {
    for (const item of list) {
      addTokens(tokens, item);
    }
  }
  return tokens;
}

function allowedTokens(base: Set<string>, values: Array<string | null>): Set<string> {
  const allowed = new Set(base);
  for (const value of values) {
    if (value !== null) {
      addTokens(allowed, value);
    }
  }
  return allowed;
}

function requireGrounded(condition: boolean): asserts condition {
  if (!condition) {
    throw new Error("Resume is not grounded");
  }
}

function requireRecord<T extends { id: string }>(rows: T[], sourceId: string): T {
  const found = rows.find((row) => row.id === sourceId);
  requireGrounded(found !== undefined);
  return found;
}

function requireRewritten(value: string, allowed: Set<string>): void {
  for (const token of contentTokens(value)) {
    requireGrounded(allowed.has(token));
  }
}

function requireTechnologies(cited: string[], recorded: string[]): void {
  for (const technology of cited) {
    requireGrounded(recorded.includes(technology));
  }
}

export function assertTailoredResumeGrounded(
  resume: TailoredResume,
  profile: GroundingProfile,
  analysis: JobAnalysis,
): void {
  const shared = analysisTokenSet(analysis);

  for (const item of resume.skills) {
    const record = requireRecord(profile.skills, item.sourceId);
    requireGrounded(item.name === record.name);
  }

  for (const item of resume.experience) {
    const record = requireRecord(profile.experience, item.sourceId);
    requireGrounded(item.employer === record.employer);
    requireGrounded(item.jobTitle === record.jobTitle);
    requireGrounded(item.startDate === record.startDate);
    requireGrounded(item.endDate === record.endDate);
    requireTechnologies(item.technologies, record.technologies);
    const allowed = allowedTokens(shared, [
      record.employer,
      record.jobTitle,
      record.startDate,
      record.endDate,
      ...record.accomplishments,
      ...record.technologies,
    ]);
    for (const accomplishment of item.accomplishments) {
      requireRewritten(accomplishment, allowed);
    }
  }

  for (const item of resume.projects) {
    const record = requireRecord(profile.projects, item.sourceId);
    requireGrounded(item.name === record.name);
    requireGrounded(item.url === record.url);
    requireGrounded(item.startDate === record.startDate);
    requireGrounded(item.endDate === record.endDate);
    requireTechnologies(item.technologies, record.technologies);
    const allowed = allowedTokens(shared, [
      record.name,
      record.description,
      record.url,
      record.startDate,
      record.endDate,
      ...record.accomplishments,
      ...record.technologies,
    ]);
    requireRewritten(item.description, allowed);
    for (const accomplishment of item.accomplishments) {
      requireRewritten(accomplishment, allowed);
    }
  }

  for (const item of resume.education) {
    const record = requireRecord(profile.education, item.sourceId);
    requireGrounded(item.institution === record.institution);
    requireGrounded(item.degree === record.degree);
    requireGrounded(item.fieldOfStudy === record.fieldOfStudy);
    requireGrounded(item.startDate === record.startDate);
    requireGrounded(item.endDate === record.endDate);
  }

  for (const item of resume.certifications) {
    const record = requireRecord(profile.certifications, item.sourceId);
    requireGrounded(item.name === record.name);
    requireGrounded(item.issuer === record.issuer);
    requireGrounded(item.issuedOn === record.issuedOn);
    requireGrounded(item.expiresOn === record.expiresOn);
  }
}
