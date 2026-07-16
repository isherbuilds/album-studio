import { type Browser, type Page, expect, test } from "@playwright/test";

import { auth } from "@tsu-stack/auth/index";

import { E2E_PLATFORM_ADMIN_EMAIL, E2E_PLATFORM_ADMIN_PASSWORD } from "./global-setup";

const DEMO_CUSTOMER_EMAIL = "customer@demo-studio.test";
const DEMO_PASSWORD = "demo-password-123";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes("/sign-in/email") && candidate.request().method() === "POST"
  );
  await page.getByRole("main").getByRole("button", { name: "Sign In" }).click();
  expect((await response).ok()).toBe(true);
}

async function newPage(browser: Browser, clipboard = false) {
  const context = await browser.newContext(
    clipboard ? { permissions: ["clipboard-read", "clipboard-write"] } : undefined
  );
  return { context, page: await context.newPage() };
}

test("Platform Admin provisions an Owner who shares a copyable Customer invitation", async ({
  browser
}) => {
  test.setTimeout(90_000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const organizationName = `Acceptance Studio ${suffix}`;
  const organizationSlug = `acceptance-studio-${suffix}`;
  const ownerEmail = `owner-${suffix}@album-studio.test`;
  const ownerPassword = `owner-password-${suffix}`;

  const admin = await newPage(browser);
  try {
    await signIn(admin.page, E2E_PLATFORM_ADMIN_EMAIL, E2E_PLATFORM_ADMIN_PASSWORD);
    await expect(admin.page).toHaveURL(/\/admin$/);
    await admin.page.getByRole("main").getByRole("link", { name: "Organizations" }).click();
    await admin.page.getByRole("button", { name: "Create organization" }).click();

    const dialog = admin.page.getByRole("dialog", { name: "Create organization" });
    await dialog.getByLabel("Organization name").fill(organizationName);
    await dialog.getByLabel("Organization slug").fill(organizationSlug);
    await dialog.getByLabel("Owner name").fill(`Acceptance Owner ${suffix}`);
    await dialog.getByLabel("Initial owner email").fill(ownerEmail);
    await dialog.getByLabel("Initial password for a new account").fill(ownerPassword);
    await dialog.getByRole("button", { name: "Create organization" }).click();

    await expect(admin.page.getByRole("link", { name: organizationName })).toBeVisible();
  } finally {
    await admin.context.close();
  }

  const owner = await newPage(browser, true);
  let invitationUrl = "";
  try {
    await signIn(owner.page, ownerEmail, ownerPassword);
    await expect(owner.page).toHaveURL(new RegExp(`/${organizationSlug}/dashboard$`));

    const blockedRoleUpdate = await owner.context.request.post(
      "http://localhost:5000/server/auth/organization/update-member-role",
      { data: {} }
    );
    expect(blockedRoleUpdate.status()).toBe(404);

    await owner.page.goto(`/${organizationSlug}/admin/members`);
    const inviteButton = owner.page.getByRole("button", { name: "Invite a member" });
    const inviteDialog = owner.page.getByRole("dialog", { name: "Invite a member" });
    await expect(async () => {
      await inviteButton.click();
      await expect(inviteDialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await inviteDialog.getByLabel("Email address").fill(DEMO_CUSTOMER_EMAIL);
    await inviteDialog.getByRole("button", { name: "Create invitation" }).click();
    await expect(owner.page.getByText(DEMO_CUSTOMER_EMAIL, { exact: true })).toBeVisible();

    await owner.page.getByRole("button", { name: "Copy invitation link" }).click();
    await expect(owner.page.getByText("Invitation link copied")).toBeVisible();
    invitationUrl = await owner.page.evaluate(() => navigator.clipboard.readText());
    const invitation = new URL(invitationUrl);
    expect(invitation.pathname).toBe("/accept-invitation");
    expect(invitation.searchParams.get("id")).toBeTruthy();
  } finally {
    await owner.context.close();
  }

  const customer = await newPage(browser);
  try {
    await signIn(customer.page, DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD);
    await expect(customer.page).not.toHaveURL(/\/sign-in$/);
    await customer.page.goto(invitationUrl);
    await customer.page.getByRole("button", { name: "Accept invitation" }).click();
    await expect(customer.page.getByText("Invitation accepted")).toBeVisible();
  } finally {
    await customer.context.close();
  }

  const returningCustomer = await newPage(browser);
  try {
    await signIn(returningCustomer.page, DEMO_CUSTOMER_EMAIL, DEMO_PASSWORD);
    await expect(returningCustomer.page).toHaveURL(/\/select-organization$/);
    await expect(
      returningCustomer.page.getByRole("heading", { level: 1, name: "Choose a workspace" })
    ).toBeVisible();
    await expect(returningCustomer.page.getByRole("link", { name: /Demo Studio/ })).toBeVisible();
    await returningCustomer.page.getByRole("link", { name: new RegExp(organizationName) }).click();
    await expect(returningCustomer.page).toHaveURL(new RegExp(`/${organizationSlug}/dashboard$`));
  } finally {
    await returningCustomer.context.close();
  }

  const noMembershipEmail = `no-membership-${suffix}@album-studio.test`;
  const noMembershipPassword = `no-membership-password-${suffix}`;
  await auth.api.createUser({
    body: {
      email: noMembershipEmail,
      name: `No Membership ${suffix}`,
      password: noMembershipPassword,
      role: "user"
    }
  });

  const noMembershipUser = await newPage(browser);
  try {
    await signIn(noMembershipUser.page, noMembershipEmail, noMembershipPassword);
    await expect(noMembershipUser.page).toHaveURL(/\/select-organization$/);
    await expect(
      noMembershipUser.page.getByText(
        "You do not belong to an organization yet. Open an invitation link to join one."
      )
    ).toBeVisible();
  } finally {
    await noMembershipUser.context.close();
  }
});
