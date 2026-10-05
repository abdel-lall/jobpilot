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
  waiters: Array<() => void>;
};

function createGate(held: boolean): RequestGate {
  return { held, waiters: [] };
}

async function waitForGate(gate: RequestGate): Promise<void> {
  if (!gate.held) {
    return;
  }
  await new Promise<void>((resolve) => {
    gate.waiters.push(resolve);
  });
}

function openGate(gate: RequestGate): void {
  gate.held = false;
  const waiters = gate.waiters.splice(0);
  for (const resolve of waiters) {
    resolve();
  }
}

function uniqueEmail(): string {
  const email = `phase7-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
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

async function fillForm(page: Page, formName: string, email: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  await openAuthForm(page, formName);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
}

async function register(page: Page, email: string): Promise<void> {
  await fillForm(page, "Register", email);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
}

async function login(page: Page, email: string): Promise<void> {
  await fillForm(page, "Log in", email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();
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

test("uploads a resume after the empty list, then deletes it", async ({ page }) => {
  const listGate = createGate(true);
  await page.route(
    (url) => url.pathname === "/profile/resumes",
    async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await waitForGate(listGate);
      await route.continue();
    },
  );

  await page.goto("/");
  const email = uniqueEmail();
  await register(page, email);
  await login(page, email);

  const resumes = page.getByTestId("profile-resumes");
  await expect(resumes).toBeVisible();
  await expect(page.getByTestId("profile-resumes-loading")).toHaveText("Loading resumes…");
  await expect(page.getByTestId("profile-resumes-empty")).toHaveCount(0);

  openGate(listGate);
  await expect(page.getByTestId("profile-resumes-empty")).toHaveText("No resumes yet.");

  await resumes.locator('input[type="file"]').setInputFiles({
    name: "phase7-resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("phase7-resume-bytes"),
  });
  await resumes.getByRole("button", { name: "Upload resume", exact: true }).click();
  await expect(resumes).toContainText("phase7-resume.pdf");
  await expect(page.getByTestId("profile-resumes-empty")).toHaveCount(0);

  await resumes.getByRole("button", { name: "Delete resume", exact: true }).click();
  await expect(page.getByTestId("profile-resumes-empty")).toHaveText("No resumes yet.");
});
