import { expect, type Page, test } from "@playwright/test";

function monitorErrors(page: Page, errors: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
}

test("Locale routes hydrate and switch through URL state", async ({ page }) => {
  const errors: string[] = [];
  monitorErrors(page, errors);

  await page.goto("/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "Sign in to your account" })).toBeVisible();

  await page.goto("/te/sign-in");
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await expect(page.getByRole("heading", { name: "మీ ఖాతాలోకి ప్రవేశించండి" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByRole("link", { name: "Switch language: తెలుగు" }).click();
  await expect(page).toHaveURL(/\/te\/sign-in$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "te");
  await expect(page.getByRole("heading", { name: "మీ ఖాతాలోకి ప్రవేశించండి" })).toBeVisible();
  expect(errors).toEqual([]);
});
