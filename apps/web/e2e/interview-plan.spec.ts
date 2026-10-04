import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const createdEmails: string[] = [];
const password = "password1";

function uniqueEmail(): string {
  const email = `phase15-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isInterviewPlan(url: URL): boolean {
  return /^\/jobs\/[^/]+\/interview-plan$/.test(url.pathname);
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

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: {
      "access-control-allow-origin": "http://localhost:5173",
      "access-control-allow-credentials": "true",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function fillAuth(page: Page, formName: string, email: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
}

async function registerAndLogin(page: Page): Promise<void> {
  const email = uniqueEmail();
  await page.goto("/");
  await fillAuth(page, "Register", email);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
  await fillAuth(page, "Log in", email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();
}

async function createExampleJob(page: Page): Promise<Locator> {
  await page.getByTestId("nav-dashboard").click();
  const form = page.getByRole("form", { name: "Add job" });
  await form.getByLabel("Company name").fill("Example Co");
  await form.getByLabel("Job title").fill("Engineer");
  await form.getByLabel("Job description").fill("Build APIs.");
  await form.getByLabel("Job location").fill("Remote");
  await form.getByLabel("Job URL").fill("https://example.com/jobs/engineer");
  await form.getByRole("button", { name: "Add job", exact: true }).click();
  const row = page.getByTestId("job-row");
  await expect(row.getByTestId("job-company")).toHaveText("Example Co");
  await expect(row.getByTestId("job-title")).toHaveText("Engineer");
  await expect(row.getByTestId("job-description")).toHaveText("Build APIs.");
  await expect(row.getByTestId("job-location")).toHaveText("Remote");
  await expect(row.getByTestId("job-url")).toHaveText("https://example.com/jobs/engineer");
  return row;
}

async function generatePlan(page: Page): Promise<void> {
  const requestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && isInterviewPlan(new URL(request.url())),
  );
  await expect(page.getByTestId("generate-interview-plan")).toBeEnabled();
  await page.getByTestId("generate-interview-plan").click();
  const raw = (await requestPromise).postData();
  expect(JSON.parse(raw ?? "null")).toEqual({});
}

async function expectStubPlan(panel: Locator): Promise<void> {
  await expect(panel.getByTestId("plan-category")).toHaveText([
    "Backend",
    "Behavioral questions",
  ]);
  await expect(panel.getByTestId("plan-topic")).toHaveText(["stub-topic-1", "stub-topic-2"]);
  await expect(panel.getByTestId("interview-plan-empty")).toHaveCount(0);
}

async function stubGenerateFailure(page: Page): Promise<void> {
  await page.route(isInterviewPlan, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 502, { error: "Interview plan generation failed" });
  });
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

test("generates, replaces, and clears an interview plan", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await expect(row.getByTestId("job-analysis")).toHaveText("Current");
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(row.getByTestId("job-score")).toHaveText("Not available");
  await expect(row.getByTestId("job-readiness")).toHaveText("Not available");

  await row.getByTestId("open-interview-plan").click();
  const panel = page.getByTestId("interview-plan-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await expect(panel.getByTestId("plan-category")).toHaveCount(0);
  await expect(row.getByTestId("open-interview-plan")).toHaveCount(0);
  await expect(row.getByTestId("open-tailored-resume")).toBeVisible();

  await generatePlan(page);
  await expectStubPlan(panel);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");
  await expect(panel).toBeVisible();

  await generatePlan(page);
  await expectStubPlan(panel);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");
  await expect(panel).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByTestId("dashboard")).toHaveCount(0);
  await expect(page.getByTestId("interview-plan-panel")).toHaveCount(0);
  await page.getByTestId("nav-dashboard").click();
  await row.getByTestId("open-interview-plan").click();
  await expectStubPlan(panel);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");

  await row.getByRole("button", { name: "Edit job", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit job" });
  await edit.getByLabel("Job description").fill("Build reliable APIs.");
  await edit.getByRole("button", { name: "Save job", exact: true }).click();
  await expect(row.getByTestId("job-description")).toHaveText("Build reliable APIs.");
  await expect(row.getByTestId("job-analysis")).toHaveText("Current");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(panel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await expect(panel.getByText("Backend", { exact: true })).toHaveCount(0);

  await generatePlan(page);
  await expectStubPlan(panel);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");
  await expect(panel).toBeVisible();
});

test("shows the generate error when no plan exists", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await row.getByTestId("open-interview-plan").click();
  const panel = page.getByTestId("interview-plan-panel");
  await expect(panel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await stubGenerateFailure(page);
  await generatePlan(page);
  await expect(panel.getByText("Interview plan generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await expect(panel.getByTestId("plan-category")).toHaveCount(0);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
});

test("keeps the current plan when generate fails", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await row.getByTestId("open-interview-plan").click();
  const panel = page.getByTestId("interview-plan-panel");
  await expect(panel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await generatePlan(page);
  await expect(panel.getByTestId("plan-category").filter({ hasText: "Backend" })).toBeVisible();
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");

  await stubGenerateFailure(page);
  await generatePlan(page);
  await expect(panel.getByText("Interview plan generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("plan-category").filter({ hasText: "Backend" })).toBeVisible();
  await expect(panel.getByTestId("interview-plan-empty")).toHaveCount(0);
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");
  await expect(panel).toBeVisible();
});
