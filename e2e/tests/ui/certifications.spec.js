// CERT-UI — Certification Tracker in the browser: tabs per role, add a plan, assign/recommend, completion with
// reimbursement, Lead → Manager approval, rejection, isolation, phone width. Each person gets their own browser context.
const { test, expect, unique, isoDay } = require("../../support/fixtures");
const { makePdf } = require("../../support/files");
const { ok, DE, createPlan, decide, inCertLeadReview, memberId } = require("../../support/certs");
const { card, toast, expectStatus } = require("../../support/ui");

const open = (page, plan) => page.goto(`/certifications/plans/${plan.id}`);
const tabs = (page) => page.getByRole("tablist", { name: "Certification views" }).getByRole("tab");

test.describe("Certification Tracker — screens per role", () => {
  test("[CERT-UI-01] practitioner: My plans + Catalog, no team or review tabs, adds a plan from the catalog", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/certifications");
    await expect(tabs(page)).toHaveText(["My plans", "Catalog"]);
    await expect(page.getByRole("button", { name: "Assign or recommend" })).toHaveCount(0);

    await page.getByRole("button", { name: "Add a plan" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a plan" });
    await dialog.getByRole("button", { name: "Add plan" }).click();
    await expect(dialog.getByText("Pick one from the catalog")).toBeVisible();
    await expect(dialog.getByText("Pick a due date")).toBeVisible();

    await dialog.getByRole("button", { name: /Not in the catalog/ }).click();
    const title = unique("UI one-off course");
    await dialog.getByLabel("Name *").fill(title);
    await dialog.getByLabel("Type *").selectOption("course");
    await dialog.getByLabel("Due date *").fill(isoDay(21));
    await dialog.getByLabel("Notes").fill("Evenings, two chapters a week");
    await dialog.getByRole("button", { name: "Add plan" }).click();
    await expect(toast(page, "Plan added")).toBeVisible();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expectStatus(page, "Planned");
    await expect(page.getByRole("button", { name: "Submit completion" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drop plan" })).toBeVisible();
  });

  test("[CERT-UI-02] Lead: four tabs; assigns a new cert to a member, who can't drop it", async ({ page, loginAs, pageAs }) => {
    await loginAs("de.lead");
    await page.goto("/certifications?tab=team");
    await expect(tabs(page)).toHaveText(["My plans", "Team", "Awaiting my review", "Catalog"]);
    await page.getByRole("button", { name: "Assign or recommend" }).click();
    const dialog = page.getByRole("dialog", { name: "Assign or recommend" });
    await dialog.getByText("Assign", { exact: true }).click();
    await dialog.getByRole("listitem").filter({ hasText: "de.dev1" }).getByRole("checkbox").check();
    await dialog.getByRole("button", { name: /Not in the catalog/ }).click();
    const title = unique("UI Assigned Security Cert");
    await dialog.getByLabel("Name *").fill(title);
    await dialog.getByRole("button", { name: "Assign to 1" }).click();
    await expect(dialog.getByText("An assignment needs a due date")).toBeVisible();
    await dialog.getByLabel("Due date *").fill(isoDay(45));
    await dialog.getByRole("button", { name: "Assign to 1" }).click();
    await expect(toast(page, "Assigned to 1 person")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Assigned by Casey Lin");

    const dev = await pageAs("de.dev1");
    await dev.goto("/certifications");
    await dev.getByRole("link", { name: title }).click();
    await expectStatus(dev, "Planned");
    await expect(dev.getByRole("button", { name: "Submit completion" })).toBeVisible();
    await expect(dev.getByRole("button", { name: "Drop plan" })).toHaveCount(0);
  });

  test("[CERT-UI-03] member accepts a recommendation with their own dates", async ({ page, loginAs, as }) => {
    const devId = await memberId(as, DE, "de.dev1");
    const { created } = await ok(await (await as("de.manager")).post("/certifications/assignments", { mode: "suggest", practiceId: DE, userIds: [devId], cert: { title: unique("UI Recommended"), type: "course" }, note: "Great for the platform work" }), "suggest");
    await loginAs("de.dev1");
    await page.goto("/certifications");
    await expect(card(page, "Recommended for you")).toContainText(created[0].cert.title);
    await open(page, created[0]);
    await expect(page.getByText("Morgan Reyes recommended this to you")).toBeVisible();
    await page.getByRole("button", { name: "Accept" }).click();
    const dialog = page.getByRole("dialog", { name: "Accept recommendation" });
    await dialog.getByLabel("Due date *").fill(isoDay(30));
    await dialog.getByRole("button", { name: "Accept" }).click();
    await expect(toast(page, "Added to your plans")).toBeVisible();
    await expectStatus(page, "Planned");
  });
});

test.describe("Certification Tracker — approval", () => {
  test("[CERT-UI-04] member submits with a reimbursement claim → Lead approves → Manager approves & completes", async ({ page, loginAs, as, pageAs }) => {
    const plan = await createPlan(await as("de.dev1"));
    await loginAs("de.dev1");
    await open(page, plan);
    await page.getByRole("button", { name: "Submit completion" }).click();
    const dialog = page.getByRole("dialog", { name: "Submit completion" });
    await dialog.getByLabel("Verification link *").fill("https://verify.example.com/ui-04");
    await dialog.locator("input[type=file]").first().setInputFiles({ name: "certificate.pdf", mimeType: "application/pdf", buffer: makePdf("certificate") });
    await expect(dialog.getByTitle("Open certificate.pdf")).toBeVisible();
    await dialog.getByLabel("Claim reimbursement").check();
    await dialog.getByLabel("Amount *").fill("7500");
    await dialog.locator("input[type=file]").nth(1).setInputFiles({ name: "receipt.pdf", mimeType: "application/pdf", buffer: makePdf("receipt") });
    await expect(dialog.getByTitle("Open receipt.pdf")).toBeVisible();
    await dialog.getByRole("button", { name: "Submit for approval" }).click();
    await expect(toast(page, "Submitted for approval")).toBeVisible();
    await expectStatus(page, "Lead review");
    await expect(card(page, "Completion")).toContainText("₹7,500");

    const lead = await pageAs("de.lead");
    await lead.goto("/certifications?tab=review");
    // The row also links the owner's name to their profile, so pick the plan by its title.
    await lead.getByRole("row").filter({ hasText: plan.cert.title }).getByRole("link", { name: plan.cert.title }).click();
    await lead.getByRole("button", { name: "Review", exact: true }).click();
    await lead.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(toast(lead, "Approved — sent to the Practice Manager")).toBeVisible();
    await expectStatus(lead, "Manager review");
    await expect(lead.getByRole("button", { name: "Final approval" })).toHaveCount(0); // Leads don't hold cert.plan.verify

    const manager = await pageAs("de.manager");
    await open(manager, plan);
    await manager.getByRole("button", { name: "Final approval" }).click();
    await manager.getByRole("dialog").getByRole("button", { name: "Approve & complete" }).click();
    await expect(toast(manager, "Approved — marked completed")).toBeVisible();
    await expectStatus(manager, "Completed");
    await expect(card(manager, "Approval")).toContainText("Approved by Casey Lin");
    await expect(card(manager, "Completion")).toContainText("Reimbursement approved");
  });

  test("[CERT-UI-05] a rejected completion reopens the plan and the owner sees why", async ({ page, loginAs, as }) => {
    const plan = await inCertLeadReview(as);
    await decide(await as("de.lead"), plan, "reject", "The verification link returns 404");
    await loginAs("de.dev1");
    await open(page, plan);
    await expectStatus(page, "Planned");
    await expect(page.getByText("Casey Lin rejected the completion")).toBeVisible();
    await expect(page.getByText("The verification link returns 404").first()).toBeVisible();
    await expect(card(page, "Last submission")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit completion" })).toBeVisible();
  });
});

test.describe("Certification Tracker — isolation & layout", () => {
  test("[CERT-UI-06] someone from another practice gets 'Plan not found'", async ({ page, loginAs, as }) => {
    const plan = await createPlan(await as("de.dev1"));
    await loginAs("qa.lead");
    await open(page, plan);
    await expect(page.getByRole("heading", { name: "Plan not found" })).toBeVisible();
  });

  test("[CERT-UI-07] list and detail fit a 375px phone", async ({ page, loginAs, as }) => {
    const plan = await createPlan(await as("de.dev1"));
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs("de.dev1");
    for (const path of ["/certifications", "/certifications?tab=catalog", `/certifications/plans/${plan.id}`]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(1);
    }
  });
});
