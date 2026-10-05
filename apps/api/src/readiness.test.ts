import { describe, expect, it } from "vitest";
import { assessInterviewReadiness, type ScoredInterviewQuestion } from "./interview-attempt/readiness.js";

function scored(category: string, scores: readonly number[]): ScoredInterviewQuestion[] {
  return scores.map((score) => ({ score, category }));
}

describe("assessInterviewReadiness", () => {
  it("passes eight Backend scores of 80 and ignores untested categories", () => {
    expect(assessInterviewReadiness(scored("Backend", [80, 80, 80, 80, 80, 80, 80, 80]))).toEqual({
      overallScore: 80,
      passed: true,
    });
  });

  it("passes eight Backend scores of 100", () => {
    expect(assessInterviewReadiness(scored("Backend", [100, 100, 100, 100, 100, 100, 100, 100]))).toEqual({
      overallScore: 100,
      passed: true,
    });
  });

  it("fails eight Backend scores of 0", () => {
    expect(assessInterviewReadiness(scored("Backend", [0, 0, 0, 0, 0, 0, 0, 0]))).toEqual({
      overallScore: 0,
      passed: false,
    });
  });

  it("does not round 79.875 up to a pass", () => {
    expect(assessInterviewReadiness(scored("Backend", [80, 80, 80, 80, 80, 80, 80, 79]))).toEqual({
      overallScore: 79.875,
      passed: false,
    });
  });

  it("passes when both tested categories meet 70 and the overall score is 80", () => {
    expect(
      assessInterviewReadiness([
        ...scored("Frontend", [70, 70, 70, 70]),
        ...scored("Backend", [90, 90, 90, 90]),
      ]),
    ).toEqual({
      overallScore: 80,
      passed: true,
    });
  });

  it("fails when the overall score is 79.5", () => {
    expect(
      assessInterviewReadiness([
        ...scored("Frontend", [70, 70, 70, 70]),
        ...scored("Backend", [89, 89, 89, 89]),
      ]),
    ).toEqual({
      overallScore: 79.5,
      passed: false,
    });
  });

  it("fails when a tested category is below 70 even if the overall score is 80", () => {
    expect(
      assessInterviewReadiness([
        ...scored("Frontend", [69, 69, 69, 69]),
        ...scored("Backend", [91, 91, 91, 91]),
      ]),
    ).toEqual({
      overallScore: 80,
      passed: false,
    });
  });

  it("fails when two Frontend scores are below 70", () => {
    expect(
      assessInterviewReadiness([
        ...scored("Backend", [100, 100, 100, 100, 100, 100]),
        ...scored("Frontend", [69, 69]),
      ]),
    ).toEqual({
      overallScore: 92.25,
      passed: false,
    });
  });

  it("throws unless there are 8 integer scores from 0 through 100", () => {
    expect(() => assessInterviewReadiness(scored("Backend", [80, 80, 80, 80, 80, 80, 80]))).toThrow(
      /8 questions/,
    );
    expect(() => assessInterviewReadiness(scored("Backend", [80, 80, 80, 80, 80, 80, 80, 1.5]))).toThrow(
      /integer score/,
    );
  });
});
