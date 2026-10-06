import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
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

async function addSkill(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  const form = page.getByRole("form", { name: "Add skill" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText(name, { exact: true })).toBeVisible();
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
  const email = await registerAndLogin(page);
  await addSkill(page, "TypeScript");
  const row = await createExampleJob(page);
  const details = page.getByTestId("job-details");
  await expect(details.getByTestId("job-analysis")).toHaveText("Current");
  await expect(details.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await expect(details.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(details.getByTestId("job-score")).toHaveText("Not available");
  await expect(details.getByTestId("job-readiness")).toHaveText("Not available");

  await row.getByTestId("open-tailored-resume").click();
  const panel = page.getByTestId("tailored-resume-panel");
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("active-work").getByTestId("tailored-resume-panel")).toHaveCount(1);
  await expect(panel.getByTestId("close-tailored-resume")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Close", exact: true })).toHaveCount(1);
  await expect(page.getByTestId("interview-plan-panel")).toHaveCount(0);
  await expect(page.getByTestId("interview-attempt-panel")).toHaveCount(0);
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await expect(panel.getByTestId("resume-skill")).toHaveCount(0);
  await expect(panel.getByTestId("resume-document")).toHaveCount(0);
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Needs regeneration");
  await expect(panel.getByRole("img", { name: "Resume needs regeneration" })).toBeVisible();
  await expect(panel.getByTestId("download-tailored-resume")).toHaveCount(0);
  await expect(page.getByTestId("active-work").getByRole("button", { name: "Back" })).toHaveCount(0);
  await expect(row.getByTestId("open-tailored-resume")).toBeVisible();

  await generateResume(page);
  await expect(panel.getByTestId("resume-document")).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "SKILLS" })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "EXPERIENCE" })).toHaveCount(0);
  await expect(panel.getByText("None", { exact: true })).toHaveCount(0);
  await expect(panel.getByTestId("resume-candidate-name")).toHaveText("Your Name");
  await expect(panel.getByTestId("resume-contact")).toHaveText(
    `${email} • Phone • Location • LinkedIn • Portfolio`,
  );
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveCount(0);
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Up to date");
  await expect(panel.getByRole("img", { name: "Resume up to date" })).toBeVisible();
  await expect(panel.getByTestId("download-tailored-resume")).toBeVisible();
  await expect(panel).toBeVisible();
  const generated = await openDetails(page, row);
  await expect(generated.getByTestId("job-tailored-resume")).toHaveText("Present");

  await page.getByTestId("nav-profile").click();
  await addSkill(page, "Go");
  await page.getByTestId("nav-dashboard").click();
  await page.getByTestId("open-tailored-resume").click();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toHaveCount(0);

  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toBeVisible();
  await expect(panel).toBeVisible();
  const replaced = await openDetails(page, row);
  await expect(replaced.getByTestId("job-tailored-resume")).toHaveText("Present");

  await row.getByRole("button", { name: "Edit job", exact: true }).click();
  const edit = page.getByRole("form", { name: "Edit job" });
  await edit.getByLabel("Job description").fill("Build reliable APIs.");
  const savePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" && /\/jobs\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await edit.getByRole("button", { name: "Save job", exact: true }).click();
  expect((await savePromise).ok()).toBe(true);
  const cleared = await openDetails(page, row);
  await expect(cleared.getByTestId("job-description")).toHaveText("Build reliable APIs.");
  await expect(cleared.getByTestId("job-analysis")).toHaveText("Current");
  await expect(cleared.getByTestId("job-tailored-resume")).toHaveText("Not available");
  await row.getByTestId("open-tailored-resume").click();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveText("No tailored resume yet.");
  await expect(panel.getByTestId("resume-document")).toHaveCount(0);
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Needs regeneration");
  await expect(panel.getByRole("img", { name: "Resume needs regeneration" })).toBeVisible();
  await expect(panel.getByTestId("download-tailored-resume")).toHaveCount(0);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toHaveCount(0);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toHaveCount(0);

  await generateResume(page);
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "Go" })).toBeVisible();
  const restored = await openDetails(page, row);
  await expect(restored.getByTestId("job-tailored-resume")).toHaveText("Present");
  await expect(restored.getByTestId("job-interview-plan")).toHaveText("Not available");
  await expect(restored.getByTestId("job-score")).toHaveText("Not available");
  await expect(restored.getByTestId("job-readiness")).toHaveText("Not available");
  await row.getByTestId("open-tailored-resume").click();
  await expect(panel).toBeVisible();
});

test("hides source ids and shows resume facts", async ({ page }) => {
  const sourceIds = {
    skill: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    experience: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    project: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    privateProject: "ffffffff-ffff-4fff-8fff-ffffffffffff",
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
      {
        sourceId: sourceIds.privateProject,
        name: "Private Notes",
        description: "Offline notes",
        url: null,
        startDate: null,
        endDate: null,
        accomplishments: ["Kept notes"],
        technologies: [],
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

  const email = await registerAndLogin(page);
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

  await expect(panel.getByTestId("resume-document")).toBeVisible();
  await expect(panel.getByTestId("resume-candidate-name")).toHaveText("Your Name");
  await expect(panel.getByTestId("resume-contact")).toHaveText(
    `${email} • Phone • Location • LinkedIn • Portfolio`,
  );
  await expect(panel.getByRole("heading", { level: 3, name: "SKILLS" })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "EXPERIENCE" })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "PROJECTS" })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "EDUCATION" })).toBeVisible();
  await expect(panel.getByRole("heading", { level: 3, name: "CERTIFICATIONS" })).toBeVisible();
  await expect(panel.getByTestId("resume-skill")).toHaveText("TypeScript");
  const experience = panel.getByTestId("resume-experience");
  await expect(experience).toContainText("Northstar Technologies");
  await expect(experience).toContainText("Software Engineer");
  await expect(experience).toContainText("Jan 2023 – Present");
  await expect(experience).toContainText("Built APIs");
  await expect(experience).toContainText("Technologies: TypeScript");
  await expect(experience).not.toContainText("2023-01-01");
  const support = panel.getByTestId("resume-project").filter({ hasText: "SupportAI" });
  await expect(support).toContainText("Grounded assistant");
  await expect(support).toContainText("https://example.com/support");
  await expect(support).toContainText("Feb 2025 – Present");
  await expect(support).toContainText("Built retrieval");
  await expect(support).toContainText("Technologies: Python");
  const privateProject = panel.getByTestId("resume-project").filter({ hasText: "Private Notes" });
  await expect(privateProject).toContainText("Offline notes");
  await expect(privateProject).toContainText("Kept notes");
  await expect(privateProject).not.toContainText("http");
  await expect(privateProject).not.toContainText("null");
  const education = panel.getByTestId("resume-education");
  await expect(education).toContainText("Lakeview University");
  await expect(education).toContainText("Bachelor of Science");
  await expect(education).toContainText("Computer Science");
  await expect(education).toContainText("Feb 2023 – Sep 2026");
  await expect(education).not.toContainText("2023-02-08");
  const certification = panel.getByTestId("resume-certification");
  await expect(certification).toContainText("AWS Certified Cloud Practitioner");
  await expect(certification).toContainText("Amazon Web Services");
  await expect(certification).toContainText("Issued Jun 2025");
  await expect(certification).not.toContainText("Expires");
  await expect(certification).not.toContainText("No expiration");
  await expect(panel.getByText("None", { exact: true })).toHaveCount(0);
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Needs regeneration");
  await expect(panel.getByTestId("download-tailored-resume")).toBeVisible();
  await expect(page.getByTestId("active-work").getByRole("button", { name: "Back" })).toHaveCount(0);

  const text = await panel.innerText();
  for (const sourceId of Object.values(sourceIds)) {
    expect(text.includes(sourceId)).toBe(false);
  }
  for (const rawDate of ["2023-01-01", "2025-02-06", "2023-02-08", "2026-09-01", "2025-06-05"]) {
    expect(text.includes(rawDate)).toBe(false);
  }

  const tailoredRequests: string[] = [];
  const onRequest = (request: { method: () => string; url: () => string }): void => {
    if (isTailoredResume(new URL(request.url()))) {
      tailoredRequests.push(request.method());
    }
  };
  page.on("request", onRequest);
  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "Download resume PDF" }).click();
  const download = await downloadPromise;
  page.off("request", onRequest);
  expect(tailoredRequests).toEqual([]);
  expect(download.suggestedFilename()).toBe("Example-Co-Engineer-Resume.pdf");
  const downloadPath = await download.path();
  if (downloadPath === null) {
    throw new Error("Download path was not available");
  }
  const bytes = await readFile(downloadPath);
  expect(bytes.subarray(0, 4).toString("utf8")).toBe("%PDF");
  const pdfText = bytes.toString("latin1");
  expect(pdfText.includes("Your Name")).toBe(true);
  expect(pdfText.includes(email)).toBe(true);
  expect(pdfText.includes("Phone")).toBe(true);
  expect(pdfText.includes("Northstar Technologies")).toBe(true);
  expect(pdfText.includes("Needs regeneration")).toBe(false);
  expect(pdfText.includes("Generate resume")).toBe(false);
  expect(pdfText.includes("Private Notes")).toBe(true);
  expect(pdfText.includes("https://example.com/support")).toBe(true);
  expect(pdfText.includes("Jan 2023")).toBe(true);
  expect(pdfText.includes("Present")).toBe(true);
  for (const sourceId of Object.values(sourceIds)) {
    expect(pdfText.includes(sourceId)).toBe(false);
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
  await expect(panel.getByTestId("resume-document")).toHaveCount(0);
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Needs regeneration");
  await expect(panel.getByTestId("download-tailored-resume")).toHaveCount(0);
  await expect(panel.getByTestId("resume-skill")).toHaveCount(0);
  const details = await openDetails(page, row);
  await expect(details.getByTestId("job-tailored-resume")).toHaveText("Not available");
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
  const present = await openDetails(page, row);
  await expect(present.getByTestId("job-tailored-resume")).toHaveText("Present");
  await row.getByTestId("open-tailored-resume").click();

  await stubGenerateFailure(page);
  await generateResume(page);
  await expect(panel.getByText("Resume generation failed", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("resume-document")).toBeVisible();
  await expect(panel.getByTestId("resume-skill").filter({ hasText: "TypeScript" })).toBeVisible();
  await expect(panel.getByTestId("resume-freshness")).toHaveText("Up to date");
  await expect(panel.getByTestId("download-tailored-resume")).toBeVisible();
  await expect(panel.getByTestId("tailored-resume-empty")).toHaveCount(0);
  await expect(panel).toBeVisible();
  const details = await openDetails(page, row);
  await expect(details.getByTestId("job-tailored-resume")).toHaveText("Present");
  await row.getByTestId("open-tailored-resume").click();
  await expect(panel).toBeVisible();
});
