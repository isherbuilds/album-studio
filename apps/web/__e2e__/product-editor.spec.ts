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
  await page.goto(`/web/sign-in?redirect=${encodeURIComponent(destination.replace(/^\/web/, ""))}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("demo-password-123");
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/sign-in/email") && candidate.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  expect((await response).ok()).toBe(true);
  await page.goto("about:blank");
  await page.goto(destination);
  await page.waitForLoadState("networkidle");
}

test("Owner creates a draft shell and receives complete editor controls", async ({
  page
}, testInfo) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await signIn(page, "/web/org/demo-studio/products", "owner@demo-studio.test");

  await expect(page.getByRole("heading", { exact: true, name: "Products" })).toBeVisible();
  const suffix = `${testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop"}-${String(Date.now()).slice(-6)}`;
  const name = `Browser album ${suffix}`;
  const slug = `browser-album-${suffix}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("URL slug").fill(slug);
  await page.getByLabel("Description").fill("Created by the focused product editor browser check.");
  const createResponse = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/rpc/products/create") && candidate.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Create draft" }).click();
  expect((await createResponse).ok()).toBe(true);

  const productLink = page.getByRole("link", { name: new RegExp(name, "i") });
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product content" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Option groups" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish readiness" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish" })).toBeDisabled();

  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(/Delete this product permanently/)).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/org\/demo-studio\/products\/?$/);
  await expect(page.getByRole("link", { name: new RegExp(name, "i") })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Manager can maintain configuration without pricing or deletion controls", async ({
  page
}) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await signIn(page, "/web/org/demo-studio/products/wedding-album", "manager@demo-studio.test");

  await expect(page.getByRole("heading", { name: "Wedding Album" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product content" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Option groups" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Publish readiness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pricing" })).toHaveCount(0);
  await expect(page.getByLabel("Base price")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  expect(errors).toEqual([]);
});
