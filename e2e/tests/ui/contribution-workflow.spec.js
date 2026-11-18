// WF-UI — multi-person journeys on one contribution: owner ↔ Lead ↔ Manager, clarifications, declines, invites, joins.
// Each person gets their own browser context, like separate laptops.
const { test, expect, unique } = require("../../support/fixtures");
const { makePdf } = require("../../support/files");
const { createContribution, inLeadReview } = require("../../support/contributions");
const { card, toast, acceptNextDialog, expectStatus } = require("../../support/ui");

const open = (page, c) => page.goto(`/practices/contributions/${c.id}`);

/** Opens the review dialog and records a decision. */
async function decide(page, buttonName, decision, comment) {
  await page.getByRole("button", { name: buttonName, exact: true }).click();
  const dialog = page.getByRole("dialog");
  if (decision !== "Approve") await dialog.getByRole("radiogroup").getByText(decision, { exact: true }).click();
  if (comment) await dialog.getByLabel(/Comment/).fill(comment);
  return dialog;
}

test.describe("Review workflow", () => {
  test("[WF-UI-01] practitioner submits → Lead approves → Manager approves & publishes", async ({ page, loginAs, as, pageAs }) => {
    const title = unique("Release kit");
    const c = await createContribution(await as("de.dev1"), { title });

    // Owner: attach a document from inside the submit dialog and hand it in.
    await loginAs("de.dev1");
    await open(page, c);
    await page.getByRole("button", { name: "Submit for review" }).click();
    const submit = page.getByRole("dialog", { name: "Submit for review" });
    await submit.locator("input[type=file]").setInputFiles({ name: "write-up.pdf", mimeType: "application/pdf", buffer: makePdf("write-up") });
    await expect(submit.getByTitle("Open write-up.pdf")).toBeVisible();
    await submit.getByLabel("Summary *").fill("A reusable release pipeline for Next.js apps.");
    await submit.getByLabel("Impact *").fill("Cuts release prep from a day to an hour.");
    await submit.getByLabel("Repository link").fill("https://git.example.com/release-kit");
    await submit.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(toast(page, "Submitted for review")).toBeVisible();
    await expectStatus(page, "Lead review");
    await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);
    await expect(card(page, "Submission")).toContainText("Cuts release prep from a day to an hour.");

    // Lead: finds it in the queue and approves.
    const lead = await pageAs("de.lead");
    await lead.goto("/practices/contributions?tab=review");
    const row = lead.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Awaiting your review");
    await row.getByRole("link", { name: title }).click();
    const leadDialog = await decide(lead, "Review", "Approve");
    await expect(leadDialog).toContainText("Step 1 of 2");
    await leadDialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expect(toast(lead, "Approved — sent to the Practice Manager")).toBeVisible();
    await expectStatus(lead, "Manager review");

    // Manager: final approval publishes it.
    const manager = await pageAs("de.manager");
    await open(manager, c);
    const managerDialog = await decide(manager, "Final approval", "Approve");
    await expect(managerDialog).toContainText("Step 2 of 2");
    await managerDialog.getByRole("button", { name: "Approve & publish" }).click();
    await expect(toast(manager, "Approved and published")).toBeVisible();
    await expectStatus(manager, "Published");
    await expect(card(manager, "Review progress")).toContainText("Approved by Casey Lin");
    await expect(card(manager, "Review progress")).toContainText("Approved by Morgan Reyes");
    await expect(card(manager, "Progress & activity")).toContainText("published it");

    // Owner's view after publishing: read-only.
    await page.reload();
    await expectStatus(page, "Published");
    await expect(page.getByRole("button", { name: "Post update" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  });

  test("[WF-UI-02] Lead asks for clarification; owner must reply before resubmitting; it returns to the Lead", async ({ page, loginAs, as, pageAs }) => {
    const c = await inLeadReview(await as("de.dev1"));
    const lead = await pageAs("de.lead");
    await open(lead, c);
    const dialog = await decide(lead, "Review", "Ask for clarification");
    await dialog.getByRole("button", { name: "Ask for clarification" }).click();
    await expect(dialog.getByText("Explain what's missing or why it's declined")).toBeVisible(); // comment is required
    await dialog.getByLabel(/Comment/).fill("Which client projects already use it?");
    await dialog.getByRole("button", { name: "Ask for clarification" }).click();
    await expect(toast(lead, "Decision recorded")).toBeVisible();
    await expectStatus(lead, "Clarification needed");
    await expect(lead.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);

    await loginAs("de.dev1");
    await open(page, c);
    await expect(page.getByText("Casey Lin asked for clarification")).toBeVisible();
    await expect(page.getByText("Which client projects already use it?").first()).toBeVisible();
    await page.getByRole("button", { name: "Reply and resubmit" }).click();
    const resubmit = page.getByRole("dialog", { name: "Reply and resubmit" });
    await resubmit.getByRole("button", { name: "Resubmit" }).click();
    await expect(resubmit.getByText("Answer the reviewer's question")).toBeVisible();
    await resubmit.getByLabel("Your reply to the reviewer *").fill("Used on Atlas and Borealis.");
    await resubmit.getByRole("button", { name: "Resubmit" }).click();
    await expect(toast(page, "Resubmitted")).toBeVisible();
    await expectStatus(page, "Lead review");

    await lead.reload();
    await expect(lead.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  });

  test("[WF-UI-03] a declined contribution is closed for the owner", async ({ page, loginAs, as, pageAs }) => {
    const c = await inLeadReview(await as("de.dev1"));
    const lead = await pageAs("de.lead");
    await open(lead, c);
    const dialog = await decide(lead, "Review", "Decline", "Duplicates the existing auth framework.");
    await dialog.getByRole("button", { name: "Decline" }).click();
    await expect(toast(lead, "Decision recorded")).toBeVisible();

    await loginAs("de.dev1");
    await open(page, c);
    await expectStatus(page, "Declined");
    await expect(page.getByText("Declined — see the reviewer's comment in the activity log.")).toBeVisible();
    await expect(card(page, "Progress & activity")).toContainText("Duplicates the existing auth framework.");
    for (const name of ["Submit for review", "Reply and resubmit", "Post update", "Edit"]) {
      await expect(page.getByRole("button", { name }), name).toHaveCount(0);
    }
  });

  test("[WF-UI-04] the owner never gets a Review button on their own work; the Manager takes the Lead step", async ({ page, loginAs, as, pageAs }) => {
    const c = await inLeadReview(await as("de.lead"));
    await loginAs("de.lead");
    await open(page, c);
    await expectStatus(page, "Lead review");
    await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveCount(0);
    const manager = await pageAs("de.manager");
    await open(manager, c);
    const dialog = await decide(manager, "Review", "Approve");
    await dialog.getByRole("button", { name: "Approve", exact: true }).click();
    await expectStatus(manager, "Manager review");
    // Having done the Lead step, the Manager can't also give final approval.
    await expect(manager.getByRole("button", { name: "Final approval" })).toHaveCount(0);
  });

  test("[WF-UI-05] closing the review dialog with Cancel records nothing", async ({ as, pageAs }) => {
    const c = await inLeadReview(await as("de.dev1"));
    const lead = await pageAs("de.lead");
    await open(lead, c);
    const dialog = await decide(lead, "Review", "Decline", "Not sure yet");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(lead.getByRole("dialog")).toHaveCount(0);
    await expectStatus(lead, "Lead review");
  });
});

test.describe("People on a contribution", () => {
  test("[WF-UI-06] ask to join → owner accepts → the new contributor can log progress and leave", async ({ page, loginAs, as, pageAs }) => {
    const c = await createContribution(await as("de.lead"));
    await loginAs("de.dev1");
    await open(page, c);
    await page.getByRole("button", { name: "Ask to join" }).click();
    const join = page.getByRole("dialog", { name: "Ask to join" });
    await join.getByLabel("Message (optional)").fill("I can write the integration tests");
    await join.getByRole("button", { name: "Send request" }).click();
    await expect(toast(page, "Request sent")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel join request" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask to join" })).toHaveCount(0);

    const owner = await pageAs("de.lead");
    await open(owner, c);
    const people = card(owner, "People");
    await expect(people).toContainText("Asked to join");
    await expect(people).toContainText("I can write the integration tests");
    await people.getByRole("button", { name: "Accept" }).click();
    await expect(toast(owner, "Riley Patel added")).toBeVisible();
    await expect(people).toContainText("Contributor");

    await page.reload();
    await expect(page.getByRole("button", { name: "Post update" })).toBeDisabled(); // composer is there for contributors
    acceptNextDialog(page);
    await card(page, "People").getByRole("button", { name: "Leave contribution" }).click();
    await expect(toast(page, "You left this contribution")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
  });

  test("[WF-UI-07] a join request can be cancelled by the requester", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.lead"));
    await loginAs("de.dev1");
    await open(page, c);
    await page.getByRole("button", { name: "Ask to join" }).click();
    await page.getByRole("dialog", { name: "Ask to join" }).getByRole("button", { name: "Send request" }).click();
    await page.getByRole("button", { name: "Cancel join request" }).click();
    await expect(toast(page, "Request cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
  });

  test("[WF-UI-08] owner invites a practice member, who declines; the invite picker only lists practice members", async ({ page, loginAs, as, pageAs }) => {
    const c = await createContribution(await as("de.lead"));
    await loginAs("de.lead");
    await open(page, c);
    const people = card(page, "People");
    await people.getByRole("button", { name: "Invite people" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite people to contribute" });
    // DE only (across its groups), owner excluded
    await expect(dialog.getByRole("checkbox")).toHaveCount(4);
    for (const name of ["Blair Kim", "Jesse Monroe", "Morgan Reyes", "Riley Patel"]) await expect(dialog.getByText(name, { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Invite people" })).toBeDisabled();
    await dialog.getByRole("checkbox", { name: /Riley Patel/ }).check();
    await dialog.getByRole("button", { name: "Invite 1 person" }).click();
    await expect(toast(page, "Invite sent")).toBeVisible();
    await expect(people).toContainText("Invited by Casey Lin");
    await expect(people.getByText("Pending")).toBeVisible();

    const invitee = await pageAs("de.dev1");
    await open(invitee, c);
    await expect(invitee.getByText("You've been invited to contribute.")).toBeVisible();
    await invitee.getByRole("button", { name: "Decline invite" }).click();
    await expect(toast(invitee, "Invite declined")).toBeVisible();
    await expect(invitee.getByRole("button", { name: "Accept invite" })).toHaveCount(0);

    await page.reload();
    await expect(people).not.toContainText("Pending");
    await expect(card(page, "Progress & activity")).toContainText("declined the invite");
  });

  test("[WF-UI-09] invitee accepts; owner removes them after confirming", async ({ page, loginAs, as, pageAs }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    const devId = (await (await as("de.dev1")).me()).id;
    await lead.post(`/contributions/${c.id}/invites`, { userId: devId });

    const invitee = await pageAs("de.dev1");
    await open(invitee, c);
    await invitee.getByRole("button", { name: "Accept invite" }).click();
    await expect(toast(invitee, "You're now a contributor")).toBeVisible();

    await loginAs("de.lead");
    await open(page, c);
    acceptNextDialog(page);
    await card(page, "People").getByRole("button", { name: "Remove Riley Patel" }).click();
    await expect(toast(page, "Riley Patel removed")).toBeVisible();
    await expect(card(page, "People")).toContainText("1 working on this");
  });
});
