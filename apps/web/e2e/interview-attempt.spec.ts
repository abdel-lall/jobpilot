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
  const email = `phase16-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isInterviewPlan(url: URL): boolean {
  return /^\/jobs\/[^/]+\/interview-plan$/.test(url.pathname);
}

function isInterviewAttemptStart(url: URL): boolean {
  return /^\/jobs\/[^/]+\/interview-attempts$/.test(url.pathname);
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

test("starts an attempt and lists 8 stub questions", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await expect(row.getByTestId("job-analysis")).toHaveText("Current");
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(row.getByTestId("job-score")).toHaveText("Not available");
  await expect(row.getByTestId("job-readiness")).toHaveText("Not available");

  await row.getByTestId("open-interview-plan").click();
  const planPanel = page.getByTestId("interview-plan-panel");
  await expect(planPanel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await generatePlan(page);
  await expect(planPanel.getByTestId("plan-category").filter({ hasText: "Backend" })).toBeVisible();
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");

  await row.getByTestId("open-interview-attempt").click();
  await expect(planPanel).toHaveCount(0);
  const panel = page.getByTestId("interview-attempt-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveText("No interview attempt yet.");
  await expect(panel.getByTestId("interview-question")).toHaveCount(0);
  await expect(row.getByTestId("open-interview-attempt")).toHaveCount(0);

  const requestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && isInterviewAttemptStart(new URL(request.url())),
  );
  await panel.getByTestId("start-interview-attempt").click();
  const raw = (await requestPromise).postData();
  expect(JSON.parse(raw ?? "null")).toEqual({});

  const questions = panel.getByTestId("interview-question");
  await expect(questions).toHaveCount(8);
  for (let index = 0; index < 4; index += 1) {
    const question = questions.nth(index);
    await expect(question.getByTestId("interview-question-category")).toHaveText("Backend");
    await expect(question.getByTestId("interview-question-text")).toHaveText(
      `Stub Backend question ${index + 1}`,
    );
    await expect(question.getByTestId("interview-question-concept")).toHaveText("stub-concept");
    await expect(question.getByTestId("interview-question-rubric")).toHaveText("stub-rubric");
  }
  for (let index = 0; index < 4; index += 1) {
    const question = questions.nth(index + 4);
    await expect(question.getByTestId("interview-question-category")).toHaveText(
      "Behavioral questions",
    );
    await expect(question.getByTestId("interview-question-text")).toHaveText(
      `Stub Behavioral questions question ${index + 1}`,
    );
    await expect(question.getByTestId("interview-question-concept")).toHaveText("stub-concept");
    await expect(question.getByTestId("interview-question-rubric")).toHaveText("stub-rubric");
  }
  await expect(panel.locator("textarea")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
  await expect(panel.getByTestId("start-interview-attempt")).toHaveCount(0);
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveCount(0);
  await expect(row.getByTestId("job-score")).toHaveText("Not available");
  await expect(row.getByTestId("job-readiness")).toHaveText("Not available");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Present");
  await expect(panel).toBeVisible();
});

test("shows the start error when no attempt exists", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await row.getByTestId("open-interview-attempt").click();
  const panel = page.getByTestId("interview-attempt-panel");
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveText("No interview attempt yet.");
  await page.route(isInterviewAttemptStart, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 502, { error: "Interview question generation failed" });
  });
  await panel.getByTestId("start-interview-attempt").click();
  await expect(panel.getByText("Interview question generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveText("No interview attempt yet.");
  await expect(panel.getByTestId("interview-question")).toHaveCount(0);
});
