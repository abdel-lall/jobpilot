import { refreshSessionSchema, type PublicUser } from "@jobpilot/shared";
import { getPrisma } from "../db.js";
import { AuthError } from "./errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  REFRESH_TOKEN_EXPIRES_IN_SECONDS,
  createRefreshToken,
  hashRefreshToken,
  readBearerToken,
  signAccessToken,
  verifyAccessToken,
} from "./tokens.js";

export type ReplacementSessionData = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

export type CreatedRefreshSession = {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type ReplacementSessionWriter = {
  refreshSession: {
    create(args: { data: ReplacementSessionData }): Promise<CreatedRefreshSession>;
  };
};

export type CreateReplacementSession = (
  tx: ReplacementSessionWriter,
  data: ReplacementSessionData,
) => Promise<CreatedRefreshSession>;

export type AuthServiceOptions = {
  createReplacementSession?: CreateReplacementSession;
};

export async function defaultCreateReplacementSession(
  tx: ReplacementSessionWriter,
  data: ReplacementSessionData,
): Promise<CreatedRefreshSession> {
  return tx.refreshSession.create({ data });
}

type ActiveSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

function assertRefreshSessionShape(session: {
  id: string;
  userId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}): void {
  refreshSessionSchema.parse({
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt.toISOString(),
    revokedAt: session.revokedAt === null ? null : session.revokedAt.toISOString(),
  });
}

async function findActiveSession(rawToken: string | undefined): Promise<ActiveSession> {
  if (rawToken === undefined || rawToken.length === 0) {
    throw new AuthError("unauthorized");
  }
  const session = await getPrisma().refreshSession.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
  });
  if (
    session === null ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw new AuthError("unauthorized");
  }
  assertRefreshSessionShape(session);
  return session;
}

export async function registerUser(input: { email: string; password: string }): Promise<PublicUser> {
  try {
    return await getPrisma().user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthError("email_taken");
    }
    throw error;
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; user: PublicUser }> {
  const user = await getPrisma().user.findUnique({ where: { email: input.email } });
  if (user === null || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new AuthError("invalid_credentials");
  }

  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);
  const session = await getPrisma().refreshSession.create({
    data: {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    },
  });
  assertRefreshSessionShape(session);

  return {
    accessToken: await signAccessToken(user.id),
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    user: { id: user.id, email: user.email },
  };
}

export async function refreshUserSession(
  rawToken: string | undefined,
  createReplacementSession: CreateReplacementSession,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const current = await findActiveSession(rawToken);
  const refreshToken = createRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN_SECONDS * 1000);
  const replacement = await getPrisma().$transaction(async (tx) => {
    await tx.refreshSession.update({
      where: { id: current.id },
      data: { revokedAt: new Date() },
    });
    return createReplacementSession(tx as unknown as ReplacementSessionWriter, {
      userId: current.userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt,
    });
  });
  assertRefreshSessionShape(replacement);

  return {
    accessToken: await signAccessToken(current.userId),
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
  };
}

export async function logoutUser(rawToken: string | undefined): Promise<void> {
  const current = await findActiveSession(rawToken);
  await getPrisma().refreshSession.update({
    where: { id: current.id },
    data: { revokedAt: new Date() },
  });
}

export async function getAuthenticatedUser(
  authorization: string | undefined,
): Promise<PublicUser> {
  const token = readBearerToken(authorization);
  if (token === undefined) {
    throw new AuthError("unauthorized");
  }
  const userId = await verifyAccessToken(token);
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (user === null) {
    throw new AuthError("unauthorized");
  }
  return user;
}

export function createAuthService(options?: AuthServiceOptions) {
  const createReplacementSession =
    options?.createReplacementSession ?? defaultCreateReplacementSession;

  return {
    register: registerUser,
    login: loginUser,
    logout: logoutUser,
    getAuthenticatedUser,
    refresh(rawToken: string | undefined) {
      return refreshUserSession(rawToken, createReplacementSession);
    },
  };
}
