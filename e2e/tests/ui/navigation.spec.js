// NAV — what each role sees on Home and in the sidebar, deep links into apps they can't use, settings page.
const { test, expect } = require("../../support/fixtures");
const { USERS, ALL_APPS } = require("../../support/users");

const MATRIX = ["superadmin", "practices.admin", "de.manager", "de.lead", "de.dev1", "de.coordinator", "cert.admin", "aitracker.admin", "aitracker.member", "multi.user"];

test.describe("Role-based app visibility", () => {
  for (const username of MATRIX) {
    const u = USERS[username];
    test(`[NAV-01] ${username}: Home shows exactly ${u.apps.join(", ")}; sidebar matches permissions`, async ({ page, loginAs }) => {
      await loginAs(username);
      await page.goto("/");
      await expect(page.getByRole("heading", { name: `Welcome, ${u.name.split(" ")[0]}` })).toBeVisible();
      await expect(page.getByText(`You can see ${u.apps.length} ${u.apps.length === 1 ? "app" : "apps"}`)).toBeVisible();

      const main = page.getByRole("main");
      for (const app of ALL_APPS) {
        const tile = main.getByRole("heading", { name: app, exact: true });
        if (u.apps.includes(app)) await expect(tile, app).toBeVisible();
        else await expect(tile, app).toHaveCount(0);
      }

      const nav = page.getByRole("navigation", { name: "Apps" });
      await expect(nav.getByRole("link", { name: "Home" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Settings" })).toBeVisible();
      for (const [key, label] of [["practices", "Practices"], ["ai", "AI Tracker"], ["access", "Access control"]]) {
        await expect(nav.getByRole("link", { name: label, exact: true }), label).toHaveCount(u.nav[key] ? 1 : 0);
      }
      const certs = u.apps.includes("Certification Tracker");
      await expect(nav.getByRole("link", { name: "Certifications", exact: true }), "Certifications").toHaveCount(certs ? 1 : 0);
    });
  }

  test("[NAV-02] Cert Admin's only app tile opens the Certification Tracker", async ({ page, loginAs }) => {
    await loginAs("cert.admin");
    await page.goto("/");
    await expect(page.getByText("Coming soon")).toHaveCount(0);
    await page.getByRole("link", { name: /Certification Tracker/ }).click();
    await expect(page.getByRole("heading", { name: "Certification Tracker" })).toBeVisible();
  });

  test("[NAV-03] a custom role without contribution access opens the Practices overview, with no Contributions tab", async ({ page, loginAs }) => {
    await loginAs("de.coordinator");
    await page.goto("/");
    await expect(page.getByText("Coming soon")).toHaveCount(0);
    await page.getByRole("main").getByRole("link", { name: /^Practices/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Practices" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Contributions" })).toHaveCount(0);
  });

  test("[NAV-04] app tiles open the app", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/");
    await page.getByRole("link", { name: /Practices.*contributions/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Practices" })).toBeVisible();
    await page.getByRole("tab", { name: "Contributions" }).click();
    await expect(page.getByRole("heading", { name: "Practice contributions" })).toBeVisible();
    await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
    await page.getByRole("link", { name: /AI Tracker.*Claude usage/ }).click();
    await expect(page.getByRole("heading", { name: "Claude usage reports" })).toBeVisible();
  });

  test("[NAV-05] the current page is highlighted in the sidebar", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/settings");
    const nav = page.getByRole("navigation", { name: "Apps" });
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current", "page");
  });

  test("[NAV-06] sidebar collapses to icons and expands again", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/");
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Apps" }).getByText("Settings", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByRole("navigation", { name: "Apps" }).getByText("Settings", { exact: true })).toBeVisible();
  });
});

test.describe("Deep links into apps a role can't use", () => {
  for (const [username, path] of [
    ["cert.admin", "/practices"],
    ["cert.admin", "/ai-tracker"],
    ["de.dev1", "/access-control"],
    ["aitracker.member", "/practices/contributions/new"],
    ["de.coordinator", "/practices/contributions"], // sees the Practices overview, but not contributions
    ["cert.admin", "/access-control"],
    ["aitracker.member", "/certifications"],
  ]) {
    test(`[NAV-07] ${username} opening ${path} sees "Access restricted", not a crash`, async ({ page, loginAs }) => {
      await loginAs(username);
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Access restricted" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Apps" })).toBeVisible(); // still inside the portal
    });
  }

  test("[NAV-08] an unknown URL shows the 404 page", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    const res = await page.goto("/this/page/does-not-exist");
    expect(res.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});

test.describe("Settings", () => {
  test("[SET-01] shows the account and that it's a dev-password session", async ({ page, loginAs }) => {
    await loginAs("de.lead");
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Casey Lin").first()).toBeVisible();
    await expect(page.getByText("de.lead").first()).toBeVisible();
    await expect(page.getByText("Signed in with dev password")).toBeVisible();
  });

  test("[SET-02] a multi-role user sees one row per assignment with its scope and permissions", async ({ page, loginAs }) => {
    await loginAs("multi.user");
    await page.goto("/settings");
    const rows = page.getByRole("row");
    await expect(rows.filter({ hasText: "Practice Lead" })).toContainText("QA");
    await expect(rows.filter({ hasText: "Practitioner" }).first()).toContainText("practices.contribution.create");
    await expect(rows.filter({ hasText: "AI Member" })).toContainText("AI Tracker");
    await expect(rows).toHaveCount(5); // header + 4 (Practitioner @ QA, Lead @ QA · Manual Testing, Practitioner @ AI, AI Member)
  });

  test("[SET-03] Super Admin's wildcard permission is spelled out", async ({ page, loginAs }) => {
    await loginAs("superadmin");
    await page.goto("/settings");
    await expect(page.getByText("* (everything)")).toBeVisible();
  });
});
