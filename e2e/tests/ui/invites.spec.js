// INV-UI — inviting someone by email from a person picker, and joining from the link (docs/rbac.md §4 "Invitations").
const { test, expect } = require("../../support/fixtures");
const { removeInvited } = require("../../support/db");
const { card, toast } = require("../../support/ui");

const groupSection = (page, name) => page.getByRole("region", { name });
const used = [];
const newEmail = (label) => {
  const email = `${label}.${Date.now().toString(36)}@example.org`;
  used.push(email);
  return email;
};

test.afterAll(async () => removeInvited(used));

test("[INV-UI-01] Manager invites a new member by email; signing in with that email lands them in the practice", async ({ page, loginAs, browser }) => {
  const email = newEmail("ivy");
  await loginAs("de.manager");
  await page.goto("/practices/digital-engineering?tab=groups");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add people to Digital Engineering" });
  await dialog.getByRole("searchbox").fill(email);
  await dialog.getByRole("checkbox", { name: `Invite ${email}` }).check();
  await dialog.getByLabel("Group").selectOption({ label: "Mobile App" });
  await dialog.getByRole("button", { name: "Add 1 person" }).click();

  // No join link is handed out any more (owner 2026-11-18): signing in with the email is enough.
  await expect(toast(page, "Invited 1 to Digital Engineering")).toBeVisible();
  await expect(card(page, "Pending invitations")).toContainText(email);
  await expect(card(page, "Pending invitations")).toContainText("a member of Digital Engineering (Mobile App)");

  // The invitee, in their own browser with no session. No Google on the e2e stack, so the dev login creates the account.
  const context = await browser.newContext();
  try {
    const invitee = await context.newPage();
    await invitee.goto("/login");
    await invitee.getByLabel("Username or email").fill(email);
    await invitee.getByLabel("Password").fill("password");
    await invitee.getByRole("button", { name: "Sign in" }).click();
    await invitee.goto("/practices/digital-engineering");
    await expect(invitee.getByRole("heading", { level: 1, name: "Digital Engineering" })).toBeVisible();
  } finally {
    await context.close();
  }

  await page.reload();
  await expect(groupSection(page, "Mobile App")).toContainText("Ivy"); // name derived from the email: "Ivy …"
  await expect(page.getByRole("heading", { name: "Pending invitations" })).toHaveCount(0);
});

test("[INV-UI-02] the Manager picker finds existing people by email and offers to invite new ones", async ({ page, loginAs }) => {
  await loginAs("practices.admin");
  await page.goto("/practices/digital-engineering");
  await page.getByRole("button", { name: "Change Manager" }).click();
  const dialog = page.getByRole("dialog", { name: "Choose the Manager of Digital Engineering" });
  // An email that's already on Practise360 finds the person instead of offering an invitation.
  await dialog.getByRole("searchbox").fill("de.dev2@example.com");
  await expect(dialog.getByRole("radio", { name: /Jesse Monroe/ })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /^Invite/ })).toHaveCount(0);
  // A new one offers it.
  const email = newEmail("rowan");
  await dialog.getByRole("searchbox").fill(email);
  await dialog.getByRole("radio", { name: `Invite ${email}` }).check();
  await expect(dialog.getByRole("button", { name: "Send invite" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
});
