import { expect, test } from "@playwright/test";

test("customer sees constraints and receives live configuration pricing", async ({
  page
}, testInfo) => {
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

  await page.goto("/sign-in?redirect=%2Fdemo-studio%2Fcatalog");

  await page.getByLabel("Email").fill("customer@demo-studio.test");
  await page.getByLabel("Password").fill("demo-password-123");
  const signInResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/sign-in/email") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  expect((await signInResponse).ok()).toBe(true);
  await page.waitForURL((url) => url.pathname === "/demo-studio/catalog");

  await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
  const weddingAlbum = page.getByRole("button", { name: /Wedding Album/ });
  const detailResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/rpc/catalog/bySlug") && response.request().method() === "POST"
  );
  await weddingAlbum.click();
  expect((await detailResponse).ok()).toBe(true);
  await expect(page.getByRole("dialog")).toContainText("A premium linen-and-leather wedding album");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await weddingAlbum.click();
  const dialog = page.getByRole("dialog");
  const startConfiguration = dialog.getByRole("button", { name: "Start configuration" });
  const projectName = dialog.getByRole("textbox", { name: "Project name" });
  await expect(projectName).not.toHaveAttribute("required", "");
  await expect(startConfiguration).toBeEnabled();
  await startConfiguration.click();
  await expect(page).toHaveURL(/\/demo-studio\/drafts\/[^/]+\/configure$/);
  await expect(page.getByRole("button", { name: /Linen/ })).toHaveAttribute("aria-pressed", "true");

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
  await expect(page.getByRole("heading", { name: "Finish" })).toBeFocused();

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
  await expect(page.getByRole("heading", { name: "Quantity" })).toBeVisible();
  const quantityTotal = page.getByText("₹182.00", { exact: true }).filter({ visible: true });
  if (testInfo.project.name === "mobile-chromium") {
    const mobileSummary = page.getByRole("button", { name: /Order total.*₹182\.00/ });
    await expect(mobileSummary).toBeVisible();
    await mobileSummary.click();
    await expect(page.getByRole("dialog", { name: "Your estimate" })).toContainText("Base price");
    await page.getByRole("button", { name: "Close" }).click();
  } else {
    await expect(quantityTotal.last()).toBeVisible();
  }
  await page.getByRole("button", { name: "Increase" }).click();
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByRole("button", { name: /Order total.*₹364\.00/ })).toBeVisible();
  } else {
    await expect(
      page.getByText("₹364.00", { exact: true }).filter({ visible: true }).last()
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { name: "Confirm" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Place order" })).toBeVisible();
  await expect(page.getByText("Base price", { exact: true })).toBeVisible();
  await expect(
    page.getByText("₹364.00", { exact: true }).filter({ visible: true }).last()
  ).toBeVisible();

  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);
});
