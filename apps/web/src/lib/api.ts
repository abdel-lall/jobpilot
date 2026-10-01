const configuredOrigin = import.meta.env.VITE_API_ORIGIN;

export const API_ORIGIN =
  configuredOrigin === undefined || configuredOrigin === ""
    ? "http://localhost:3000"
    : configuredOrigin;

type AuthFetchInit = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
};

export async function authFetch(path: string, init: AuthFetchInit): Promise<Response> {
  const headers = new Headers();
  if (init.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (init.accessToken !== undefined) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }

  return fetch(`${API_ORIGIN}${path}`, {
    method: init.method,
    credentials: "include",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    return "Request failed";
  }
  return "Request failed";
}
