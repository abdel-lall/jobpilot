export type JobErrorCode = "not_found" | "analysis_failed";

export class JobError extends Error {
  readonly code: JobErrorCode;

  constructor(code: JobErrorCode) {
    super(code);
    this.name = "JobError";
    this.code = code;
  }
}
