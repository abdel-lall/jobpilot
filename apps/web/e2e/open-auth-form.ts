import type { Page } from "@playwright/test";

const switchLabel: Record<string, string> = {
  Register: "Don't have an account? Sign up",
  "Log in": "Already have an account? Log in",
};

export async function openAuthForm(page: Page, formName: string): Promise<void> {
  const form = page.getByRole("form", { name: formName });
  if (await form.isVisible()) {
    return;
  }
  const label = switchLabel[formName];
  if (label === undefined) {
    throw new Error(`Unknown auth form: ${formName}`);
  }
  await page.getByRole("button", { name: label, exact: true }).click();
}
