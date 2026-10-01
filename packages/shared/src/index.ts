export const packageName = "@jobpilot/shared" as const;

export {
  loginBodySchema,
  publicUserSchema,
  refreshSessionSchema,
  registerBodySchema,
  type LoginBody,
  type PublicUser,
  type RefreshSessionRecord,
  type RegisterBody,
} from "./auth.js";

