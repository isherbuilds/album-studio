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
  const redirect = destination.replace(/^\/web/, "");
  await page.goto(`/web/sign-in?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel("Email").fill("customer@demo-studio.test");
  await page.getByLabel("Password").fill("demo-password-123");
  const signInResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/sign-in/email") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  expect((await signInResponse).ok()).toBe(true);
  await page.goto("about:blank");
  await page.goto(destination);
}

test("customer resumes latest saved draft in a fresh session", async ({ browser }, testInfo) => {
  const projectName = `Maya & Arjun ${Date.now()}`;
  const exitProjectName = `${projectName} Folio`;
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

  await signInAsDemoCustomer(firstPage, "/web/org/demo-studio/catalog");
  await firstPage.getByRole("link", { name: /Wedding Album/ }).click();
  await firstPage.getByRole("button", { name: "Start configuration" }).click();
  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);
  await expect(firstPage).toHaveURL(/\/org\/demo-studio\/drafts\/[^/]+\/configure$/);

  await firstPage.getByRole("button", { name: /Linen/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: /Matte/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: "Increase" }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();
  await firstPage.getByRole("button", { name: /Premium Gift Box/ }).click();
  await firstPage.getByRole("button", { name: "Next" }).click();

  const checkpointCount = saveRequestCount;
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  await firstPage.getByLabel("Project name").fill(projectName);
  await expect(firstPage.getByLabel("Project name")).toHaveValue(projectName);
  const quantity = firstPage.getByRole("spinbutton", { name: "Quantity" });
  await quantity.fill("3");
  await expect(quantity).toBeFocused();
  await expect(
    firstPage.getByText("₹546.00", { exact: true }).filter({ visible: true }).last()
  ).toBeVisible();
  await expect(firstPage.getByLabel("Project name")).toHaveValue(projectName);
  await expect(firstPage.getByText("Unsaved changes", { exact: true }).first()).toBeVisible();
  await firstPage.waitForTimeout(600);
  expect(saveRequestCount).toBe(checkpointCount);
  await firstPage.getByRole("button", { name: "Save changes" }).click();
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  await expect.poll(() => saveRequestCount).toBe(checkpointCount + 1);
  expect(latestSaveBody).toContain(projectName);
  await expect(firstPage.getByLabel("Project name")).toHaveValue(projectName);

  const savedCheckpointCount = saveRequestCount;
  await firstPage.getByLabel("Project name").fill(exitProjectName);
  await expect(firstPage.getByText("Unsaved changes", { exact: true }).first()).toBeVisible();
  await firstPage.waitForTimeout(600);
  expect(saveRequestCount).toBe(savedCheckpointCount);
  await firstPage.getByRole("link", { name: "Back to drafts" }).click();
  await expect(firstPage.getByRole("heading", { name: "Unsaved changes" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Save and leave" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Discard changes and leave" })).toBeVisible();
  await expect(firstPage.getByRole("button", { name: "Keep editing" })).toBeVisible();
  await firstPage.getByRole("button", { name: "Keep editing" }).click();
  await expect(firstPage).toHaveURL(/\/org\/demo-studio\/drafts\/[^/]+\/configure$/);
  await expect(firstPage.getByLabel("Project name")).toBeFocused();
  await expect(firstPage.getByLabel("Project name")).toHaveValue(exitProjectName);
  expect(saveRequestCount).toBe(savedCheckpointCount);
  await firstPage.getByRole("link", { name: "Back to drafts" }).click();
  await firstPage.getByRole("button", { name: "Save and leave" }).click();
  await expect(firstPage.getByRole("heading", { name: "Drafts" })).toBeVisible();
  await expect.poll(() => saveRequestCount).toBe(savedCheckpointCount + 1);
  expect(latestSaveBody).toContain(exitProjectName);
  await expect(firstPage.getByRole("link", { name: exitProjectName })).toBeVisible();

  await firstSession.close();

  const resumedSession = await browser.newContext();
  const resumedPage = await resumedSession.newPage();
  monitorErrors(resumedPage, browserErrors, serverErrors);
  await signInAsDemoCustomer(resumedPage, "/web/org/demo-studio/drafts");
  await expect(resumedPage.getByRole("heading", { name: "Drafts" })).toBeVisible();
  await resumedPage.getByRole("link", { name: exitProjectName }).click();

  await expect(resumedPage.getByLabel("Project name")).toHaveValue(exitProjectName);
  await expect(resumedPage.getByText("Review", { exact: true }).first()).toBeVisible();
  await expect(resumedPage.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("3");
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

  await signInAsDemoCustomer(firstPage, "/web/org/demo-studio/catalog");
  await firstPage.getByRole("link", { name: /Wedding Album/ }).click();
  await firstPage.getByRole("button", { name: "Start configuration" }).click();
  await firstPage.getByLabel("Project name").fill(projectName);
  await firstPage.getByRole("button", { name: "Save changes" }).click();
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();
  const draftUrl = firstPage.url();

  const staleSession = await browser.newContext();
  const stalePage = await staleSession.newPage();
  monitorErrors(stalePage, browserErrors, serverErrors, true);
  await signInAsDemoCustomer(stalePage, draftUrl);
  await expect(stalePage.getByLabel("Project name")).toHaveValue(projectName);

  const serverVersion = `${projectName} Server`;
  await firstPage.getByLabel("Project name").fill(serverVersion);
  await firstPage.getByRole("button", { name: "Save changes" }).click();
  await expect(firstPage.getByText("All changes saved", { exact: true })).toBeVisible();

  const localVersion = `${projectName} Local`;
  await stalePage.getByLabel("Project name").fill(localVersion);
  await stalePage.getByRole("button", { name: "Save changes" }).click();
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
  await expect(stalePage.getByRole("link", { name: localVersion })).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(serverErrors).toEqual([]);

  await staleSession.close();
  await firstSession.close();
});
