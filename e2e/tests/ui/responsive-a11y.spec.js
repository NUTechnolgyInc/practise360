// RESP / KB — phone-width layout (375px, docs/ui-guidelines.md) and keyboard-only use.
const { test, expect } = require("../../support/fixtures");
const { createContribution } = require("../../support/contributions");

const noHorizontalScroll = async (page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), "page is wider than the viewport").toBeLessThanOrEqual(1);

test.describe("Phone width (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test("[RESP-01] login works and fits the screen", async ({ page }) => {
    await page.goto("/login");
    await noHorizontalScroll(page);
    await page.getByLabel("Username").fill("de.dev1");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("[RESP-02] the sidebar becomes a drawer: open it, navigate, and it closes", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Collapse sidebar" })).toBeHidden(); // desktop sidebar hidden
    await page.getByRole("button", { name: "Open navigation" }).click();
    const drawer = page.getByRole("navigation", { name: "Apps" }).filter({ visible: true });
    await expect(drawer.getByRole("link", { name: "Access control" })).toBeVisible();
    await drawer.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("button", { name: "Close navigation" })).toHaveCount(0);
  });

  test("[RESP-03] the drawer closes with its close button", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Close navigation" }).click();
    await expect(page.getByRole("button", { name: "Close navigation" })).toHaveCount(0);
  });

  for (const path of ["/", "/practices", "/practices/contributions/new", "/access-control", "/ai-tracker", "/settings"]) {
    test(`[RESP-04] ${path} has no sideways scrolling at 375px`, async ({ page, loginAs }) => {
      await loginAs("de.manager");
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      await noHorizontalScroll(page);
    });
  }

  test("[RESP-05] a contribution page with a long unbroken title still fits", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"), { title: "Supercalifragilistic-".repeat(5) });
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noHorizontalScroll(page);
  });
});

test.describe("Keyboard only", () => {
  test("[KB-01] sign in using only the keyboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").focus();
    await page.keyboard.type("de.lead");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.type("password");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your apps" })).toBeVisible();
  });

  test("[KB-02] dialogs take focus when opened and give it back when closed with Escape", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    const trigger = page.getByRole("row").filter({ hasText: "Riley Patel" }).getByRole("button", { name: "Manage" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("[KB-03] tabs switch with the keyboard", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions");
    await page.getByRole("tab", { name: "Mine" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tab=mine/);
    await expect(page.getByRole("tab", { name: "Mine" })).toHaveAttribute("aria-selected", "true");
  });

  test("[KB-04] every page has exactly one top-level heading", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    for (const path of ["/practices", "/practices/digital-engineering", "/practices/contributions", "/access-control", "/ai-tracker", "/settings"]) {
      await page.goto(path);
      await expect(page.getByRole("main").getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });
});
