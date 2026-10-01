import { REFRESH_TOKEN_EXPIRES_IN_SECONDS } from "./tokens.js";

export const REFRESH_COOKIE_NAME = "refresh_token";

function secureAttribute(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

export function serializeRefreshCookie(token: string): string {
  return `${REFRESH_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${REFRESH_TOKEN_EXPIRES_IN_SECONDS}${secureAttribute()}`;
}

export function serializeClearedRefreshCookie(): string {
  return `${REFRESH_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureAttribute()}`;
}

export function readRefreshToken(cookieHeader: string | undefined): string | undefined {
  if (cookieHeader === undefined || cookieHeader.length === 0) {
    return undefined;
  }
  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === REFRESH_COOKIE_NAME) {
      const value = valueParts.join("=");
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}
