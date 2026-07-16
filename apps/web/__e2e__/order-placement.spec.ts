import { type Page, expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "@tsu-stack/db";
import {
  component,
  optionValue,
  optionValueComponent,
  organization,
  product
} from "@tsu-stack/db/schema";

function monitorErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 409 (Conflict)")) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      !(response.status() === 409 && response.url().includes("/rpc/orders/place"))
    ) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function signIn(page: Page, destination: string, email = "customer@demo-studio.test") {
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
}

async function openValidConfirmation(page: Page, projectName: string) {
  await signIn(page, "/demo-studio/catalog");
  await page.getByRole("button", { name: "Wedding Album" }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
  await page.getByRole("button", { name: "Start configuration" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /Premium Gift Box/ }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
}

async function placeOrder(page: Page) {
  await page.getByRole("button", { name: "Place order" }).click();
}

test("checkout checkpoints dirty Draft, confirms price race, and opens immutable Order", async ({
  page
}) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await openValidConfirmation(page, `Price race ${Date.now()}`);

  let originalBasePrice = 0;
  let productId = "";
  let checkpointRaced = false;
  let raced = false;
  try {
    const rows = await db
      .select({ basePriceMinor: product.basePriceMinor, id: product.id })
      .from(product)
      .innerJoin(organization, eq(organization.id, product.organizationId))
      .where(and(eq(organization.slug, "demo-studio"), eq(product.slug, "wedding-album")))
      .limit(1);
    originalBasePrice = Number(rows[0]?.basePriceMinor);
    productId = rows[0]?.id ?? "";
    if (!productId || !Number.isSafeInteger(originalBasePrice)) {
      throw new Error("Demo Product price missing");
    }
    await page.route("**/rpc/drafts/save", async (route) => {
      if (!checkpointRaced) {
        checkpointRaced = true;
        await db
          .update(product)
          .set({ basePriceMinor: originalBasePrice + 1_000 })
          .where(eq(product.id, productId));
      }
      await route.continue();
    });
    await page.route("**/rpc/orders/place", async (route) => {
      if (raced) {
        await route.continue();
        return;
      }
      raced = true;
      await db
        .update(product)
        .set({ basePriceMinor: originalBasePrice + 2_000 })
        .where(eq(product.id, productId));
      await route.continue();
    });

    await placeOrder(page);
    const priceAlert = page
      .getByRole("alert")
      .filter({ hasText: "Price changed", visible: true })
      .first();
    await expect(priceAlert).toBeVisible();
    const previousTotal = new Intl.NumberFormat("en", {
      currency: "INR",
      style: "currency"
    }).format((originalBasePrice + 2_000) / 100);
    await expect(priceAlert.getByRole("definition").first()).toHaveText(previousTotal);
    const closeEstimate = page
      .getByRole("button", { name: "Close" })
      .filter({ visible: true })
      .first();
    if (await closeEstimate.isVisible()) {
      await closeEstimate.click();
      await expect(closeEstimate).not.toBeVisible();
      await expect(
        page.getByText("Price changed", { exact: true }).filter({ visible: true })
      ).toHaveCount(1);
    }
    await page
      .getByRole("button", { name: "Accept new total and place order" })
      .filter({ visible: true })
      .first()
      .click();

    await expect(page).toHaveURL(/\/demo-studio\/orders\/AS-S\d{11}$/);
    expect(errors).toEqual([]);
    await expect(page.getByText("Placed", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Price race/ })).toBeVisible();
    expect(errors).toEqual([]);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/drafts\/[^/]+\/configure$/);
  } finally {
    if (originalBasePrice > 0) {
      await db
        .update(product)
        .set({ basePriceMinor: originalBasePrice })
        .where(eq(product.id, productId));
    }
  }
});

test("checkout points to affected group after stock race", async ({ page }) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await openValidConfirmation(page, `Stock race ${Date.now()}`);

  let componentId = "";
  let originalQuantity = "";
  try {
    await page.route("**/rpc/orders/place", async (route) => {
      const rows = await db
        .select({ id: component.id, quantity: component.quantity })
        .from(component)
        .innerJoin(optionValueComponent, eq(optionValueComponent.componentId, component.id))
        .innerJoin(optionValue, eq(optionValue.id, optionValueComponent.optionValueId))
        .innerJoin(organization, eq(organization.id, component.organizationId))
        .where(and(eq(optionValue.label, "Linen"), eq(organization.slug, "demo-studio")))
        .limit(1);
      componentId = rows[0]?.id ?? "";
      originalQuantity = rows[0]?.quantity ?? "";
      if (!componentId) throw new Error("Demo Linen Component missing");
      await db.update(component).set({ quantity: "0" }).where(eq(component.id, componentId));
      await route.continue();
    });

    await placeOrder(page);
    await expect(
      page.getByText("Configuration changed", { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Linen/ })).toBeDisabled();
    const mobileSummary = page.getByRole("button", { name: "View estimate" });
    if (await mobileSummary.isVisible()) {
      await page.getByRole("button", { name: /Leather/ }).click();
      await expect(mobileSummary).toBeVisible();
    }
    expect(errors).toEqual([]);
  } finally {
    if (componentId) {
      await db
        .update(component)
        .set({ quantity: originalQuantity })
        .where(eq(component.id, componentId));
    }
  }
});

test("studio owner reads Orders inside workspace navigation", async ({ page }, testInfo) => {
  const errors: string[] = [];
  monitorErrors(page, errors);
  await signIn(page, "/demo-studio/orders", "owner@demo-studio.test");

  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  const usesMobileNavigation = testInfo.project.name === "mobile-chromium";
  if (usesMobileNavigation) {
    await expect(openNavigation).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("Album Studio");
  } else {
    await expect(page.getByRole("navigation", { name: "Workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "data-status",
      "active"
    );
  }
  await expect(page.getByRole("link", { name: "Catalog" })).toHaveCount(0);
  if (usesMobileNavigation) {
    await openNavigation.click();
    await page.getByRole("link", { name: "Payments" }).click();
  } else {
    await page.getByRole("link", { name: "Payments" }).click();
  }
  await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  if (!usesMobileNavigation) {
    await expect(page.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "data-status",
      "active"
    );
  }
  expect(errors).toEqual([]);
});

test("customer and owner get role-specific Order follow-up controls", async ({
  browser,
  page
}, testInfo) => {
  const customerErrors: string[] = [];
  monitorErrors(page, customerErrors);
  const projectName = `Follow-up ${Date.now()}`;
  await openValidConfirmation(page, projectName);
  await placeOrder(page);
  await expect(page).toHaveURL(/\/demo-studio\/orders\/AS-S\d{11}$/);
  const ownerOrderPath = new URL(page.url()).pathname;

  await expect(page.getByRole("button", { name: "Duplicate to new draft" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Request cancellation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Order operations" })).toHaveCount(0);
  await page.getByRole("button", { name: "Request cancellation" }).click();
  await expect(page.getByRole("alert")).toContainText("Cancellation requested");
  await expect(page.getByRole("button", { name: /Move to/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  expect(customerErrors).toEqual([]);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const ownerErrors: string[] = [];
  monitorErrors(ownerPage, ownerErrors);
  await signIn(ownerPage, ownerOrderPath, "owner@demo-studio.test");
  await expect(ownerPage.getByRole("heading", { name: "Order operations" })).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: "Duplicate to new draft" })).toHaveCount(0);
  await expect(ownerPage.getByRole("button", { name: /Move to/ })).toHaveCount(0);
  await expect(ownerPage.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  await expect(ownerPage.getByRole("button", { name: "Save Project Name" })).toBeEnabled();
  await ownerPage.getByLabel("Project Name").fill(`${projectName} corrected`);
  await expect(ownerPage.getByLabel("Project Name")).toHaveValue(`${projectName} corrected`);
  const correctionResponse = ownerPage.waitForResponse(
    (response) =>
      response.url().includes("/rpc/orders/correctProjectName") &&
      response.request().method() === "POST"
  );
  await ownerPage.getByRole("button", { name: "Save Project Name" }).click();
  expect((await correctionResponse).ok()).toBe(true);
  await expect(ownerPage.getByRole("heading", { name: `${projectName} corrected` })).toBeVisible();

  await ownerPage.getByLabel(/Amount \(INR\)/).fill("10");
  await ownerPage.getByLabel("Note").fill("Cash desk deposit");
  await ownerPage.getByRole("button", { name: "Record receipt" }).click();
  await expect(ownerPage.getByText("Cash desk deposit")).toBeVisible();
  await ownerPage.getByRole("button", { name: "Approve" }).click();
  await expect(ownerPage.getByText("Cancelled", { exact: true }).first()).toBeVisible();

  await testInfo.attach("order-follow-up", {
    body: await ownerPage.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
  await testInfo.attach("order-follow-up-accessibility", {
    body: await ownerPage.locator("main").ariaSnapshot(),
    contentType: "text/yaml"
  });
  expect(ownerErrors).toEqual([]);
  await ownerContext.close();

  await page.goto("/demo-studio/admin/payments");
  await expect(page).toHaveURL(/\/demo-studio\/catalog\/?(?:\?.*)?$/);
});
