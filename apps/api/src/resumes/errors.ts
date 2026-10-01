export type ResumeErrorCode = "not_found" | "invalid_input" | "internal";

export class ResumeError extends Error {
  readonly code: ResumeErrorCode;

  constructor(code: ResumeErrorCode) {
    super(code);
    this.name = "ResumeError";
    this.code = code;
  }
}
