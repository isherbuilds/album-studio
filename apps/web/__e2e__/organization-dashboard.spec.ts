import { type Browser, type Page, expect, test } from "@playwright/test";

type RoleJourney = {
  absentCards: string[];
  cards: Array<{ href: RegExp; name: string }>;
  email: string;
};

const roleJourneys: RoleJourney[] = [
  {
    absentCards: ["Customers", "Placed orders", "Low stock"],
    cards: [
      { href: /\/demo-studio\/drafts$/, name: "Active drafts" },
      { href: /\/demo-studio\/orders$/, name: "Recent orders" }
    ],
    email: "customer@demo-studio.test"
  },
  {
    absentCards: ["Customers", "Completed orders", "Cancelled orders", "Unpaid total"],
    cards: [
      { href: /\/demo-studio\/orders\?.*status=placed/, name: "Placed orders" },
      { href: /\/demo-studio\/orders\?.*status=confirmed/, name: "Confirmed orders" },
      {
        href: /\/demo-studio\/orders\?.*status=in_production/,
        name: "In production orders"
      },
      { href: /\/demo-studio\/admin\/inventory$/, name: "Low stock" },
      { href: /\/demo-studio\/admin\/inventory$/, name: "Out of stock" }
    ],
    email: "manager@demo-studio.test"
  },
  {
    absentCards: ["Active drafts", "Recent orders"],
    cards: [
      { href: /\/demo-studio\/admin\/members$/, name: "Customers" },
      { href: /\/demo-studio\/orders\?.*status=placed/, name: "Placed orders" },
      { href: /\/demo-studio\/orders\?.*status=confirmed/, name: "Confirmed orders" },
      {
        href: /\/demo-studio\/orders\?.*status=in_production/,
        name: "In production orders"
      },
      { href: /\/demo-studio\/orders\?.*status=completed/, name: "Completed orders" },
      { href: /\/demo-studio\/orders\?.*status=cancelled/, name: "Cancelled orders" },
      { href: /\/demo-studio\/admin\/payments$/, name: "Unpaid total" },
      { href: /\/demo-studio\/admin\/inventory$/, name: "Low stock" },
      { href: /\/demo-studio\/admin\/inventory$/, name: "Out of stock" }
    ],
    email: "owner@demo-studio.test"
  }
];

function monitorErrors(page: Page, errors: string[]) {
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
}

async function assertRoleDashboard(browser: Browser, journey: RoleJourney) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  monitorErrors(page, errors);

  try {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(journey.email);
    await page.getByLabel("Password").fill("demo-password-123");
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/sign-in/email") && candidate.request().method() === "POST"
    );
    await page.getByRole("main").getByRole("button", { name: "Sign In" }).click();
    expect((await response).ok()).toBe(true);

    await expect(page).not.toHaveURL(/\/sign-in$/);
    await page.goto("/demo-studio/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    const summary = page.getByRole("region", { name: "Overview summary" });
    await expect(summary).toBeVisible();
    const cards = summary.getByRole("link");
    await expect(cards).toHaveCount(journey.cards.length);

    for (const card of journey.cards) {
      const link = summary.getByRole("link", { name: new RegExp(`^${card.name}:`) });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", card.href);
    }
    for (const card of journey.absentCards) {
      await expect(summary.getByRole("link", { name: new RegExp(`^${card}:`) })).toHaveCount(0);
    }

    await cards.first().focus();
    await expect(cards.first()).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
}

for (const journey of roleJourneys) {
  const role = journey.email.slice(0, journey.email.indexOf("@"));
  test(`${role} lands on its role-correct organization surface`, async ({ browser }) => {
    await assertRoleDashboard(browser, journey);
  });
}
