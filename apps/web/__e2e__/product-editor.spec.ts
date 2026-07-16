import { expect, type Page, test } from "@playwright/test";

function monitorErrors(page: Page, errors: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function signIn(page: Page, destination: string, email: string) {
  await page.goto(`/sign-in?redirect=${encodeURIComponent(destination)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password-123");
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/sign-in/email") && candidate.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  expect((await response).ok()).toBe(true);
  await page.waitForURL((url) => url.pathname === destination);
  await page.waitForLoadState("networkidle");
}

test("Owner creates a draft shell and receives complete editor controls", async ({
  page
}, testInfo) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await signIn(page, "/demo-studio/admin/products", "owner@demo-studio.test");

  await expect(page.getByRole("heading", { exact: true, name: "Products" })).toBeVisible();
  await page.getByRole("button", { name: "New product" }).click();
  const createDialog = page.getByRole("dialog", { name: "New product" });
  await expect(createDialog).toBeVisible();
  const suffix = `${testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop"}-${String(Date.now()).slice(-6)}`;
  const name = `Browser album ${suffix}`;
  const slug = `browser-album-${suffix}`;
  await createDialog.getByLabel("Name").fill(name);
  await createDialog.getByLabel("URL slug").fill(slug);
  await createDialog
    .getByLabel("Description (Optional)", { exact: true })
    .fill("Created by the focused product editor browser check.");
  const createResponse = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/rpc/products/create") && candidate.request().method() === "POST"
  );
  await createDialog.getByRole("button", { name: "Create draft" }).click();
  expect((await createResponse).ok()).toBe(true);

  const productLink = page.getByRole("row").filter({ hasText: name }).getByRole("link");
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product content" })).toBeVisible();
  const nameInput = page.getByLabel("Name", { exact: true });
  await nameInput.fill(`${name} pending`);
  await page.getByRole("link", { name: "Back to products" }).click();
  const leaveDialog = page.getByRole("dialog", { name: "Discard unsaved product edits?" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(nameInput).toHaveValue(`${name} pending`);
  await page.getByRole("tab", { name: "Options" }).click();
  await expect(page.getByRole("heading", { name: "Option groups" })).toBeVisible();
  await page.getByRole("tab", { name: "Details" }).click();
  await expect(nameInput).toHaveValue(`${name} pending`);
  await nameInput.fill(name);

  await page.getByRole("tab", { name: "Options" }).click();
  await page.getByRole("combobox", { name: "Add group" }).click();
  await page.getByRole("option", { name: "Single choice" }).click();
  await page.getByLabel("Label", { exact: true }).fill("Cover finish");
  const machineKey = page.getByLabel("Machine key");
  await expect(machineKey).toBeEnabled();
  const configurationResponse = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/rpc/products/editConfiguration") &&
      candidate.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save configuration" }).click();
  expect((await configurationResponse).ok()).toBe(true);
  await expect(machineKey).toBeDisabled();
  await expect(page.getByText("Unsaved changes")).toHaveCount(0);

  await page.getByRole("tab", { name: "Pricing" }).click();
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  const basePrice = page.getByLabel("Base price");
  await basePrice.fill("123.45");
  await expect(
    page.getByText("Save or discard edits before changing product status.")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Archive" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Delete" })).toBeDisabled();
  const pricingResponse = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/rpc/products/editPricing") &&
      candidate.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Save pricing" }).click();
  expect((await pricingResponse).ok()).toBe(true);
  await expect(page.getByText("Save or discard edits before changing product status.")).toHaveCount(
    0
  );
  await expect(page.getByRole("button", { name: "Archive" })).toBeEnabled();

  await basePrice.fill("124.00");
  await page.getByRole("link", { name: "Back to products" }).click();
  await page
    .getByRole("dialog", { name: "Discard unsaved product edits?" })
    .getByRole("button", { name: "Discard and leave" })
    .click();
  await expect(page).toHaveURL(/\/demo-studio\/admin\/products\/?(?:\?.*)?$/);
  await productLink.click();
  await page.getByRole("tab", { name: "Pricing" }).click();
  await expect(page.getByLabel("Base price")).toHaveValue("123.45");

  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish readiness" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(/Delete this product permanently/)).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/demo-studio\/admin\/products\/?(?:\?.*)?$/);
  await expect(productLink).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole("heading", { name })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Manager can maintain configuration without pricing or deletion controls", async ({
  page
}) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await signIn(page, "/demo-studio/admin/products/wedding-album", "manager@demo-studio.test");

  await expect(page.getByRole("heading", { name: "Wedding Album" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product content" })).toBeVisible();
  await page.getByRole("tab", { name: "Options" }).click();
  await expect(page.getByRole("heading", { name: "Option groups" })).toBeVisible();
  await page.getByRole("tab", { name: "Preview" }).click();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pricing" })).toHaveCount(0);
  await expect(page.getByLabel("Base price")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  expect(errors).toEqual([]);
});
