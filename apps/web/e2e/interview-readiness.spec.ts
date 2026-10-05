import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { expect, test, type Locator, type Page } from "@playwright/test";
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
  const email = `phase18-${randomUUID()}@example.com`;
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

async function fillAuth(page: Page, formName: string, email: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  await openAuthForm(page, formName);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
}

async function registerAndLogin(page: Page): Promise<string> {
  const email = uniqueEmail();
  await page.goto("/");
  await fillAuth(page, "Register", email);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
  await fillAuth(page, "Log in", email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();
  return email;
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

async function reopenAttempt(page: Page, row: Locator): Promise<void> {
  const loaded = page.waitForResponse((response) => {
    return (
      response.request().method() === "GET" &&
      /\/jobs\/[^/]+\/interview-attempts\/current$/.test(new URL(response.url()).pathname)
    );
  });
  await row.getByTestId("open-interview-attempt").click();
  await loaded;
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

async function answerAll(panel: Locator, answer: string): Promise<string[]> {
  const texts: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const question = panel.getByTestId("interview-question").nth(index);
    texts.push(await question.getByTestId("interview-question-text").innerText());
    await question.getByTestId("interview-question-answer-input").fill(answer);
    await question.getByTestId("interview-question-submit").click();
    await expect(question.getByTestId("interview-question-score")).toBeVisible();
  }
  return texts;
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

test("shows 80 and Interview Ready, keeps them during a retake, then shows 0 after a failing retake", async ({
  page,
}) => {
  const email = await registerAndLogin(page);
  const row = await createExampleJob(page);
  const panel = await startAttempt(page, row);
  const firstTexts = await answerAll(panel, "I would add an index.");

  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("interview-question-answer-input")).toHaveCount(0);
  await expect(panel.getByTestId("start-interview-attempt")).toBeVisible();
  const ready = await openDetails(page, row);
  await expect(ready.getByTestId("job-score")).toHaveText("80");
  await expect(ready.getByTestId("job-readiness")).toHaveText("Interview Ready");

  await reopenAttempt(page, row);
  await expect(panel.getByTestId("start-interview-attempt")).toBeVisible();
  await panel.getByTestId("start-interview-attempt").click();
  await expect(panel.getByTestId("interview-question")).toHaveCount(8);
  await expect(panel.getByTestId("interview-question-answer-input")).toHaveCount(8);
  await expect(panel.getByTestId("start-interview-attempt")).toHaveCount(0);
  const retakeTexts: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    retakeTexts.push(
      await panel.getByTestId("interview-question").nth(index).getByTestId("interview-question-text").innerText(),
    );
  }
  expect(retakeTexts.every((text) => !firstTexts.includes(text))).toBe(true);
  const duringRetake = await openDetails(page, row);
  await expect(duringRetake.getByTestId("job-score")).toHaveText("80");
  await expect(duringRetake.getByTestId("job-readiness")).toHaveText("Interview Ready");

  await reopenAttempt(page, row);
  await answerAll(panel, "fail");
  await expect(panel).toBeVisible();
  const failed = await openDetails(page, row);
  await expect(failed.getByTestId("job-score")).toHaveText("0");
  await expect(failed.getByTestId("job-readiness")).toHaveText("Not available");

  const user = await prisma.user.findUnique({ where: { email } });
  if (user === null) {
    throw new Error("missing user");
  }
  const attempts = await prisma.interviewAttempt.findMany({
    where: { job: { userId: user.id } },
    orderBy: { createdAt: "asc" },
    include: { questions: true },
  });
  expect(attempts).toHaveLength(2);
  expect(attempts[0]?.questions.map((question) => question.score).sort()).toEqual([
    80, 80, 80, 80, 80, 80, 80, 80,
  ]);
});
