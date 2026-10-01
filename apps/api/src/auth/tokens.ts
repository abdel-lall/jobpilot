import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { AuthError } from "./errors.js";

export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900;
export const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 604800;

function readJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret === undefined || secret.trim().length === 0) {
    throw new Error("JWT_SECRET is required");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRES_IN_SECONDS}s`)
    .sign(readJwtSecret());
}

export async function verifyAccessToken(token: string): Promise<string> {
  const secret = readJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.sub === undefined || payload.sub.length === 0) {
      throw new AuthError("unauthorized");
    }
    return payload.sub;
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError("unauthorized");
  }
}

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const [scheme, token, ...rest] = authorization.split(" ");
  if (scheme !== "Bearer" || token === undefined || token.length === 0 || rest.length > 0) {
    return undefined;
  }
  return token;
}
