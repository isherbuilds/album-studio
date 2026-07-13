import { expect, test } from "@playwright/test";

test("customer sees constraints and receives live configuration pricing", async ({ page }) => {
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto("/web/org/demo-studio/catalog");

  await page.getByLabel("Email").fill("customer@demo-studio.test");
  await page.getByLabel("Password").fill("demo-password-123");
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
  await page.goto("/web/org/demo-studio");
  await expect(page).toHaveURL(/\/org\/demo-studio\/catalog$/);
  await page.getByRole("link", { name: /Wedding Album/ }).click();

  const velvet = page.getByRole("button", { name: /Velvet/ });
  await expect(velvet).toBeDisabled();
  await expect(velvet).toContainText("Out of stock");

  const silk = page.getByRole("button", { name: /Silk/ });
  await expect(async () => {
    await silk.click();
    await expect(silk).toHaveAttribute("aria-pressed", "true");
  }).toPass();
  const next = page.getByRole("button", { name: "Next" });
  await expect(next).toBeEnabled();
  await next.click();

  const foil = page.getByRole("button", { name: /Foil/ });
  await expect(foil).toBeDisabled();
  await expect(foil).toContainText("Requires Linen or Leather");
  await expect(foil).toContainText("Out of stock");

  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: /Linen/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Matte/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  const pages = page.getByRole("spinbutton", { name: "Pages" });
  await expect(pages).toHaveValue("24");
  await page.getByRole("button", { name: "Increase" }).click();
  await expect(pages).toHaveValue("28");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("button", { name: /Premium Gift Box/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(
    page.getByText("₹182.00", { exact: true }).filter({ visible: true }).last()
  ).toBeVisible();
  await page.getByRole("button", { name: "Increase" }).click();
  await expect(
    page.getByText("₹364.00", { exact: true }).filter({ visible: true }).last()
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);
});
