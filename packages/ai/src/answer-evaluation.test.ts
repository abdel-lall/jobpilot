import { answerEvaluationModelOutputSchema } from "@jobpilot/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createStubAnswerEvaluationModel,
  evaluateAnswer,
  type AnswerEvaluationModel,
  type AnswerEvaluationModelInput,
} from "./index.js";

delete process.env.GEMINI_API_KEY;

const profileSentinel = "profile-sentinel-phase17";
const conceptSentinel = "expected-concept-sentinel";
const categorySentinel = "category-sentinel";
const fetchMock = vi.fn(() => Promise.reject(new Error("network")));

const questionText = "How would you index this table?";
const rubric = "Mention an index.";
const answer = "I would add an index.";
const prompt = `Evaluate this interview answer. Return feedback and an integer score from 0 through 100. Use only the question, the rubric, and the answer. Do not use a candidate profile.

Question: ${questionText}
Rubric: ${rubric}
Answer: ${answer}`;

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("answer evaluation", () => {
  it("returns stub feedback and score 80", async () => {
    expect(process.env.GEMINI_API_KEY).toBeUndefined();
    const result = await evaluateAnswer(
      questionText,
      rubric,
      answer,
      createStubAnswerEvaluationModel(),
    );
    expect(result).toEqual({ feedback: "stub-feedback", score: 80 });
  });

  it("returns score 0 for the fail sentinel", async () => {
    const result = await evaluateAnswer(
      questionText,
      rubric,
      "fail",
      createStubAnswerEvaluationModel(),
    );
    expect(result).toEqual({ feedback: "stub-feedback", score: 0 });
  });

  it("accepts scores 0, 80, and 100, and rejects -1, 101, and 1.5", () => {
    expect(answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: 0 }).success).toBe(
      true,
    );
    expect(answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: 80 }).success).toBe(
      true,
    );
    expect(
      answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: 100 }).success,
    ).toBe(true);
    expect(
      answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: -1 }).success,
    ).toBe(false);
    expect(
      answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: 101 }).success,
    ).toBe(false);
    expect(
      answerEvaluationModelOutputSchema.safeParse({ feedback: "ok", score: 1.5 }).success,
    ).toBe(false);
  });

  it("calls the model once with the question, rubric, answer, and prompt only", async () => {
    const recorded: AnswerEvaluationModelInput[] = [];
    const model: AnswerEvaluationModel = {
      async evaluate(input) {
        recorded.push(input);
        return { feedback: "recorded", score: 70 };
      },
    };

    const result = await evaluateAnswer(questionText, rubric, answer, model);

    expect(result).toEqual({ feedback: "recorded", score: 70 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toEqual({ questionText, rubric, answer, prompt });
    expect(Object.keys(recorded[0] ?? {})).toEqual(["questionText", "rubric", "answer", "prompt"]);
    expect(prompt.includes(questionText)).toBe(true);
    expect(prompt.includes(rubric)).toBe(true);
    expect(prompt.includes(answer)).toBe(true);
    expect(prompt.includes(profileSentinel)).toBe(false);
    expect(prompt.includes(conceptSentinel)).toBe(false);
    expect(prompt.includes(categorySentinel)).toBe(false);
    expect(JSON.stringify(recorded[0]).includes(profileSentinel)).toBe(false);
    expect(JSON.stringify(recorded[0]).includes(conceptSentinel)).toBe(false);
    expect(JSON.stringify(recorded[0]).includes(categorySentinel)).toBe(false);
  });

  it("rejects a score of 101 and an extra key", async () => {
    const high: AnswerEvaluationModel = {
      async evaluate() {
        return { feedback: "too high", score: 101 };
      },
    };
    const extra: AnswerEvaluationModel = {
      async evaluate() {
        return { feedback: "ok", score: 80, extra: true };
      },
    };

    await expect(evaluateAnswer(questionText, rubric, answer, high)).rejects.toThrow();
    await expect(evaluateAnswer(questionText, rubric, answer, extra)).rejects.toThrow();
  });
});
