import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  publicUserSchema,
  type LoginBody,
  type PublicUser,
  type RegisterBody,
} from "@jobpilot/shared";
import { authFetch, readErrorMessage } from "@/lib/api";

export type AuthStatus = "loading" | "signed-out" | "signed-in";

type SessionState = {
  status: AuthStatus;
  user: PublicUser | null;
  accessToken: string | null;
  notice: string | null;
  error: string | null;
};

type SessionContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  notice: string | null;
  error: string | null;
  register: (input: RegisterBody) => Promise<void>;
  login: (input: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
};

type RestoreResult =
  | { status: "signed-in"; user: PublicUser; accessToken: string }
  | { status: "signed-out" };

const SessionContext = createContext<SessionContextValue | null>(null);

const signedOutState: SessionState = {
  status: "signed-out",
  user: null,
  accessToken: null,
  notice: null,
  error: null,
};

function readAccessToken(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("accessToken" in body)) {
    return null;
  }
  const accessToken = body.accessToken;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return null;
  }
  return accessToken;
}

async function readMe(accessToken: string): Promise<PublicUser> {
  const response = await authFetch("/auth/me", {
    method: "GET",
    accessToken,
  });
  if (!response.ok) {
    throw new Error("Request failed");
  }
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("user" in body)) {
    throw new Error("Request failed");
  }
  return publicUserSchema.parse(body.user);
}

async function restoreSessionOnce(): Promise<RestoreResult> {
  try {
    const response = await authFetch("/auth/refresh", { method: "POST" });
    if (!response.ok) {
      return { status: "signed-out" };
    }
    const accessToken = readAccessToken(await response.json());
    if (accessToken === null) {
      return { status: "signed-out" };
    }
    const user = await readMe(accessToken);
    return { status: "signed-in", user, accessToken };
  } catch {
    return { status: "signed-out" };
  }
}

let restoreInFlight: Promise<RestoreResult> | null = null;

function restoreSession(): Promise<RestoreResult> {
  restoreInFlight ??= restoreSessionOnce();
  return restoreInFlight;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({
    status: "loading",
    user: null,
    accessToken: null,
    notice: null,
    error: null,
  });

  useEffect(() => {
    let active = true;
    void restoreSession().then((result) => {
      if (!active) {
        return;
      }
      if (result.status === "signed-in") {
        setSession({
          status: "signed-in",
          user: result.user,
          accessToken: result.accessToken,
          notice: null,
          error: null,
        });
        return;
      }
      setSession(signedOutState);
    });
    return () => {
      active = false;
    };
  }, []);

  const register = useCallback(async (input: RegisterBody) => {
    setSession((current) => ({
      ...current,
      error: null,
      notice: null,
    }));
    try {
      const response = await authFetch("/auth/register", {
        method: "POST",
        body: input,
      });
      if (response.status === 201) {
        setSession({
          ...signedOutState,
          notice: "Account created. You can log in.",
        });
        return;
      }
      const message = await readErrorMessage(response);
      setSession({
        ...signedOutState,
        error: message,
      });
    } catch {
      setSession({
        ...signedOutState,
        error: "Request failed",
      });
    }
  }, []);

  const login = useCallback(async (input: LoginBody) => {
    setSession((current) => ({
      ...current,
      error: null,
    }));
    try {
      const response = await authFetch("/auth/login", {
        method: "POST",
        body: input,
      });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        setSession({
          ...signedOutState,
          error: message,
        });
        return;
      }
      const accessToken = readAccessToken(await response.json());
      if (accessToken === null) {
        setSession({
          ...signedOutState,
          error: "Request failed",
        });
        return;
      }
      const user = await readMe(accessToken);
      setSession({
        status: "signed-in",
        user,
        accessToken,
        notice: null,
        error: null,
      });
    } catch {
      setSession({
        ...signedOutState,
        error: "Request failed",
      });
    }
  }, []);

  const logout = useCallback(async () => {
    setSession(signedOutState);
    try {
      const response = await authFetch("/auth/logout", { method: "POST" });
      if (!response.ok) {
        const message = await readErrorMessage(response);
        setSession({
          ...signedOutState,
          error: message,
        });
      }
    } catch {
      setSession({
        ...signedOutState,
        error: "Request failed",
      });
    }
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      status: session.status,
      user: session.user,
      notice: session.notice,
      error: session.error,
      register,
      login,
      logout,
    }),
    [session, register, login, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
