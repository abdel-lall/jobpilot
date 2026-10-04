export type InterviewPlanErrorCode = "not_found" | "analysis_not_current" | "generation_failed";

export class InterviewPlanError extends Error {
  readonly code: InterviewPlanErrorCode;

  constructor(code: InterviewPlanErrorCode) {
    super(code);
    this.name = "InterviewPlanError";
    this.code = code;
  }
}
