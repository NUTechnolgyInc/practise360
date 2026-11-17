// PEOPLE-UI — person profiles: names link to /people/:id, and the profile shows only what the viewer's access allows
// (docs/rbac.md §4 "People profiles"). Read-only.
const { test, expect } = require("../../support/fixtures");

const tab = (page, name) => page.getByRole("tab", { name });

test.describe("People profiles", () => {
  test("[PEOPLE-UI-01] the Practices Admin's name on /practices opens their profile", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices");
    await page.getByRole("link", { name: "Jordan Blake" }).click();
    await expect(page).toHaveURL(/\/people\/[0-9a-f]{24}$/);
    await expect(page.getByRole("heading", { level: 1, name: "Jordan Blake" })).toBeVisible();
    await expect(page.getByText("practices.admin", { exact: true })).toBeVisible();
    await expect(page.getByText("Practices Admin @ Practices")).toBeVisible();
  });

  test("[PEOPLE-UI-02] a Manager on a practice card opens their profile with practice, roles and contributions", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices");
    await page.getByRole("region", { name: "Digital Engineering" }).getByRole("link", { name: "Morgan Reyes" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Morgan Reyes" })).toBeVisible();
    const practices = page.getByRole("list", { name: "Practices" });
    await expect(practices.getByRole("link", { name: "Digital Engineering" })).toBeVisible();
    await expect(practices).toContainText("Practice Manager");
    await expect(tab(page, /^Contributions/)).toBeVisible();
    await expect(tab(page, /^Certifications/)).toHaveCount(0); // practitioners don't see each other's plans
    await tab(page, /^Contributions/).click();
    await expect(page).toHaveURL(/\?tab=contributions$/);
  });

  test("[PEOPLE-UI-03] the Manager sees a member's certifications and AI usage; names in the members table link there", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/practices/digital-engineering?tab=groups");
    await page.getByRole("table").getByRole("link", { name: /Riley Patel/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Riley Patel" })).toBeVisible();
    await expect(page.getByText("Fullstack group")).toBeVisible();
    for (const name of [/^Contributions/, /^Certifications/, "AI usage"]) await expect(tab(page, name)).toBeVisible();
    await tab(page, "AI usage").click();
    await expect(page.getByRole("heading", { name: "Claude usage reports" })).toBeVisible();
  });

  test("[PEOPLE-UI-04] My profile in the account menu opens your own profile", async ({ page, loginAs }) => {
    await loginAs("de.lead");
    await page.goto("/");
    await page.getByRole("button", { name: /Casey Lin/ }).click();
    await page.getByRole("menuitem", { name: "My profile" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Casey Lin" })).toBeVisible();
    await expect(page.getByText("You", { exact: true })).toBeVisible();
    await expect(page.getByText("Lead · Fullstack")).toBeVisible();
  });

  test("[PEOPLE-UI-05] a profile the viewer can't see shows Profile not found", async ({ page, loginAs }) => {
    await loginAs("aitracker.member");
    await page.goto("/people/000000000000000000000000");
    await expect(page.getByRole("heading", { name: "Profile not found" })).toBeVisible();
  });
});
