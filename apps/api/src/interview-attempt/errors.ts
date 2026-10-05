export type InterviewAttemptErrorCode =
  | "not_found"
  | "analysis_not_current"
  | "plan_not_current"
  | "already_in_progress"
  | "already_answered"
  | "already_completed"
  | "generation_failed"
  | "evaluation_failed";

export class InterviewAttemptError extends Error {
  readonly code: InterviewAttemptErrorCode;

  constructor(code: InterviewAttemptErrorCode) {
    super(code);
    this.name = "InterviewAttemptError";
    this.code = code;
  }
}
