import {
  interviewPlanSchema,
  normalizeQuestionText,
  type InterviewPlan,
  type InterviewPlanCategory,
} from "@jobpilot/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStubInterviewQuestionModel,
  generateInterviewQuestions,
  interviewQuestionCounts,
  type InterviewQuestionModel,
  type InterviewQuestionModelInput,
} from "./index.js";

delete process.env.GEMINI_API_KEY;

const sentinel = "profile-sentinel-phase16";
const fetchMock = vi.fn(() => Promise.reject(new Error("network")));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

function planOf(categories: readonly string[], interviewTopics: string[]): InterviewPlan {
  return {
    categories,
    interviewTopics,
  } as unknown as InterviewPlan;
}

function modelQuestions(
  count: number,
  textAt: (index: number) => string,
): { questions: unknown[] } {
  return {
    questions: Array.from({ length: count }, (_, index) => ({
      text: textAt(index),
      category: "Frontend",
      expectedConcepts: ["concept"],
      rubric: "rubric",
    })),
  };
}

describe("interview question counts", () => {
  it("splits 8 questions as evenly as possible with extras on earlier categories", () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    expect(interviewQuestionCounts(["A", "B", "C"] as unknown as InterviewPlanCategory[])).toEqual([
      3, 3, 2,
    ]);
    expect(interviewQuestionCounts(["A"] as unknown as InterviewPlanCategory[])).toEqual([8]);
    expect(interviewQuestionCounts(["A", "B"] as unknown as InterviewPlanCategory[])).toEqual([
      4, 4,
    ]);
  });
});

describe("interview question workflow", () => {
  it("calls the model with assigned counts only after those counts are fixed and stores the TypeScript category", async () => {
    const plan = planOf(["A", "B", "C"], ["queues"]);
    const counts = interviewQuestionCounts(plan.categories);
    const calls: InterviewQuestionModelInput[] = [];
    const model: InterviewQuestionModel = {
      async generate(input) {
        calls.push(input);
        return modelQuestions(input.count, (index) => `${input.category} question ${index + 1}`);
      },
    };

    const result = await generateInterviewQuestions(plan, [], model);

    expect(counts).toEqual([3, 3, 2]);
    expect(calls.map((call) => [call.category, call.count])).toEqual([
      ["A", 3],
      ["B", 3],
      ["C", 2],
    ]);
    expect(calls[0]?.count).toBe(counts[0]);
    expect(result.map((question) => question.category)).toEqual(["A", "A", "A", "B", "B", "B", "C", "C"]);
    expect(result.every((question) => question.expectedConcepts[0] === "concept")).toBe(true);
  });

  it("asks a one-category plan for 8 questions once", async () => {
    const plan = planOf(["Backend"], ["testing"]);
    const calls: InterviewQuestionModelInput[] = [];
    const model: InterviewQuestionModel = {
      async generate(input) {
        calls.push(input);
        return modelQuestions(input.count, (index) => `Only question ${index + 1}`);
      },
    };

    const result = await generateInterviewQuestions(plan, [], model);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.category).toBe("Backend");
    expect(calls[0]?.count).toBe(8);
    expect(result).toHaveLength(8);
    expect(result.every((question) => question.category === "Backend")).toBe(true);
    expect(calls[0]?.prompt.endsWith("Questions to avoid: (none)")).toBe(true);
  });

  it("rejects after 3 rounds when every text matches a stored question", async () => {
    const plan = planOf(["Backend"], ["testing"]);
    const calls: InterviewQuestionModelInput[] = [];
    const model: InterviewQuestionModel = {
      async generate(input) {
        calls.push(input);
        return modelQuestions(8, () => "  hello   world ");
      },
    };

    await expect(generateInterviewQuestions(plan, ["Hello World"], model)).rejects.toThrow();
    expect(calls).toHaveLength(3);
    expect(calls.every((call) => call.category === "Backend" && call.count === 8)).toBe(true);
  });

  it("requests only the missing count on the next round and does not start a third", async () => {
    const plan = planOf(["Backend"], ["testing"]);
    const calls: InterviewQuestionModelInput[] = [];
    const model: InterviewQuestionModel = {
      async generate(input) {
        calls.push(input);
        if (calls.length === 1) {
          return modelQuestions(8, (index) => (index === 0 ? "  hello   world " : `Unique ${index}`));
        }
        return modelQuestions(input.count, () => "Unique last");
      },
    };

    const result = await generateInterviewQuestions(plan, ["Hello World"], model);

    expect(calls.map((call) => call.count)).toEqual([8, 1]);
    expect(result).toHaveLength(8);
    expect(result.some((question) => question.text.toLowerCase().includes("hello"))).toBe(false);
    expect(result.every((question) => question.category === "Backend")).toBe(true);
  });

  it("sends the plan prompt and excludes a profile sentinel", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const plan = interviewPlanSchema.parse({
      categories: ["Backend"],
      interviewTopics: ["testing"],
    });
    const calls: InterviewQuestionModelInput[] = [];
    const model: InterviewQuestionModel = {
      async generate(input) {
        calls.push(input);
        return modelQuestions(input.count, (index) => `Prompt question ${index + 1}`);
      },
    };

    await generateInterviewQuestions(plan, ["Ask about queues"], model);

    const input = calls[0];
    expect(input).toBeDefined();
    if (input === undefined) {
      return;
    }
    expect(Object.keys(input)).toEqual(["category", "count", "plan", "avoidedQuestionTexts", "prompt"]);
    expect(input.prompt).toBe(
      [
        "Write interview questions for one category. Return only questions for the requested category and count. Use only this plan and the questions to avoid. Do not use a candidate profile.",
        "",
        "Category: Backend",
        "Count: 8",
        "Plan categories: Backend",
        "Interview topics: testing",
        "Questions to avoid:",
        "- Ask about queues",
      ].join("\n"),
    );
    expect(JSON.stringify(input).includes(sentinel)).toBe(false);
    expect(input.plan).toEqual(plan);
    expect(input.avoidedQuestionTexts).toEqual(["Ask about queues"]);
  });

  it("stores stub questions under the phase 15 plan categories", async () => {
    const plan = interviewPlanSchema.parse({
      categories: ["Backend", "Behavioral questions"],
      interviewTopics: ["stub-topic-1", "stub-topic-2"],
    });

    const result = await generateInterviewQuestions(plan, [], createStubInterviewQuestionModel());

    expect(result.map((question) => question.text)).toEqual([
      "Stub Backend question 1",
      "Stub Backend question 2",
      "Stub Backend question 3",
      "Stub Backend question 4",
      "Stub Behavioral questions question 1",
      "Stub Behavioral questions question 2",
      "Stub Behavioral questions question 3",
      "Stub Behavioral questions question 4",
    ]);
    expect(result.map((question) => question.category)).toEqual([
      "Backend",
      "Backend",
      "Backend",
      "Backend",
      "Behavioral questions",
      "Behavioral questions",
      "Behavioral questions",
      "Behavioral questions",
    ]);
    expect(result.every((question) => question.expectedConcepts[0] === "stub-concept")).toBe(true);
    expect(result.every((question) => question.rubric === "stub-rubric")).toBe(true);
  });

  it("returns eight new stub texts when the phase 16 texts are already stored", async () => {
    const plan = interviewPlanSchema.parse({
      categories: ["Backend", "Behavioral questions"],
      interviewTopics: ["stub-topic-1", "stub-topic-2"],
    });
    const stored = [
      "Stub Backend question 1",
      "Stub Backend question 2",
      "Stub Backend question 3",
      "Stub Backend question 4",
      "Stub Behavioral questions question 1",
      "Stub Behavioral questions question 2",
      "Stub Behavioral questions question 3",
      "Stub Behavioral questions question 4",
    ];

    const result = await generateInterviewQuestions(
      plan,
      stored,
      createStubInterviewQuestionModel(),
    );

    expect(result).toHaveLength(8);
    const storedNormalized = new Set(stored.map((text) => normalizeQuestionText(text)));
    expect(
      result.every((question) => !storedNormalized.has(normalizeQuestionText(question.text))),
    ).toBe(true);
    expect(result.map((question) => question.text)).toEqual([
      "Stub Backend question 1 retake 2",
      "Stub Backend question 2 retake 2",
      "Stub Backend question 3 retake 2",
      "Stub Backend question 4 retake 2",
      "Stub Behavioral questions question 1 retake 2",
      "Stub Behavioral questions question 2 retake 2",
      "Stub Behavioral questions question 3 retake 2",
      "Stub Behavioral questions question 4 retake 2",
    ]);
  });
});
