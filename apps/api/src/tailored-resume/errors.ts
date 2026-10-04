export type TailoredResumeErrorCode = "not_found" | "analysis_not_current" | "generation_failed";

export class TailoredResumeError extends Error {
  readonly code: TailoredResumeErrorCode;

  constructor(code: TailoredResumeErrorCode) {
    super(code);
    this.name = "TailoredResumeError";
    this.code = code;
  }
}
