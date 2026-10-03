export type ProfileErrorCode = "not_found" | "invalid_input" | "embedding_failed";

export class ProfileError extends Error {
  readonly code: ProfileErrorCode;

  constructor(code: ProfileErrorCode) {
    super(code);
    this.name = "ProfileError";
    this.code = code;
  }
}
