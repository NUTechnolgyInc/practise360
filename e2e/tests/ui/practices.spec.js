// PRAC-UI — Practices overview and practice page: Managers, groups, Leads, moving members and the practice's
// Overview tab (docs/rbac.md §4).
const { test, expect, unique } = require("../../support/fixtures");
const { makePdf } = require("../../support/files");
const { card, toast } = require("../../support/ui");

const DE_PAGE = "/practices/digital-engineering";
const DE_GROUPS = `${DE_PAGE}?tab=groups`;
const groupSection = (page, name) => page.getByRole("region", { name });

test.describe("Practices overview", () => {
  test("[PRAC-UI-01] a Manager sees their practice with its Manager, groups and Leads, and the section tabs", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/practices");
    await expect(page.getByRole("heading", { level: 1, name: "Practices" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Practices Admin", { exact: true })).toBeVisible();
    await expect(page.getByText("Jordan Blake")).toBeVisible();
    // The card is a region; its title links to the practice and the people in it link to their profiles.
    const de = page.getByRole("region", { name: "Digital Engineering" });
    await expect(de.getByRole("link", { name: "Digital Engineering", exact: true })).toHaveAttribute("href", "/practices/digital-engineering");
    await expect(de).toContainText("Morgan Reyes");
    await expect(de.getByRole("list", { name: "Digital Engineering groups" }).getByRole("listitem")).toHaveText([/DevOps.*Lead Blair Kim/, /Fullstack.*Lead Casey Lin/, /Mobile App.*No Lead yet/]);
    await expect(page.getByRole("button", { name: "New practice" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Contributions" }).click();
    await expect(page).toHaveURL(/\/practices\/contributions$/);
  });

  test("[PRAC-UI-02] Practices Admin creates a practice and lands on its page", async ({ page, loginAs }) => {
    // The created practice stays in the e2e DB for this run; it has no Manager, so it changes nobody's access.
    const name = unique("E2E UI Practice");
    await loginAs("practices.admin");
    await page.goto("/practices");
    await page.getByRole("button", { name: "New practice" }).click();
    const dialog = page.getByRole("dialog", { name: "New practice" });
    await dialog.getByLabel("Name *").fill(name);
    await dialog.getByRole("button", { name: "Create practice" }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByText("Not chosen yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Choose Manager" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("Nothing here yet")).toBeVisible();
  });

  test("[PRAC-UI-07] count tiles start hidden; Show stats reveals them on every page until hidden again", async ({ page, loginAs }) => {
    await loginAs("practices.admin");
    await page.goto("/practices");
    const tile = page.getByText("Groups without a Lead");
    await expect(page.getByRole("link", { name: /Digital Engineering/ })).toBeVisible();
    await expect(tile).toBeHidden();
    await page.getByRole("button", { name: "Show stats" }).click();
    await expect(tile).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide stats" })).toHaveAttribute("aria-expanded", "true");

    await page.goto("/practices/contributions");
    await expect(page.locator("#contribution-stats")).toBeVisible(); // remembered across pages
    await page.getByRole("button", { name: "Hide stats" }).click();
    await page.goto("/practices");
    await expect(page.getByRole("button", { name: "Show stats" })).toBeVisible();
    await expect(tile).toBeHidden();
  });
});

test.describe("Practice page", () => {
  test("[PRAC-UI-03] a practitioner gets a read-only page", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto(DE_GROUPS);
    await expect(page.getByRole("heading", { level: 1, name: "Digital Engineering" })).toBeVisible();
    await expect(groupSection(page, "Fullstack")).toContainText("Casey Lin");
    for (const name of ["Edit", "New group", "Add member", "Change", "Choose Lead", "Change Manager"]) {
      await expect(page.getByRole("button", { name, exact: true }), name).toHaveCount(0);
    }
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });

  test("[PRAC-UI-04] Manager chooses a Lead for an empty group, then removes them after confirming", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto(DE_GROUPS);
    const mobile = groupSection(page, "Mobile App");
    await mobile.getByRole("button", { name: "Choose Lead" }).click();
    const dialog = page.getByRole("dialog", { name: "Choose the Lead of Mobile App" });
    await dialog.getByRole("radio", { name: /Jesse Monroe/ }).check();
    await dialog.getByRole("button", { name: "Make Lead" }).click();
    await expect(toast(page, "Jesse Monroe is now Lead")).toBeVisible();
    await expect(mobile).toContainText("Jesse Monroe");

    await mobile.getByRole("button", { name: "Remove", exact: true }).click();
    await page.getByRole("dialog", { name: /Remove Jesse Monroe as Lead/ }).getByRole("button", { name: "Remove Lead" }).click();
    await expect(mobile).toContainText("No Lead yet");
  });

  test("[PRAC-UI-05] Manager creates and deletes a group, and moves a member between groups", async ({ page, loginAs }) => {
    const name = unique("Data Platform");
    await loginAs("de.manager");
    await page.goto(DE_PAGE);
    await page.getByRole("tab", { name: "Groups & members" }).click();
    await expect(page).toHaveURL(/\?tab=groups$/);
    await page.getByRole("button", { name: "New group" }).click();
    const dialog = page.getByRole("dialog", { name: "New group in Digital Engineering" });
    await dialog.getByLabel("Name *").fill(name);
    await dialog.getByRole("button", { name: "Create group" }).click();
    await expect(groupSection(page, name)).toContainText("No Lead yet");
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("dialog", { name: `Delete ${name}?` }).getByRole("button", { name: "Delete group" }).click();
    await expect(groupSection(page, name)).toHaveCount(0);

    const select = page.getByLabel("Group for Jesse Monroe");
    await select.selectOption({ label: "Fullstack" });
    await expect(toast(page, "Moved Jesse Monroe to Fullstack")).toBeVisible();
    await expect(groupSection(page, "Fullstack")).toContainText("Jesse Monroe");
    await select.selectOption({ label: "DevOps" }); // put it back
    await expect(groupSection(page, "DevOps")).toContainText("Jesse Monroe");
  });
});

test.describe("Practice Overview", () => {
  test("[PRAC-UI-06] Manager writes the Overview and shares a file; a practitioner reads them without edit controls", async ({ page, loginAs, pageAs, as }) => {
    const api = await as("de.manager");
    const before = (await api.json("/practices/digital-engineering/overview")).body;
    const note = unique("Stand-up at 10:00");
    try {
      await loginAs("de.manager");
      await page.goto(DE_PAGE);
      const about = card(page, "About this practice");
      await about.getByRole("button", { name: "Edit overview" }).click();
      const dialog = page.getByRole("dialog", { name: "Edit the Digital Engineering overview" });
      await dialog.getByLabel("Overview").fill(`## Ways of working\n\n${note}`);
      await dialog.getByRole("button", { name: "Save overview" }).click();
      await expect(toast(page, "Overview saved")).toBeVisible();
      await expect(about.getByRole("heading", { name: "Ways of working" })).toBeVisible();
      await expect(about).toContainText("by Morgan Reyes");

      const files = card(page, "Files");
      await files.locator("input[type=file]").setInputFiles({ name: "onboarding.pdf", mimeType: "application/pdf", buffer: makePdf("onboarding") });
      await expect(files.getByTitle("Open onboarding.pdf")).toBeVisible();

      const dev = await pageAs("de.dev1");
      await dev.goto(DE_PAGE);
      await expect(card(dev, "About this practice")).toContainText(note);
      await expect(card(dev, "Files").getByTitle("Open onboarding.pdf")).toBeVisible();
      for (const name of ["Edit overview", "Upload files", "Remove onboarding.pdf"]) await expect(dev.getByRole("button", { name }), name).toHaveCount(0);

      await files.getByRole("button", { name: "Remove onboarding.pdf" }).click();
      await page.getByRole("dialog", { name: "Remove onboarding.pdf?" }).getByRole("button", { name: "Remove file" }).click();
      await expect(files.getByTitle("Open onboarding.pdf")).toHaveCount(0);
    } finally {
      const left = (await api.json("/practices/digital-engineering/overview")).files.filter((f) => f.fileName === "onboarding.pdf");
      for (const f of left) await api.delete(`/practices/digital-engineering/overview/files/${f.id}`);
      await api.put("/practices/digital-engineering/overview", { body: before });
    }
  });
});

test.describe("Practice and group Contributions, group page", () => {
  const FULLSTACK_PAGE = `${DE_PAGE}/groups/digital-engineering-fullstack`;

  test("[PRAC-UI-08] a practice's Contributions tab lists its contributions; the header starts one from any tab", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto(DE_PAGE);
    const start = page.getByRole("link", { name: "Start a contribution" });
    await expect(start).toBeVisible(); // a page-level CTA, already on the Overview tab
    await page.getByRole("tab", { name: "Contributions" }).click();
    await expect(page).toHaveURL(/tab=contributions/);
    const list = card(page, "Contributions");
    await expect(list.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true");
    await expect(list.getByLabel("Practice", { exact: true })).toHaveCount(0); // already one practice
    await expect(start).toHaveCount(1); // only the header one, not a second inside the tab
    await start.click();
    await expect(page).toHaveURL(/\/practices\/contributions\/new\?practice=digital-engineering$/);
    await page.getByRole("link", { name: "← Contributions" }).click();
    await expect(page).toHaveURL(/\/practices\/digital-engineering\?tab=contributions$/);
  });

  test("[PRAC-UI-09] a group's Lead opens their group and runs it: Overview, Members, Contributions", async ({ page, loginAs }) => {
    await loginAs("de.lead");
    await page.goto(DE_GROUPS);
    await expect(page.getByRole("link", { name: "Start a contribution" })).toHaveAttribute("href", /practice=digital-engineering$/);
    await groupSection(page, "Fullstack").getByRole("link", { name: "Open Fullstack" }).click();
    await expect(page).toHaveURL(new RegExp(`${FULLSTACK_PAGE}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Fullstack" })).toBeVisible();
    await expect(page.getByText("Casey Lin").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
    await expect(card(page, "About this group").getByRole("button", { name: "Edit overview" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Rename" })).toHaveCount(0); // renaming stays with the Manager

    await page.getByRole("tab", { name: "Members" }).click();
    const members = card(page, "Members");
    await expect(members.getByRole("row", { name: /Riley Patel/ })).toBeVisible();
    await expect(members.getByRole("button", { name: "Remove Riley Patel from Fullstack" })).toBeVisible();
    await expect(members.getByRole("button", { name: "Remove Casey Lin from Fullstack" })).toHaveCount(0); // the Lead
    await expect(members.getByRole("button", { name: "Add member" })).toBeVisible();

    await expect(page.getByRole("link", { name: "Start a contribution" })).toHaveAttribute("href", /group=digital-engineering-fullstack/);
    await page.getByRole("tab", { name: "Contributions" }).click();
    await expect(card(page, "Contributions").getByRole("tab", { name: "Awaiting my review" })).toBeVisible();
  });

  test("[PRAC-UI-10] a member of another group reads the group page without controls", async ({ page, loginAs }) => {
    await loginAs("de.dev2");
    await page.goto(FULLSTACK_PAGE);
    await expect(page.getByRole("heading", { level: 1, name: "Fullstack" })).toBeVisible();
    await expect(card(page, "About this group")).toBeVisible();
    for (const name of ["Edit overview", "Upload files", "Change Lead", "Rename"]) await expect(page.getByRole("button", { name }), name).toHaveCount(0);
    await page.getByRole("tab", { name: "Members" }).click();
    await expect(card(page, "Members").getByRole("row", { name: /Riley Patel/ })).toBeVisible();
    for (const name of ["Add member", "Remove Riley Patel from Fullstack"]) await expect(page.getByRole("button", { name }), name).toHaveCount(0);
    // Anyone who can contribute in the practice may start one from here, whichever tab is open.
    await expect(page.getByRole("link", { name: "Start a contribution" })).toBeVisible();
  });

  test("[PRAC-UI-11] a Lead adds someone who isn't in a group, then removes them again", async ({ page, loginAs, as }) => {
    const manager = await as("de.manager");
    const dev2 = (await manager.json("/practices/digital-engineering")).members.find((m) => m.username === "de.dev2");
    const put = (groupId) => manager.put(`/practices/digital-engineering/members/${dev2.id}`, { groupId });
    await put(null);
    try {
      await loginAs("de.lead");
      await page.goto(`${FULLSTACK_PAGE}?tab=members`);
      const members = card(page, "Members");
      await members.getByRole("button", { name: "Add member" }).click();
      const dialog = page.getByRole("dialog", { name: "Add someone to Fullstack" });
      const jesse = dialog.getByRole("radio", { name: /Jesse Monroe· not in a group/ });
      await expect(jesse).toBeVisible();
      await expect(dialog.getByRole("radio", { name: /Blair Kim/ })).toHaveCount(0); // in DevOps: another Lead's group
      await expect(dialog.getByRole("radio", { name: /Morgan Reyes/ })).toHaveCount(0); // the Manager oversees every group
      await jesse.check();
      await dialog.getByRole("button", { name: "Add to group" }).click();
      await expect(toast(page, "Added Jesse Monroe to Fullstack")).toBeVisible();
      await expect(members.getByRole("row", { name: /Jesse Monroe/ })).toBeVisible();

      await members.getByRole("button", { name: "Remove Jesse Monroe from Fullstack" }).click();
      await page.getByRole("dialog", { name: "Remove Jesse Monroe from Fullstack?" }).getByRole("button", { name: "Remove from group" }).click();
      await expect(toast(page, "Jesse Monroe is no longer in Fullstack")).toBeVisible();
      await expect(members.getByRole("row", { name: /Jesse Monroe/ })).toHaveCount(0);
    } finally {
      await put("digital-engineering-devops");
    }
  });
});
