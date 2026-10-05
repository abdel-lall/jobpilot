import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@jobpilot/database";
import { expect, test, type Locator, type Page, type Request, type Route } from "@playwright/test";
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

const profileHeadings = [
  "Profile",
  "Work Experience",
  "Skills",
  "Certifications",
  "Education",
  "Projects",
  "Resumes",
] as const;

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
  const email = `phase9-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isJobsCollection(url: URL): boolean {
  return url.pathname === "/jobs";
}

function readJobUrl(request: Request): unknown {
  const raw = request.postData();
  if (raw === null) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || !("jobUrl" in parsed)) {
    return undefined;
  }
  return parsed.jobUrl;
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

async function register(page: Page, email: string): Promise<void> {
  await fillAuth(page, "Register", email);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
}

async function login(page: Page, email: string): Promise<void> {
  await fillAuth(page, "Log in", email);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();
}

async function expectProfileView(page: Page): Promise<void> {
  await expect(page.getByTestId("dashboard")).toHaveCount(0);
  await expect(page.getByTestId("jobs-loading")).toHaveCount(0);
  await expect(page.getByTestId("jobs-empty")).toHaveCount(0);
  for (const [index, heading] of profileHeadings.entries()) {
    await expect(page.getByRole("heading").nth(index)).toHaveText(heading);
  }
  await expect(page.getByTestId("profile-resumes")).toBeVisible();
}

async function expectStatuses(page: Page): Promise<void> {
  await expect(page.getByTestId("job-analysis")).toHaveText("Current");
  await expect(page.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(page.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(page.getByTestId("job-score")).toHaveText("Not available");
  await expect(page.getByTestId("job-readiness")).toHaveText("Not available");
}

async function fillAddJob(
  page: Page,
  values: {
    company: string;
    title: string;
    description: string;
    location: string;
    url: string;
  },
): Promise<Locator> {
  const form = page.getByRole("form", { name: "Add job" });
  await form.getByLabel("Company name").fill(values.company);
  await form.getByLabel("Job title").fill(values.title);
  await form.getByLabel("Job description").fill(values.description);
  await form.getByLabel("Job location").fill(values.location);
  await form.getByLabel("Job URL").fill(values.url);
  return form;
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

test("creates, reloads, edits, clears the URL, and deletes a job", async ({ page }) => {
  let jobsGets = 0;
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() === "GET") {
      jobsGets += 1;
    }
    await route.continue();
  });

  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("app-nav")).toHaveCount(0);
  await register(page, email);
  await login(page, email);
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(page.getByTestId("nav-profile")).toHaveText("Profile");
  await expect(page.getByTestId("nav-dashboard")).toHaveText("Dashboard");
  await expectProfileView(page);

  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  const skillForm = page.getByRole("form", { name: "Add skill" });
  await skillForm.getByLabel("Name").fill("TypeScript");
  await skillForm.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText("TypeScript", { exact: true })).toBeVisible();
  expect(jobsGets).toBe(0);

  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("dashboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-skills")).toHaveCount(0);
  await expect(page.getByTestId("profile-resumes")).toHaveCount(0);
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");

  const form = await fillAddJob(page, {
    company: "Example Co",
    title: "Engineer",
    description: "Build APIs.",
    location: "Remote",
    url: "https://example.com/jobs/engineer",
  });
  await form.getByRole("button", { name: "Add job", exact: true }).click();

  const row = page.getByTestId("job-row");
  await expect(row.getByTestId("job-company")).toHaveText("Example Co");
  await expect(row.getByTestId("job-title")).toHaveText("Engineer");
  await expect(row.getByTestId("job-location")).toHaveText("Remote");
  await expect(row.getByTestId("job-description")).toHaveText("Build APIs.");
  await expect(row.getByTestId("job-url")).toHaveText("https://example.com/jobs/engineer");
  await expectStatuses(page);
  await expect(page.getByTestId("jobs-empty")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Add job" })).toBeVisible();

  await page.getByTestId("nav-profile").click();
  await expectProfileView(page);

  await page.reload();
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expectProfileView(page);

  await page.getByTestId("nav-dashboard").click();
  await expect(row.getByTestId("job-company")).toHaveText("Example Co");
  await expect(row.getByTestId("job-title")).toHaveText("Engineer");
  await expectStatuses(page);

  await page.getByRole("button", { name: "Edit job", exact: true }).click();
  const editTitle = page.getByRole("form", { name: "Edit job" });
  await editTitle.getByLabel("Job title").fill("Senior Engineer");
  await editTitle.getByRole("button", { name: "Save job", exact: true }).click();
  await expect(row.getByTestId("job-title")).toHaveText("Senior Engineer");
  await expect(row.getByTestId("job-company")).toHaveText("Example Co");
  await expectStatuses(page);

  await page.getByRole("button", { name: "Edit job", exact: true }).click();
  const editDescription = page.getByRole("form", { name: "Edit job" });
  await editDescription.getByLabel("Job description").fill("Build reliable APIs.");
  await editDescription.getByRole("button", { name: "Save job", exact: true }).click();
  await expect(row.getByTestId("job-description")).toHaveText("Build reliable APIs.");
  await expect(row.getByTestId("job-title")).toHaveText("Senior Engineer");
  await expectStatuses(page);

  const clearRequest = page.waitForRequest(
    (request) => request.method() === "PATCH" && request.url().includes("/jobs/"),
  );
  await page.getByRole("button", { name: "Edit job", exact: true }).click();
  const editUrl = page.getByRole("form", { name: "Edit job" });
  await editUrl.getByLabel("Job URL").fill("");
  await editUrl.getByRole("button", { name: "Save job", exact: true }).click();
  expect(readJobUrl(await clearRequest)).toBeNull();
  await expect(row.getByTestId("job-url")).toHaveCount(0);
  await expect(row.getByTestId("job-title")).toHaveText("Senior Engineer");

  await page.getByRole("button", { name: "Delete job", exact: true }).click();
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");
  await expect(page.getByTestId("job-row")).toHaveCount(0);
});

test("shows loading until the first jobs list succeeds", async ({ page }) => {
  const gate = createGate(true);
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await waitForGate(gate);
    await route.continue();
  });

  const email = uniqueEmail();
  await page.goto("/");
  await register(page, email);
  await login(page, email);
  await expectProfileView(page);

  const jobsResponse = page.waitForResponse(
    (response) => isJobsCollection(new URL(response.url())) && response.request().method() === "GET",
  );
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-loading")).toHaveText("Loading jobs…");
  await expect(page.getByText("No jobs yet.", { exact: true })).toHaveCount(0);

  openGate(gate);
  const response = await jobsResponse;
  expect(response.status()).toBe(200);
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");
  await expect(page.getByTestId("jobs-loading")).toHaveCount(0);
});

test("shows the jobs list error and hides the empty state", async ({ page }) => {
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 400, { error: "Invalid input" });
  });

  const email = uniqueEmail();
  await page.goto("/");
  await register(page, email);
  await login(page, email);
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("dashboard").getByRole("alert")).toHaveText("Invalid input");
  await expect(page.getByText("No jobs yet.", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("job-row")).toHaveCount(0);
});

test("rejects an empty company name before sending a request", async ({ page }) => {
  let jobPosts = 0;
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() === "POST") {
      jobPosts += 1;
    }
    await route.continue();
  });

  const email = uniqueEmail();
  await page.goto("/");
  await register(page, email);
  await login(page, email);
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");

  const form = await fillAddJob(page, {
    company: "",
    title: "Engineer",
    description: "Build APIs.",
    location: "Remote",
    url: "https://example.com/jobs/engineer",
  });
  await form.getByRole("button", { name: "Add job", exact: true }).click();
  await expect(form.locator("[data-slot='form-message']")).toBeVisible();
  expect(jobPosts).toBe(0);
});

test("rejects a job URL that is not absolute http or https", async ({ page }) => {
  let jobPosts = 0;
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() === "POST") {
      jobPosts += 1;
    }
    await route.continue();
  });

  const email = uniqueEmail();
  await page.goto("/");
  await register(page, email);
  await login(page, email);
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");

  const form = await fillAddJob(page, {
    company: "Example Co",
    title: "Engineer",
    description: "Build APIs.",
    location: "Remote",
    url: "not-a-url",
  });
  await form.getByRole("button", { name: "Add job", exact: true }).click();
  await expect(form.locator("[data-slot='form-message']")).toBeVisible();
  expect(jobPosts).toBe(0);
});

test("shows the API error when creating a job fails", async ({ page }) => {
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 400, { error: "Invalid input" });
  });

  const email = uniqueEmail();
  await page.goto("/");
  await register(page, email);
  await login(page, email);
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");

  const form = await fillAddJob(page, {
    company: "Example Co",
    title: "Engineer",
    description: "Build APIs.",
    location: "Remote",
    url: "https://example.com/jobs/engineer",
  });
  await form.getByRole("button", { name: "Add job", exact: true }).click();
  await expect(page.getByTestId("dashboard").getByRole("alert")).toHaveText("Invalid input");
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");
});

test("does not reuse another user's cached jobs", async ({ page }) => {
  const emailA = uniqueEmail();
  const emailB = uniqueEmail();
  await page.goto("/");
  await register(page, emailA);
  await register(page, emailB);
  await login(page, emailA);
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");

  const form = await fillAddJob(page, {
    company: "Alpha Co",
    title: "Engineer",
    description: "Build APIs.",
    location: "Remote",
    url: "https://example.com/jobs/engineer",
  });
  await form.getByRole("button", { name: "Add job", exact: true }).click();
  await expect(page.getByTestId("job-company")).toHaveText("Alpha Co");

  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expect(page.getByTestId("app-nav")).toHaveCount(0);
  await expect(page.getByTestId("dashboard")).toHaveCount(0);
  await expect(page.getByTestId("profile-skills")).toHaveCount(0);

  const gate = createGate(true);
  await page.route(isJobsCollection, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await waitForGate(gate);
    await route.continue();
  });

  await login(page, emailB);
  await expectProfileView(page);

  const jobsResponse = page.waitForResponse(
    (response) => isJobsCollection(new URL(response.url())) && response.request().method() === "GET",
  );
  await page.getByTestId("nav-dashboard").click();
  await expect(page.getByTestId("jobs-loading")).toHaveText("Loading jobs…");
  await expect(page.getByTestId("jobs-empty")).toHaveCount(0);
  await expect(page.getByText("Alpha Co", { exact: true })).toHaveCount(0);

  openGate(gate);
  const response = await jobsResponse;
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toEqual({ jobs: [] });
  await expect(page.getByTestId("jobs-empty")).toHaveText("No jobs yet.");
  await expect(page.getByText("Alpha Co", { exact: true })).toHaveCount(0);
});
