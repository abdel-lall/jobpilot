import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
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

function uniqueEmail(): string {
  const email = `phase17-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isInterviewPlan(url: URL): boolean {
  return /^\/jobs\/[^/]+\/interview-plan$/.test(url.pathname);
}

function isInterviewAnswer(url: URL): boolean {
  return /^\/jobs\/[^/]+\/interview-attempts\/current\/questions\/[^/]+\/answer$/.test(url.pathname);
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
  await openAuthForm(page, formName);
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

async function openDetails(page: Page, row: Locator): Promise<Locator> {
  await row.getByTestId("open-job-details").click();
  const details = page.getByTestId("job-details");
  await expect(details).toBeVisible();
  return details;
}

async function createExampleJob(page: Page): Promise<Locator> {
  await page.getByTestId("nav-dashboard").click();
  await page.getByTestId("open-add-job").click();
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
  await expect(row.getByTestId("job-location")).toHaveText("Remote");
  await expect(form).toBeVisible();
  const details = await openDetails(page, row);
  await expect(details.getByTestId("job-description")).toHaveText("Build APIs.");
  await expect(details.getByTestId("job-url")).toHaveText("https://example.com/jobs/engineer");
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

async function startAttempt(page: Page, row: Locator): Promise<Locator> {
  await row.getByTestId("open-interview-plan").click();
  const planPanel = page.getByTestId("interview-plan-panel");
  await expect(planPanel.getByTestId("interview-plan-empty")).toHaveText("No interview plan yet.");
  await generatePlan(page);
  await expect(planPanel.getByTestId("plan-category").filter({ hasText: "Backend" })).toBeVisible();
  await row.getByTestId("open-interview-attempt").click();
  const panel = page.getByTestId("interview-attempt-panel");
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveText("No interview attempt yet.");
  await panel.getByTestId("start-interview-attempt").click();
  await expect(panel.getByTestId("interview-question")).toHaveCount(8);
  return panel;
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

test("submits one answer and shows feedback and the score on that question only", async ({
  page,
}) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  const panel = await startAttempt(page, row);
  const questions = panel.getByTestId("interview-question");
  const first = questions.first();
  await first.getByTestId("interview-question-answer-input").fill("I would add an index.");

  const requestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && isInterviewAnswer(new URL(request.url())),
  );
  await first.getByTestId("interview-question-submit").click();
  const raw = (await requestPromise).postData();
  expect(JSON.parse(raw ?? "null")).toEqual({ answer: "I would add an index." });

  await expect(panel).toBeVisible();
  await expect(first.getByTestId("interview-question-answer")).toHaveText("I would add an index.");
  await expect(first.getByTestId("interview-question-feedback")).toHaveText("stub-feedback");
  await expect(first.getByTestId("interview-question-score")).toHaveText("80");
  await expect(first.getByTestId("interview-question-answer-input")).toHaveCount(0);
  await expect(first.getByRole("button", { name: "Submit answer" })).toHaveCount(0);
  await expect(panel.getByTestId("interview-attempt-empty")).toHaveCount(0);
  await expect(panel.getByTestId("start-interview-attempt")).toHaveCount(0);

  for (let index = 1; index < 8; index += 1) {
    const question = questions.nth(index);
    await expect(question.getByTestId("interview-question-answer-input")).toBeVisible();
    await expect(question.getByRole("button", { name: "Submit answer" })).toBeVisible();
    await expect(question.getByTestId("interview-question-feedback")).toHaveCount(0);
  }

  const details = await openDetails(page, row);
  await expect(details.getByTestId("job-score")).toHaveText("Not available");
  await expect(details.getByTestId("job-readiness")).toHaveText("Not available");
});

test("shows the evaluation error and keeps the answer box", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  const panel = await startAttempt(page, row);
  await page.route(isInterviewAnswer, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 502, { error: "Answer evaluation failed" });
  });
  const first = panel.getByTestId("interview-question").first();
  await first.getByTestId("interview-question-answer-input").fill("I would add an index.");
  await first.getByTestId("interview-question-submit").click();
  await expect(panel.getByText("Answer evaluation failed", { exact: true })).toBeVisible();
  await expect(first.getByTestId("interview-question-answer-input")).toHaveValue(
    "I would add an index.",
  );
  await expect(first.getByTestId("interview-question-feedback")).toHaveCount(0);
  await expect(first.getByTestId("interview-question-score")).toHaveCount(0);
  await expect(panel.getByText("stub-feedback", { exact: true })).toHaveCount(0);
  await expect(panel.getByText("80", { exact: true })).toHaveCount(0);
});
