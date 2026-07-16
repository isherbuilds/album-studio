import { type Page, expect, test } from "@playwright/test";

function monitorErrors(
  page: Page,
  browserErrors: string[],
  serverErrors: string[],
  allowDraftConflict = false
) {
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !(
        allowDraftConflict &&
        message.text() ===
          "Failed to load resource: the server responded with a status of 409 (Conflict)"
      )
    ) {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      !(
        allowDraftConflict &&
        response.status() === 409 &&
        response.url().includes("/rpc/drafts/save")
      )
    ) {
      serverErrors.push(`${response.status()} ${response.url()}`);
    }
  });
}

async function signInAsDemoCustomer(page: Page, destination: string) {
  const destinationPathname = new URL(destination, "http://localhost").pathname.replace(/\/$/, "");
  await page.goto(`/sign-in?redirect=${encodeURIComponent(destinationPathname)}`);
  const emailField = page.getByLabel("Email");
  if (await emailField.isVisible()) {
    await emailField.fill("customer@demo-studio.test");
    await page.getByLabel("Password").fill("demo-password-123");
    const signInResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/sign-in/email") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Sign In" }).click();
    expect((await signInResponse).ok()).toBe(true);
  }
  await page.waitForURL((url) => url.pathname.replace(/\/$/, "") === destinationPathname);
}

async function startConfiguration(page: Page, projectName: string) {
  await page.getByRole("button", { name: "Wedding Album" }).click();
  await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
  await page.getByRole("button", { name: "Start configuration" }).click();
  await expect(page).toHaveURL(/\/demo-studio\/drafts\/[^/]+\/configure$/);
}

test("customer resumes latest saved draft in a fresh session", async ({ browser }, testInfo) => {
  const projectName = `Maya & Arjun ${Date.now()}`;
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  const firstSession = await browser.newContext();
  const firstPage = await firstSession.newPage();
  let saveRequestCount = 0;
  let latestSaveBody = "";
  firstPage.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/rpc/drafts/save")) {
      saveRequestCount += 1;
      latestSaveBody = request.postData() ?? "";
    }
  });
  monitorErrors(firstPage, browserErrors, serverErrors);

  await signInAsDemoCustomer(firstPage, "/demo-studio/catalog");
  await startConfiguration(firstPage, projectName);
  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  await expect(firstPage).toHaveURL(/\/demo-studio\/drafts\/[^/]+\/configure$/);
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: /Matte/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: "Increase" }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: /Premium Gift Box/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();

  const checkpointCount = saveRequestCount;
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  const quantity = firstPage.getByRole("spinbutton", { name: "Quantity" });
  await quantity.fill("3");
  await expect(quantity).toBeFocused();
  if (testInfo.project.name === "desktop-chromium") {
    await expect(
      firstPage.getByText("₹546.00", { exact: true }).filter({ visible: true }).last()
    ).toBeVisible();
  }
  await expect(firstPage.getByText("Unsaved changes", { exact: true }).first()).toBeVisible();
  await firstPage.waitForTimeout(600);
  expect(saveRequestCount).toBe(checkpointCount);
  await firstPage.getByRole("button", { name: "Back" }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  await expect.poll(() => saveRequestCount).toBe(checkpointCount + 2);
  expect(latestSaveBody).toContain(projectName);

  const savedCheckpointCount = saveRequestCount;
  await quantity.fill("4");
  await expect(firstPage.getByText("Unsaved changes", { exact: true }).first()).toBeVisible();
  await firstPage.waitForTimeout(600);
  expect(saveRequestCount).toBe(savedCheckpointCount);
  await firstPage.getByRole("link", { name: "Back to drafts" }).click();
  await expect(firstPage.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Save and leave" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Discard changes and leave" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Keep editing" })).toBeVisible();
  await firstPage.getByRole("button", { name: "Keep editing" }).click();
  await expect(firstPage).toHaveURL(/\/demo-studio\/drafts\/[^/]+\/configure$/);
  await expect(quantity).toHaveValue("4");
  await firstPage.getByRole("link", { name: "Back to drafts" }).click();
  await firstPage.getByRole("button", { name: "Save and leave" }).click();
  await expect(firstPage.getByRole("heading", { name: "Drafts" })).toBeVisible();
  await expect.poll(() => saveRequestCount).toBe(savedCheckpointCount + 1);
  expect(latestSaveBody).toContain(projectName);
  await expect(firstPage.getByRole("link", { name: projectName })).toBeVisible();

  await firstSession.close();

  const resumedSession = await browser.newContext();
  const resumedPage = await resumedSession.newPage();
  monitorErrors(resumedPage, browserErrors, serverErrors);
  await signInAsDemoCustomer(resumedPage, "/demo-studio/drafts");
  await resumedPage.getByRole("link", { name: projectName }).click();
  await expect(resumedPage.getByText(projectName).first()).toBeVisible();
  await expect(resumedPage.getByText("Quantity", { exact: true }).first()).toBeVisible();
  await expect(resumedPage.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("4");
  await expect(resumedPage.locator('main [aria-busy="false"]')).toBeVisible();
  await testInfo.attach("draft-review", {
    body: await resumedPage.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
  await testInfo.attach("draft-review-accessibility", {
    body: await resumedPage.locator("main").ariaSnapshot(),
    contentType: "text/yaml"
  });
  await resumedPage.getByRole("button", { name: "Back" }).click();
  await expect(resumedPage.getByRole("button", { name: /Premium Gift Box/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await resumedPage.getByRole("button", { name: "Back" }).click();
  await expect(resumedPage.getByRole("spinbutton", { name: "Pages" })).toHaveValue("28");
  await resumedPage.getByRole("button", { name: "Back" }).click();
  await expect(resumedPage.getByRole("button", { name: /Matte/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await resumedPage.getByRole("button", { name: "Back" }).click();
  await expect(resumedPage.getByRole("button", { name: /Linen/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );

  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  await resumedSession.close();
});

test("customer can explicitly save local changes and leave after a conflict", async ({
  browser
}) => {
  const projectName = `Conflict ${Date.now()}`;
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  const firstSession = await browser.newContext();
  const firstPage = await firstSession.newPage();
  monitorErrors(firstPage, browserErrors, serverErrors);

  await signInAsDemoCustomer(firstPage, "/demo-studio/catalog");
  await startConfiguration(firstPage, projectName);
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  const draftUrl = firstPage.url();

  const staleSession = await browser.newContext();
  const stalePage = await staleSession.newPage();
  monitorErrors(stalePage, browserErrors, serverErrors, true);
  await signInAsDemoCustomer(stalePage, draftUrl);
  await expect(stalePage.getByText(projectName).first()).toBeVisible();

  await firstPage.getByRole("button", { name: /Leather/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();

  await stalePage.getByRole("button", { name: /Silk/ }).click();
  await stalePage.getByRole("button", { name: "Next" }).click();
  await expect(stalePage.getByText("Newer saved version found", { exact: true })).toBeVisible();

  await stalePage.getByRole("link", { name: "Back to drafts" }).click();
  await expect(stalePage.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
  await expect(stalePage.getByRole("button", { name: "Save and leave" })).toBeVisible();
  await expect(stalePage.getByRole("button", { name: "Discard changes and leave" })).toBeVisible();
  await expect(stalePage.getByRole("button", { name: "Keep editing" })).toBeVisible();
  await expect(
    stalePage.getByText(/Save and leave replaces the newer saved version/)
  ).toBeVisible();
  await stalePage.getByRole("button", { name: "Save and leave" }).click();

  await expect(stalePage.getByRole("heading", { name: "Drafts" })).toBeVisible();
  await stalePage.getByRole("link", { name: projectName }).click();
  await expect(stalePage.getByRole("button", { name: /Silk/ })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  await staleSession.close();
  await firstSession.close();
});

test("loading a saved conflict resets reachable configurator steps", async ({ browser }) => {
  const browserErrors: string[] = [];
  const serverErrors: string[] = [];
  const firstSession = await browser.newContext();
  const firstPage = await firstSession.newPage();
  monitorErrors(firstPage, browserErrors, serverErrors);

  await signInAsDemoCustomer(firstPage, "/demo-studio/catalog");
  await startConfiguration(firstPage, `Step reset ${Date.now()}`);
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: /Matte/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await expect(firstPage.getByRole("spinbutton", { name: "Pages" })).toBeVisible();
  const draftUrl = firstPage.url();

  const staleSession = await browser.newContext();
  const stalePage = await staleSession.newPage();
  monitorErrors(stalePage, browserErrors, serverErrors, true);
  await signInAsDemoCustomer(stalePage, draftUrl);
  await expect(stalePage.getByRole("spinbutton", { name: "Pages" })).toBeVisible();

  await firstPage.getByRole("button", { name: "Back" }).click();
  await firstPage.getByRole("button", { name: "Back" }).click();
  await expect(firstPage.getByRole("button", { name: /Linen/ })).toBeVisible();

  await stalePage.getByRole("button", { name: "Increase" }).click();
  await stalePage.getByRole("button", { name: "Next" }).click();
  await expect(stalePage.getByText("Newer saved version found", { exact: true })).toBeVisible();
  await stalePage.getByRole("button", { name: "Load saved version" }).click();

  await expect(stalePage.getByRole("button", { name: /Linen/ })).toBeVisible();
  await expect(stalePage.getByRole("button", { name: "Step 2: Finish" })).toBeDisabled();
  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  await staleSession.close();
  await firstSession.close();
});
