import { jobAnalysisSchema } from "@jobpilot/shared";
import { describe, expect, it } from "vitest";
import {
  analyzeJobDescription,
  createStubJobAnalysisModel,
  type JobAnalysisModel,
  type JobAnalysisModelInput,
} from "./job-analysis.js";

delete process.env.GEMINI_API_KEY;

const description = "Build APIs.";
const prompt = `Analyze this job description. Return required skills, preferred skills, responsibilities, experience requirements, technologies, interview topics in relevance order, and keywords. Use only this description.

Job description:
${description}`;

describe("job analysis workflow", () => {
  it("returns the stub document and records only the description prompt", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const recorded: JobAnalysisModelInput[] = [];
    const stub = createStubJobAnalysisModel();
    const model: JobAnalysisModel = {
      async analyze(input) {
        recorded.push(input);
        return stub.analyze(input);
      },
    };

    const result = await analyzeJobDescription(description, model);

    expect(jobAnalysisSchema.parse(result)).toEqual(result);
    expect(result).toEqual({
      requiredSkills: ["stub-required"],
      preferredSkills: ["stub-preferred"],
      responsibilities: ["stub-responsibility"],
      experienceRequirements: ["stub-experience"],
      technologies: ["stub-technology"],
      interviewTopics: ["stub-topic-1", "stub-topic-2"],
      keywords: ["Build APIs."],
    });
    expect(recorded).toEqual([{ jobDescription: description, prompt }]);
    expect(recorded[0]?.prompt.includes("Secret Employer")).toBe(false);
    expect(recorded[0]?.prompt.includes("Secret Skill")).toBe(false);
    expect(recorded[0]?.jobDescription.includes("Secret Employer")).toBe(false);
    expect(recorded[0]?.jobDescription.includes("Secret Skill")).toBe(false);
  });

  it("rejects an extra key and an empty item", async () => {
    const extra: JobAnalysisModel = {
      async analyze() {
        return { extra: true };
      },
    };
    await expect(analyzeJobDescription(description, extra)).rejects.toThrow();

    const emptyItem: JobAnalysisModel = {
      async analyze() {
        return {
          requiredSkills: [""],
          preferredSkills: [],
          responsibilities: [],
          experienceRequirements: [],
          technologies: [],
          interviewTopics: [],
          keywords: [],
        };
      },
    };
    await expect(analyzeJobDescription(description, emptyItem)).rejects.toThrow();
  });
});
