import { jobAnalysisSchema } from "@jobpilot/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStubInterviewPlanModel,
  createStubJobAnalysisModel,
  planInterview,
  type InterviewPlanModel,
  type InterviewPlanModelInput,
} from "./index.js";

delete process.env.GEMINI_API_KEY;

const sentinel = "profile-sentinel";
const fetchMock = vi.fn(() => Promise.reject(new Error("network")));

const analysis = jobAnalysisSchema.parse({
  requiredSkills: ["TypeScript"],
  preferredSkills: [],
  responsibilities: ["Build APIs"],
  experienceRequirements: ["3 years"],
  technologies: ["Node.js"],
  interviewTopics: ["testing", "auth"],
  keywords: ["backend"],
});

const prompt = `Select the relevant interview categories for this job analysis, in relevance order. Choose only from: Data structures and algorithms, Frontend, Backend, System design, Machine learning, AI/LLM systems, Behavioral questions. Return categories only. Use only this analysis.

Required skills: TypeScript
Preferred skills:
Responsibilities: Build APIs
Experience requirements: 3 years
Technologies: Node.js
Interview topics: testing, auth
Keywords: backend`;

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("interview plan workflow", () => {
  it("returns stub categories and copies the phase 10 analysis topics", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const stubAnalysis = jobAnalysisSchema.parse(
      await createStubJobAnalysisModel().analyze({
        jobDescription: "Build APIs.",
        prompt: "unused",
      }),
    );

    const result = await planInterview(stubAnalysis, createStubInterviewPlanModel());

    expect(result.categories).toEqual(["Backend", "Behavioral questions"]);
    expect(result.interviewTopics).toEqual(["stub-topic-1", "stub-topic-2"]);
  });

  it("keeps model category order, copies topics, and sends only the analysis prompt", async () => {
    const recorded: InterviewPlanModelInput[] = [];
    const model: InterviewPlanModel = {
      async plan(input) {
        recorded.push(input);
        return { categories: ["Behavioral questions", "Backend"] };
      },
    };

    const result = await planInterview(analysis, model);

    expect(result.categories).toEqual(["Behavioral questions", "Backend"]);
    expect(result.interviewTopics).toEqual(analysis.interviewTopics);
    expect(recorded).toEqual([{ analysis, prompt }]);
    expect(Object.keys(recorded[0] ?? {})).toEqual(["analysis", "prompt"]);
    expect(JSON.stringify(analysis).includes(sentinel)).toBe(false);
    expect(prompt.includes(sentinel)).toBe(false);
    expect(prompt.includes("Preferred skills:")).toBe(true);
    expect(prompt.includes("Preferred skills: ")).toBe(false);
  });

  it("rejects unknown, duplicate, empty, and extra-key model results", async () => {
    const unknown: InterviewPlanModel = {
      async plan() {
        return { categories: ["Cooking"] };
      },
    };
    const duplicate: InterviewPlanModel = {
      async plan() {
        return { categories: ["Backend", "Backend"] };
      },
    };
    const empty: InterviewPlanModel = {
      async plan() {
        return { categories: [] };
      },
    };
    const withTopics: InterviewPlanModel = {
      async plan() {
        return { categories: ["Backend"], interviewTopics: ["testing"] };
      },
    };
    const extra: InterviewPlanModel = {
      async plan() {
        return { categories: ["Backend"], extra: true };
      },
    };

    await expect(planInterview(analysis, unknown)).rejects.toThrow();
    await expect(planInterview(analysis, duplicate)).rejects.toThrow();
    await expect(planInterview(analysis, empty)).rejects.toThrow();
    await expect(planInterview(analysis, withTopics)).rejects.toThrow();
    await expect(planInterview(analysis, extra)).rejects.toThrow();
  });
});
