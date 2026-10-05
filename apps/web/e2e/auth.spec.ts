import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { expect, test, type Page } from "@playwright/test";
import { openAuthForm } from "./open-auth-form";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const createdEmails: string[] = [];
const password = "password1";

type RequestGate = {
  held: boolean;
  releaseCurrent: (() => void) | null;
};

function createGate(held: boolean): RequestGate {
  return { held, releaseCurrent: null };
}

async function waitForGate(gate: RequestGate): Promise<void> {
  if (!gate.held) {
    return;
  }
  await new Promise<void>((resolve) => {
    gate.releaseCurrent = resolve;
  });
}

function openGate(gate: RequestGate): void {
  gate.held = false;
  const releaseCurrent = gate.releaseCurrent;
  gate.releaseCurrent = null;
  releaseCurrent?.();
}

function uniqueEmail(): string {
  const email = `phase4-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readAccessToken(body: unknown): string {
  if (!isRecord(body) || typeof body.accessToken !== "string" || body.accessToken.length === 0) {
    throw new Error("missing access token");
  }
  return body.accessToken;
}

function readUserEmail(body: unknown): string {
  if (!isRecord(body) || !isRecord(body.user) || typeof body.user.email !== "string") {
    throw new Error("missing user email");
  }
  return body.user.email;
}

async function waitForOk(url: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Compose is still starting.
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }
  throw new Error(`${url} did not become ready`);
}

test.beforeAll(async () => {
  await waitForOk("http://localhost:3000/health");
  await waitForOk("http://localhost:5173");
});

test.afterAll(async () => {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: createdEmails,
      },
    },
  });
  await prisma.$disconnect();
});

async function fillForm(page: Page, formName: string, email: string, formPassword: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  await openAuthForm(page, formName);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(formPassword);
}

test("registers, restores the session, and logs out", async ({ page }) => {
  const email = uniqueEmail();
  const consoleText: string[] = [];
  const meAuthorizations: string[] = [];
  page.on("console", (message) => {
    consoleText.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().endsWith("/auth/me")) {
      meAuthorizations.push(request.headers().authorization ?? "");
    }
  });

  const refreshGate = createGate(true);
  await page.route("**/auth/refresh", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await waitForGate(refreshGate);
    await route.continue();
  });

  const refreshResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/refresh") && response.request().method() === "POST",
  );
  await page.goto("/");
  await expect(page.getByTestId("auth-loading")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await expect(page.getByLabel("Password")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Log in", exact: true })).toHaveCount(0);

  openGate(refreshGate);
  const refreshResponse = await refreshResponsePromise;
  expect(refreshResponse.url()).toBe("http://localhost:3000/auth/refresh");
  expect(refreshResponse.status()).toBe(401);
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("auth-loading")).toHaveCount(0);

  await fillForm(page, "Register", email, password);
  const registerResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const registerResponse = await registerResponsePromise;
  expect(registerResponse.url()).toBe("http://localhost:3000/auth/register");
  expect(registerResponse.status()).toBe(201);
  await expect(page.getByTestId("register-confirmation")).toHaveText("Account created. You can log in.");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveCount(0);
  const cookiesAfterRegister = await page.context().cookies();
  expect(cookiesAfterRegister.some((cookie) => cookie.name === "refresh_token")).toBe(false);

  await page.route("**/auth/login", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.user)) {
      throw new Error("login response is missing a user");
    }
    body.user.email = "not-used@example.com";
    await route.fulfill({
      response,
      json: body,
    });
  });

  const meGate = createGate(true);
  await page.route("**/auth/me", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await waitForGate(meGate);
    await route.continue();
  });

  await fillForm(page, "Log in", email, password);
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.url()).toBe("http://localhost:3000/auth/login");
  expect(loginResponse.status()).toBe(200);
  const loginBody: unknown = await loginResponse.json();
  expect(readUserEmail(loginBody)).toBe("not-used@example.com");
  const loginAccessToken = readAccessToken(loginBody);
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
  await expect(page.getByText("not-used@example.com")).toHaveCount(0);

  const meResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/me") && response.request().method() === "GET",
  );
  openGate(meGate);
  const meResponse = await meResponsePromise;
  expect(meResponse.url()).toBe("http://localhost:3000/auth/me");
  expect(meResponse.status()).toBe(200);
  const meBody: unknown = await meResponse.json();
  const meEmail = readUserEmail(meBody);
  expect(meEmail).toBe(email);
  expect(meAuthorizations[0]).toBe(`Bearer ${loginAccessToken}`);
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveCount(0);
  await expect(page.getByRole("img", { name: "JobPilot" })).toBeVisible();
  await expect(page.getByTestId("nav-profile")).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("not-used@example.com")).toHaveCount(0);

  const visibleCookies = await page.evaluate(() => document.cookie);
  expect(visibleCookies).not.toContain("refresh_token");
  const stored = await page.evaluate((token) => {
    const values: string[] = [];
    for (const store of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < store.length; index += 1) {
        const key = store.key(index);
        if (key !== null) {
          values.push(key, store.getItem(key) ?? "");
        }
      }
    }
    return {
      count: window.localStorage.length + window.sessionStorage.length,
      leaked: values.some((value) => value.includes(token)) || document.cookie.includes(token),
    };
  }, loginAccessToken);
  expect(stored.count).toBe(0);
  expect(stored.leaked).toBe(false);

  const jar = await page.context().cookies();
  const refreshCookie = jar.find((cookie) => cookie.name === "refresh_token");
  expect(refreshCookie).toBeDefined();
  expect(refreshCookie?.httpOnly).toBe(true);
  expect(refreshCookie?.sameSite).toBe("Lax");

  refreshGate.held = true;
  const reloadRefreshPromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/refresh") && response.request().method() === "POST",
  );
  await page.reload();
  await expect(page.getByTestId("auth-loading")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  openGate(refreshGate);
  const reloadRefresh = await reloadRefreshPromise;
  expect(reloadRefresh.status()).toBe(200);
  const reloadAccessToken = readAccessToken(await reloadRefresh.json());
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByTestId("nav-profile")).toHaveAttribute("aria-current", "page");
  expect(meAuthorizations.at(-1)).toBe(`Bearer ${reloadAccessToken}`);

  const logoutResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/logout") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.url()).toBe("http://localhost:3000/auth/logout");
  expect(logoutResponse.status()).toBe(204);
  await expect(page.getByTestId("signed-out")).toBeVisible();

  const signedOutRefreshPromise = page.waitForResponse(
    (response) => response.url().endsWith("/auth/refresh") && response.request().method() === "POST",
  );
  await page.reload();
  const signedOutRefresh = await signedOutRefreshPromise;
  expect(signedOutRefresh.status()).toBe(401);
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("user-email")).toHaveCount(0);
  expect(consoleText.some((line) => line.includes(password))).toBe(false);
});

test("stays signed out when logout fails", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await fillForm(page, "Register", email, password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
  await fillForm(page, "Log in", email, password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();

  const logoutSignals: {
    markArrived: (() => void) | null;
    finish: (() => void) | null;
  } = {
    markArrived: null,
    finish: null,
  };
  const arrived = new Promise<void>((resolve) => {
    logoutSignals.markArrived = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    logoutSignals.finish = resolve;
  });
  await page.route("**/auth/logout", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    logoutSignals.markArrived?.();
    await gate;
    await route.abort();
  });

  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
  await arrived;
  logoutSignals.finish?.();
  await expect(page.getByRole("alert")).toHaveText("Request failed");
  await expect(page.getByTestId("signed-out")).toBeVisible();
});

test("shows API errors for duplicate email and wrong password", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await fillForm(page, "Register", email, password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();

  await fillForm(page, "Register", email, password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Email already registered");
  await expect(page.getByTestId("signed-out")).toBeVisible();

  await fillForm(page, "Log in", email, "password2");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await expect(page.getByTestId("signed-in")).toHaveCount(0);
});

test("rejects invalid register input in the form", async ({ page }) => {
  let registerPosts = 0;
  await page.route("**/auth/register", async (route) => {
    if (route.request().method() === "POST") {
      registerPosts += 1;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await fillForm(page, "Register", "not-an-email", "short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const form = page.getByRole("form", { name: "Register" });
  await expect(form.locator("[data-slot='form-message']")).toHaveCount(2);
  expect(registerPosts).toBe(0);
  await expect(page.getByTestId("signed-out")).toBeVisible();
});
