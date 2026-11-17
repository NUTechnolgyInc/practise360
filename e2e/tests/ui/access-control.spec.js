// AC-UI — Access control portal: user directory, grant/revoke with the escalation guard, custom roles, system roles.
const { test, expect, unique } = require("../../support/fixtures");
const { SEED_USER_COUNT } = require("../../support/users");

const userRow = (page, name) => page.getByRole("row").filter({ hasText: name });
const toast = (page, text) => page.locator("[role=status],[role=alert]").filter({ hasText: text });

test.describe("Access control — users", () => {
  test("[AC-UI-01] Super Admin sees every user, can search by name or username, and gets an empty state for no match", async ({ page, loginAs }) => {
    await loginAs("superadmin");
    await page.goto("/access-control");
    await expect(page.getByRole("heading", { name: "Access control" })).toBeVisible();
    await page.getByRole("button", { name: "Show stats" }).click(); // count tiles start hidden
    await expect(page.locator("dl,div").filter({ hasText: /^Users/ }).getByText(String(SEED_USER_COUNT), { exact: true }).first()).toBeVisible();
    const search = page.getByLabel("Search users");
    await search.fill("riley");
    await expect(page.getByRole("row")).toHaveCount(2); // header + Riley Patel
    await expect(userRow(page, "Riley Patel")).toContainText("Practitioner @ Digital Engineering");
    await search.fill("QA.LEAD");
    await expect(userRow(page, "Rowan Ellis")).toBeVisible();
    await search.fill("zzz-nobody");
    await expect(page.getByRole("heading", { name: "No users match" })).toBeVisible();
  });

  test("[AC-UI-02] Practice Manager's grant form only offers their practice (and its groups) and never 'Practice Manager'", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Jamie Fox").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await expect(dialog).toBeVisible();
    const scope = dialog.getByLabel("Scope");
    await expect(scope.locator("option")).toHaveText([
      "Select a scope",
      "Digital Engineering",
      "Digital Engineering · DevOps",
      "Digital Engineering · Fullstack",
      "Digital Engineering · Mobile App",
    ]);
    await scope.selectOption({ label: "Digital Engineering" });
    const roles = await dialog.getByLabel("Role").locator("option").allTextContents();
    expect(roles).toEqual(expect.arrayContaining(["Practitioner", "Practice Coordinator"]));
    expect(roles).not.toContain("Practice Manager");
    expect(roles).not.toContain("Practice Lead"); // Leads are granted on a group
    await scope.selectOption({ label: "Digital Engineering · Mobile App" });
    await expect(dialog.getByLabel("Role")).toHaveValue("practice_lead"); // the only role there, pre-selected
    await expect(dialog.getByText("None in your scopes").or(dialog.getByText("No roles in your scopes"))).toBeVisible(); // QA roles are hidden from a DE manager
  });

  test("[AC-UI-03] Practice Manager grants a role, sees it immediately, then removes it after confirming", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Jamie Fox").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    const grantButton = dialog.getByRole("button", { name: "Grant role" });
    await expect(grantButton).toBeDisabled(); // nothing picked yet
    await dialog.getByLabel("Scope").selectOption({ label: "Digital Engineering" });
    await dialog.getByLabel("Role").selectOption({ label: "Practitioner" });
    await grantButton.click();
    await expect(toast(page, "Granted Practitioner @ Digital Engineering")).toBeVisible();
    const current = dialog.getByRole("listitem");
    await expect(current.filter({ hasText: "Practitioner" })).toBeVisible();

    await dialog.getByRole("button", { name: "Remove Practitioner at Digital Engineering" }).click();
    const confirm = page.getByRole("dialog", { name: "Remove role?" });
    await expect(confirm).toContainText("Jamie Fox will lose Practitioner in Digital Engineering");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(current.filter({ hasText: "Practitioner" })).toBeVisible(); // cancel kept it
    await dialog.getByRole("button", { name: "Remove Practitioner at Digital Engineering" }).click();
    await page.getByRole("dialog", { name: "Remove role?" }).getByRole("button", { name: "Remove role" }).click();
    await expect(toast(page, "Removed Practitioner @ Digital Engineering")).toBeVisible();
    await expect(current.filter({ hasText: "Practitioner" })).toHaveCount(0);
  });

  test("[AC-UI-04] granting a role the user already has shows the conflict instead of duplicating it", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Casey Lin").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await dialog.getByLabel("Scope").selectOption({ label: "Digital Engineering" });
    await dialog.getByLabel("Role").selectOption({ label: "Practitioner" });
    await dialog.getByRole("button", { name: "Grant role" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Casey Lin already has Practitioner there" })).toBeVisible();
    await expect(dialog.getByRole("listitem").filter({ hasText: "Practitioner" })).toHaveCount(1);
  });

  test("[AC-UI-04b] a group already has a Lead: granting a second one points to the Practices page", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Riley Patel").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await dialog.getByLabel("Scope").selectOption({ label: "Digital Engineering · Fullstack" });
    await dialog.getByRole("button", { name: "Grant role" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already has a Practice Lead (Casey Lin)" })).toBeVisible();
  });

  test("[AC-UI-05] a Manager can't remove a fellow Manager: no remove button on Manager assignments", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Morgan Reyes").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await expect(dialog.getByRole("listitem").filter({ hasText: "Practice Manager" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Remove Practice Manager/ })).toHaveCount(0);
  });

  test("[AC-UI-06] a Lead can look but not change: View buttons and an explanation instead of the grant form", async ({ page, loginAs }) => {
    await loginAs("de.lead");
    await page.goto("/access-control");
    await expect(page.getByRole("button", { name: "Manage" })).toHaveCount(0);
    await userRow(page, "Riley Patel").getByRole("button", { name: "View" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await expect(dialog.getByText(/You can't grant roles/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  });

  test("[AC-UI-07] the Manage dialog closes with Escape and with the close button", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control");
    await userRow(page, "Riley Patel").getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await userRow(page, "Riley Patel").getByRole("button", { name: "Manage" }).click();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("[AC-UI-08] Practices Admin picks a practice first, then sees only roles grantable there", async ({ page, loginAs }) => {
    await loginAs("practices.admin");
    await page.goto("/access-control");
    await userRow(page, "Jamie Fox").getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog", { name: "Manage access" });
    await expect(dialog.getByLabel("Role")).toBeDisabled();
    await expect(dialog.getByLabel("Role")).toContainText("Pick a scope first");
    await dialog.getByLabel("Scope").selectOption({ label: "QA" });
    const roles = await dialog.getByLabel("Role").locator("option").allTextContents();
    expect(roles).toEqual(["Select a role", "Practice Manager", "Practitioner"]); // Lead is granted on a group
    expect(roles).not.toContain("Practice Coordinator"); // custom role belongs to DE
  });
});

test.describe("Access control — tabs, roles and matrix", () => {
  test("[AC-UI-09] tabs are reflected in the URL and an unknown tab falls back to Users", async ({ page, loginAs }) => {
    await loginAs("superadmin");
    await page.goto("/access-control?tab=roles");
    await expect(page.getByRole("tab", { name: "Roles" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Permissions" }).click();
    await expect(page).toHaveURL(/tab=matrix/);
    await expect(page.getByRole("heading", { name: "Permission matrix" })).toBeVisible();
    await page.goto("/access-control?tab=bogus");
    await expect(page.getByRole("tab", { name: "Users" })).toHaveAttribute("aria-selected", "true");
  });

  test("[AC-UI-10] permission matrix marks what each role carries", async ({ page, loginAs }) => {
    await loginAs("superadmin");
    await page.goto("/access-control?tab=matrix");
    const row = page.getByRole("row").filter({ hasText: "practices.contribution.approve" });
    await expect(row.getByLabel("Granted").first()).toBeVisible();
    await expect(row.getByLabel("Not granted").first()).toBeVisible();
  });

  test("[AC-UI-11] Practice Manager creates a custom role, sees it listed, then deletes it", async ({ page, loginAs }) => {
    const name = unique("E2E Reviewer");
    await loginAs("de.manager");
    await page.goto("/access-control?tab=roles");
    await page.getByRole("button", { name: "New custom role" }).click();
    const dialog = page.getByRole("dialog", { name: "New custom role" });
    const save = dialog.getByRole("button", { name: "Save role" });
    await expect(save).toBeDisabled();
    await dialog.getByLabel("Name", { exact: true }).fill(name); // exact: permission labels like "…rename…" also match
    await expect(save).toBeDisabled(); // still needs a permission
    await dialog.getByRole("checkbox", { name: /practices\.members\.view/ }).check();
    await expect(dialog.getByRole("checkbox", { name: /platform\./ })).toHaveCount(0); // never offered
    await save.click();
    await expect(toast(page, `Created ${name}`)).toBeVisible();
    const card = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name }) });
    await expect(card).toContainText("Custom");
    await expect(card).toContainText("practices.members.view");

    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await page.getByRole("dialog", { name: "Delete custom role?" }).getByRole("button", { name: "Delete role" }).click();
    await expect(toast(page, `Deleted ${name}`)).toBeVisible();
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
  });

  test("[AC-UI-12] a blank (spaces-only) custom role name can't be saved", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control?tab=roles");
    await page.getByRole("button", { name: "New custom role" }).click();
    const dialog = page.getByRole("dialog", { name: "New custom role" });
    await dialog.getByLabel("Name", { exact: true }).fill("    ");
    await dialog.getByRole("checkbox").first().check();
    await expect(dialog.getByRole("button", { name: "Save role" })).toBeDisabled();
  });

  test("[AC-UI-13] deleting a custom role that's still assigned explains why it can't", async ({ page, loginAs }) => {
    await loginAs("de.manager");
    await page.goto("/access-control?tab=roles");
    await page.getByRole("button", { name: "Delete Practice Coordinator" }).click();
    await page.getByRole("dialog", { name: "Delete custom role?" }).getByRole("button", { name: "Delete role" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "assigned to 1 user(s)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Practice Coordinator" })).toBeVisible();
  });

  test("[AC-UI-14] only Super Admin gets edit buttons on system roles, and Super Admin itself is locked", async ({ page, loginAs, pageAs }) => {
    await loginAs("superadmin");
    await page.goto("/access-control?tab=roles");
    await expect(page.getByRole("button", { name: "Edit Practitioner" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Super Admin" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete Practitioner" })).toHaveCount(0); // system roles can't be deleted

    const manager = await pageAs("de.manager");
    await manager.goto("/access-control?tab=roles");
    await expect(manager.getByRole("heading", { name: /^Practitioner/ })).toBeVisible();
    await expect(manager.getByRole("button", { name: "Edit Practitioner" })).toHaveCount(0);
    await expect(manager.getByRole("button", { name: "Edit Practice Coordinator" })).toBeVisible();
  });

  test("[AC-UI-15] Super Admin's system-role editor warns about the escalation guard and keeps platform.* off practice roles", async ({ page, loginAs }) => {
    await loginAs("superadmin");
    await page.goto("/access-control?tab=roles");
    await page.getByRole("button", { name: "Edit Practitioner" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit system role" });
    await expect(dialog).toContainText("Scope stays practice");
    await expect(dialog.getByRole("checkbox", { name: /platform\.users\.manage/ })).toHaveCount(0);
    await expect(dialog.getByRole("checkbox", { name: /practices\.contribution\.create/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("[AC-UI-16] a Lead (roles.view only) sees roles but no 'New custom role' button", async ({ page, loginAs }) => {
    await loginAs("de.lead");
    await page.goto("/access-control?tab=roles");
    await expect(page.getByRole("heading", { name: "Practice Coordinator" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New custom role" })).toHaveCount(0);
  });
});
