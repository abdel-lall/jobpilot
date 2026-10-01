export type JobErrorCode = "not_found";

export class JobError extends Error {
  readonly code: JobErrorCode;

  constructor(code: JobErrorCode) {
    super(code);
    this.name = "JobError";
    this.code = code;
  }
}
