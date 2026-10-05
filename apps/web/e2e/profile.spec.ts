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

const sections = [
  {
    path: "/profile/skills",
    key: "skills",
    testId: "profile-skills",
    loading: "Loading skills…",
    empty: "No skills yet.",
  },
  {
    path: "/profile/education",
    key: "education",
    testId: "profile-education",
    loading: "Loading education…",
    empty: "No education yet.",
  },
  {
    path: "/profile/experience",
    key: "experience",
    testId: "profile-experience",
    loading: "Loading work experience…",
    empty: "No work experience yet.",
  },
  {
    path: "/profile/projects",
    key: "projects",
    testId: "profile-projects",
    loading: "Loading projects…",
    empty: "No projects yet.",
  },
  {
    path: "/profile/certifications",
    key: "certifications",
    testId: "profile-certifications",
    loading: "Loading certifications…",
    empty: "No certifications yet.",
  },
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
  const email = `phase6-${randomUUID()}@example.com`;
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

async function fillForm(page: Page, formName: string, email: string, formPassword: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  await openAuthForm(page, formName);
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(formPassword);
}

async function register(page: Page, email: string): Promise<void> {
  await fillForm(page, "Register", email, password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByTestId("register-confirmation")).toBeVisible();
}

async function login(page: Page, email: string): Promise<void> {
  await fillForm(page, "Log in", email, password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByTestId("signed-in")).toBeVisible();
}

async function expectSectionsAbsent(page: Page): Promise<void> {
  for (const section of sections) {
    await expect(page.getByTestId(section.testId)).toHaveCount(0);
  }
}

function profileForm(page: Page, name: string): Locator {
  return page.getByRole("form", { name });
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

test("shows loading before empty, and keeps a pending section independent", async ({ page }) => {
  const refreshGate = createGate(true);
  await page.route("**/auth/refresh", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    await waitForGate(refreshGate);
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByTestId("auth-loading")).toBeVisible();
  await expectSectionsAbsent(page);
  openGate(refreshGate);
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expectSectionsAbsent(page);

  const email = uniqueEmail();
  await register(page, email);

  const gates = sections.map(() => createGate(true));
  for (const [index, section] of sections.entries()) {
    const gate = gates[index];
    if (gate === undefined) {
      throw new Error("missing profile gate");
    }
    await page.route(`**${section.path}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await waitForGate(gate);
      await fulfillJson(route, 200, { [section.key]: [] });
    });
  }

  await login(page, email);
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out", exact: true })).toBeVisible();
  await expect(page.getByRole("heading").nth(0)).toHaveText("Skills");
  await expect(page.getByRole("heading").nth(1)).toHaveText("Education");
  await expect(page.getByRole("heading").nth(2)).toHaveText("Work experience");
  await expect(page.getByRole("heading").nth(3)).toHaveText("Projects");
  await expect(page.getByRole("heading").nth(4)).toHaveText("Certifications");

  for (const section of sections) {
    await expect(page.getByTestId(section.testId)).toBeVisible();
    await expect(page.getByTestId(`${section.testId}-loading`)).toHaveText(section.loading);
    await expect(page.getByTestId(`${section.testId}-empty`)).toHaveCount(0);
  }

  for (const [index, gate] of gates.entries()) {
    if (index < gates.length - 1) {
      openGate(gate);
    }
  }

  for (const section of sections.slice(0, -1)) {
    await expect(page.getByTestId(`${section.testId}-empty`)).toHaveText(section.empty);
    await expect(page.getByTestId(`${section.testId}-loading`)).toHaveCount(0);
  }

  const pending = sections[sections.length - 1];
  if (pending === undefined) {
    throw new Error("missing pending section");
  }
  await expect(page.getByTestId(`${pending.testId}-loading`)).toHaveText(pending.loading);
  await expect(page.getByTestId(`${pending.testId}-empty`)).toHaveCount(0);

  const lastGate = gates[gates.length - 1];
  if (lastGate === undefined) {
    throw new Error("missing last gate");
  }
  openGate(lastGate);
  await expect(page.getByTestId(`${pending.testId}-empty`)).toHaveText(pending.empty);
  await expect(page.getByTestId(`${pending.testId}-loading`)).toHaveCount(0);
});

test("shows a list error without blocking the other sections", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await register(page, email);

  for (const section of sections) {
    await page.route(`**${section.path}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      if (section.path === "/profile/projects") {
        await fulfillJson(route, 400, { error: "Invalid input" });
        return;
      }
      await fulfillJson(route, 200, { [section.key]: [] });
    });
  }

  await login(page, email);
  await expect(page.getByTestId("profile-projects").getByRole("alert")).toHaveText("Invalid input");
  await expect(page.getByTestId("profile-projects-empty")).toHaveCount(0);
  for (const section of sections) {
    if (section.path === "/profile/projects") {
      continue;
    }
    await expect(page.getByTestId(`${section.testId}-empty`)).toHaveText(section.empty);
  }
});

test("creates, edits, reloads, and deletes one record of each type", async ({ page }) => {
  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await register(page, email);
  await login(page, email);

  for (const section of sections) {
    await expect(page.getByTestId(`${section.testId}-empty`)).toHaveText(section.empty);
  }

  const skillForm = profileForm(page, "Add skill");
  await skillForm.getByLabel("Name").fill("TypeScript");
  await skillForm.getByRole("button", { name: "Add skill", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText("TypeScript", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-skills-empty")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit skill", exact: true }).click();
  const editSkill = profileForm(page, "Edit skill");
  await editSkill.getByLabel("Name").fill("Go");
  await editSkill.getByRole("button", { name: "Save skill", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText("Go", { exact: true })).toBeVisible();

  const educationForm = profileForm(page, "Add education");
  await educationForm.getByLabel("Institution").fill("State University");
  await educationForm.getByLabel("Degree").fill("B.S.");
  await educationForm.getByLabel("Field of study").fill("Computer Science");
  await educationForm.getByLabel("Start date").fill("2016-09-01");
  await educationForm.getByLabel("End date").fill("2020-05-15");
  await educationForm.getByRole("button", { name: "Add education", exact: true }).click();
  await expect(page.getByTestId("profile-education").getByText("State University", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit education", exact: true }).click();
  const editEducation = profileForm(page, "Edit education");
  await editEducation.getByLabel("Institution").fill("City College");
  await editEducation.getByRole("button", { name: "Save education", exact: true }).click();
  await expect(page.getByTestId("profile-education").getByText("City College", { exact: true })).toBeVisible();

  const experienceForm = profileForm(page, "Add experience");
  await experienceForm.getByLabel("Employer").fill("Example Co");
  await experienceForm.getByLabel("Job title").fill("Engineer");
  await experienceForm.getByLabel("Start date").fill("2021-01-04");
  await experienceForm.getByLabel("Accomplishments").fill("Shipped the billing service");
  await experienceForm.getByLabel("Technologies").fill("TypeScript");
  await experienceForm.getByRole("button", { name: "Add experience", exact: true }).click();
  await expect(page.getByTestId("profile-experience").getByText("Engineer", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-experience").getByText("Present", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit experience", exact: true }).click();
  const editExperience = profileForm(page, "Edit experience");
  await editExperience.getByLabel("Job title").fill("Senior Engineer");
  await editExperience.getByRole("button", { name: "Save experience", exact: true }).click();
  await expect(page.getByTestId("profile-experience").getByText("Senior Engineer", { exact: true })).toBeVisible();

  const projectForm = profileForm(page, "Add project");
  await projectForm.getByLabel("Name").fill("JobPilot");
  await projectForm.getByLabel("Description").fill("A job application assistant.");
  await projectForm.getByLabel("URL").fill("https://example.com/jobpilot");
  await projectForm.getByLabel("Start date").fill("2024-02-01");
  await projectForm.getByLabel("Technologies").fill("React");
  await projectForm.getByRole("button", { name: "Add project", exact: true }).click();
  await expect(page.getByTestId("profile-projects").getByText("JobPilot", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  const editProject = profileForm(page, "Edit project");
  await editProject.getByLabel("Name").fill("JobPilot API");
  await editProject.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page.getByTestId("profile-projects").getByText("JobPilot API", { exact: true })).toBeVisible();

  const certificationForm = profileForm(page, "Add certification");
  await certificationForm.getByLabel("Name").fill("AWS Cloud Practitioner");
  await certificationForm.getByLabel("Issuer").fill("Amazon Web Services");
  await certificationForm.getByLabel("Issued on").fill("2023-06-01");
  await certificationForm.getByRole("button", { name: "Add certification", exact: true }).click();
  await expect(
    page.getByTestId("profile-certifications").getByText("AWS Cloud Practitioner", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit certification", exact: true }).click();
  const editCertification = profileForm(page, "Edit certification");
  await editCertification.getByLabel("Name").fill("AWS Solutions Architect");
  await editCertification.getByRole("button", { name: "Save certification", exact: true }).click();
  await expect(
    page.getByTestId("profile-certifications").getByText("AWS Solutions Architect", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("signed-in")).toBeVisible();
  await expect(page.getByTestId("profile-skills").getByText("Go", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-education").getByText("City College", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-experience").getByText("Senior Engineer", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-experience").getByText("Present", { exact: true })).toBeVisible();
  await expect(page.getByTestId("profile-projects").getByText("JobPilot API", { exact: true })).toBeVisible();
  await expect(
    page.getByTestId("profile-certifications").getByText("AWS Solutions Architect", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Delete skill", exact: true }).click();
  await expect(page.getByTestId("profile-skills-empty")).toHaveText("No skills yet.");
  await page.getByRole("button", { name: "Delete education", exact: true }).click();
  await expect(page.getByTestId("profile-education-empty")).toHaveText("No education yet.");
  await page.getByRole("button", { name: "Delete experience", exact: true }).click();
  await expect(page.getByTestId("profile-experience-empty")).toHaveText("No work experience yet.");
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(page.getByTestId("profile-projects-empty")).toHaveText("No projects yet.");
  await page.getByRole("button", { name: "Delete certification", exact: true }).click();
  await expect(page.getByTestId("profile-certifications-empty")).toHaveText("No certifications yet.");
});

test("does not reuse another user's cached skills", async ({ page }) => {
  const emailA = uniqueEmail();
  const emailB = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await register(page, emailA);
  await register(page, emailB);
  await login(page, emailA);
  await expect(page.getByTestId("profile-skills-empty")).toBeVisible();

  const skillForm = profileForm(page, "Add skill");
  await skillForm.getByLabel("Name").fill("TypeScript");
  await skillForm.getByRole("button", { name: "Add skill", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByText("TypeScript", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await expectSectionsAbsent(page);

  const gate = createGate(true);
  await page.route("**/profile/skills", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await waitForGate(gate);
    await route.continue();
  });

  const skillsResponse = page.waitForResponse(
    (response) => response.url().endsWith("/profile/skills") && response.request().method() === "GET",
  );
  await login(page, emailB);
  await expect(page.getByTestId("profile-skills-loading")).toBeVisible();
  await expect(page.getByTestId("profile-skills-empty")).toHaveCount(0);
  await expect(page.getByText("TypeScript", { exact: true })).toHaveCount(0);

  openGate(gate);
  const response = await skillsResponse;
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(body).toEqual({ skills: [] });
  await expect(page.getByTestId("profile-skills-empty")).toHaveText("No skills yet.");
  await expect(page.getByText("TypeScript", { exact: true })).toHaveCount(0);
});

test("rejects an empty skill name before sending a request", async ({ page }) => {
  let skillPosts = 0;
  await page.route("**/profile/skills", async (route) => {
    if (route.request().method() === "POST") {
      skillPosts += 1;
    }
    await route.continue();
  });

  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await register(page, email);
  await login(page, email);
  await expect(page.getByTestId("profile-skills-empty")).toBeVisible();

  const form = profileForm(page, "Add skill");
  await form.getByRole("button", { name: "Add skill", exact: true }).click();
  await expect(form.locator("[data-slot='form-message']")).toBeVisible();
  expect(skillPosts).toBe(0);
});

test("shows the API error when creating a skill fails", async ({ page }) => {
  await page.route("**/profile/skills", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await fulfillJson(route, 400, { error: "Invalid input" });
  });

  const email = uniqueEmail();
  await page.goto("/");
  await expect(page.getByTestId("signed-out")).toBeVisible();
  await register(page, email);
  await login(page, email);
  await expect(page.getByTestId("profile-skills-empty")).toBeVisible();

  const form = profileForm(page, "Add skill");
  await form.getByLabel("Name").fill("TypeScript");
  await form.getByRole("button", { name: "Add skill", exact: true }).click();
  await expect(page.getByTestId("profile-skills").getByRole("alert")).toHaveText("Invalid input");
  await expect(page.getByTestId("profile-skills-empty")).toBeVisible();
});
