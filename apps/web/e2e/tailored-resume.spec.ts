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
  const email = `phase14-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function isTailoredResume(url: URL): boolean {
  return /^\/jobs\/[^/]+\/tailored-resume$/.test(url.pathname);
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

async function addSkill(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  const form = page.getByRole("form", { name: "Add skill" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText(name, { exact: true })).toBeVisible();
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

async function generateResume(page: Page): Promise<void> {
  const requestPromise = page.waitForRequest(
    (request) => request.method() === "POST" && isTailoredResume(new URL(request.url())),
  );
  await expect(page.getByTestId("generate-tailored-resume")).toBeEnabled();
  await page.getByTestId("generate-tailored-resume").click();
  const raw = (await requestPromise).postData();
  expect(JSON.parse(raw ?? "null")).toEqual({});
}

async function stubGenerateFailure(page: Page): Promise<void> {
  await page.route(isTailoredResume, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 502, { error: "Resume generation failed" });
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

test("generates, replaces, and clears a tailored resume", async ({ page }) => {
  await registerAndLogin(page);
  await addSkill(page, "TypeScript");
  const row = await createExampleJob(page);
  await expect(row.getByTestId("job-analysis")).toHaveText("Current");
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(row.getByTestId("job-score")).toHaveText("Not available");
  await expect(row.getByTestId("job-readiness")).toHaveText("Not available");

  await row.getByTestId("open-tailored-resume").click();
  const panel = page.getByTestId("tailored-resume-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await expect(panel.getByTestId("resume-skill")).toHaveCount(0);
  await expect(row.getByTestId("open-tailored-resume")).toHaveCount(0);

  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveCount(0);
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Present");
  await expect(panel).toBeVisible();

  await page.getByTestId("nav-profile").click();
  await addSkill(page, "Go");
  await page.getByTestId("nav-dashboard").click();
  await page.getByTestId("open-tailored-resume").click();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toHaveCount(0);

  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toBeVisible();
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Present");
  await expect(panel).toBeVisible();

  await row.getByRole("button", { name: "Edit job", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit job" });
  await edit.getByLabel("Job description").fill("Build reliable APIs.");
  await edit.getByRole("button", { name: "Save job", exact: true }).click();
  await expect(row.getByTestId("job-description")).toHaveText("Build reliable APIs.");
  await expect(row.getByTestId("job-analysis")).toHaveText("Current");
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toHaveCount(0);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toHaveCount(0);

  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toBeVisible();
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Present");
  await expect(row.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(row.getByTestId("job-score")).toHaveText("Not available");
  await expect(row.getByTestId("job-readiness")).toHaveText("Not available");
  await expect(panel).toBeVisible();
});

test("hides source ids and shows resume facts", async ({ page }) => {
  const sourceIds = {
    skill: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    experience: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    project: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    education: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    certification: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  };
  const resume = {
    skills: [{ sourceId: sourceIds.skill, name: "TypeScript" }],
    experience: [
      {
        sourceId: sourceIds.experience,
        employer: "Northstar Technologies",
        jobTitle: "Software Engineer",
        startDate: "2023-01-01",
        endDate: null,
        accomplishments: ["Built APIs"],
        technologies: ["TypeScript"],
      },
    ],
    projects: [
      {
        sourceId: sourceIds.project,
        name: "SupportAI",
        description: "Grounded assistant",
        url: "https://example.com/support",
        startDate: "2025-02-06",
        endDate: null,
        accomplishments: ["Built retrieval"],
        technologies: ["Python"],
      },
    ],
    education: [
      {
        sourceId: sourceIds.education,
        institution: "Lakeview University",
        degree: "Bachelor of Science",
        fieldOfStudy: "Computer Science",
        startDate: "2023-02-08",
        endDate: "2026-09-01",
      },
    ],
    certifications: [
      {
        sourceId: sourceIds.certification,
        name: "AWS Certified Cloud Practitioner",
        issuer: "Amazon Web Services",
        issuedOn: "2025-06-05",
        expiresOn: null,
      },
    ],
  };

  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await page.route(isTailoredResume, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 200, { resume });
  });
  await row.getByTestId("open-tailored-resume").click();
  const panel = page.getByTestId("tailored-resume-panel");

  await expect(panel.getByTestId("resume-skill")).toHaveText("TypeScript");
  await expect(panel.getByTestId("resume-experience")).toHaveText(
    "Northstar Technologies Software Engineer 2023-01-01 Built APIs TypeScript",
  );
  await expect(panel.getByTestId("resume-project")).toHaveText(
    "SupportAI Grounded assistant https://example.com/support 2025-02-06 Built retrieval Python",
  );
  await expect(panel.getByTestId("resume-education")).toHaveText(
    "Lakeview University Bachelor of Science Computer Science 2023-02-08 2026-09-01",
  );
  await expect(panel.getByTestId("resume-certification")).toHaveText(
    "AWS Certified Cloud Practitioner Amazon Web Services 2025-06-05",
  );

  const text = await panel.innerText();
  for (const sourceId of Object.values(sourceIds)) {
    expect(text.includes(sourceId)).toBe(false);
  }
});

test("shows the generate error when no resume exists", async ({ page }) => {
  await registerAndLogin(page);
  const row = await createExampleJob(page);
  await row.getByTestId("open-tailored-resume").click();
  const panel = page.getByTestId("tailored-resume-panel");
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await stubGenerateFailure(page);
  await generateResume(page);
  await expect(panel.getByText("Resume generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await expect(panel.getByTestId("resume-skill")).toHaveCount(0);
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Not available");
});

test("keeps the current resume when generate fails", async ({ page }) => {
  await registerAndLogin(page);
  await addSkill(page, "TypeScript");
  const row = await createExampleJob(page);
  await row.getByTestId("open-tailored-resume").click();
  const panel = page.getByTestId("tailored-resume-panel");
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Present");

  await stubGenerateFailure(page);
  await generateResume(page);
  await expect(panel.getByText("Resume generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveCount(0);
  await expect(row.getByTestId("job-tailored-resume")).toHaveText("Present");
  await expect(panel).toBeVisible();
});
