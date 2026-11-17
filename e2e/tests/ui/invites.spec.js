// INV-UI — inviting someone by email from a person picker, and joining from the link (docs/rbac.md §4 "Invitations").
const { test, expect } = require("../../support/fixtures");
const { removeInvited } = require("../../support/db");
const { card } = require("../../support/ui");

const groupSection = (page, name) => page.getByRole("region", { name });
const used = [];
const newEmail = (label) => {
  const email = `${label}.${Date.now().toString(36)}@example.org`;
  used.push(email);
  return email;
};

test.afterAll(async () => removeInvited(used));

test("[INV-UI-01] Manager invites a new member by email; they join from the link and land in the practice", async ({ page, loginAs, browser }) => {
  const email = newEmail("ivy");
  await loginAs("de.manager");
  await page.goto("/practices/digital-engineering?tab=groups");
  await page.getByRole("button", { name: "Add member" }).click();
  const dialog = page.getByRole("dialog", { name: "Add people to Digital Engineering" });
  await dialog.getByRole("searchbox").fill(email);
  await dialog.getByRole("radio", { name: `Invite ${email}` }).check();
  await dialog.getByLabel("Group").selectOption({ label: "Mobile App" });
  await dialog.getByRole("button", { name: "Send invite" }).click();

  // No mail server on the e2e stack, so the join link is handed to the inviter.
  const sent = page.getByRole("dialog", { name: `Invitation ready for ${email}` });
  const link = await sent.getByLabel("Join link").inputValue();
  expect(link).toMatch(/\/invite\/[\w-]{40,}$/);
  await sent.getByRole("button", { name: "Done" }).click();
  await expect(card(page, "Pending invitations")).toContainText(email);
  await expect(card(page, "Pending invitations")).toContainText("a member of Digital Engineering (Mobile App)");

  // The invitee, in their own browser with no session.
  const context = await browser.newContext();
  try {
    const invitee = await context.newPage();
    await invitee.goto(link);
    await expect(invitee.getByRole("heading", { name: "You're invited" })).toBeVisible();
    await expect(invitee.getByText("Morgan Reyes invited you")).toBeVisible();
    await expect(invitee.getByLabel("Email")).toHaveValue(email);
    await invitee.getByLabel("Your name").fill("Ivy Tester");
    await invitee.getByRole("button", { name: "Join Practise360" }).click();
    await expect(invitee).toHaveURL(/\/practices\/digital-engineering$/);
    await expect(invitee.getByRole("heading", { level: 1, name: "Digital Engineering" })).toBeVisible();

    // The link is spent.
    await invitee.goto(link);
    await expect(invitee.getByText("This invitation has already been used")).toBeVisible();
  } finally {
    await context.close();
  }

  await page.reload();
  await expect(groupSection(page, "Mobile App")).toContainText("Ivy Tester");
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
