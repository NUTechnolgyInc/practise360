// AI-UI — Claude usage reports in the browser: upload / replace / delete, client-side checks, viewer, team view.
// Uses the ai.* practice, aitracker.* and last month; the API suite uses other users/months, so they never collide.
const { test, expect, previousMonth, monthLabel } = require("../../support/fixtures");
const { makePdf, bigBuffer, MB } = require("../../support/files");
const { card, toast } = require("../../support/ui");

const LAST = previousMonth(1);
const LAST_LABEL = monthLabel(LAST);

async function uploadViaUi(page, name = "my-report.pdf", buffer = makePdf("Sage report")) {
  await page.getByLabel("Report PDF").setInputFiles({ name, mimeType: "application/pdf", buffer });
  await card(page, "2. Upload the PDF").getByRole("button", { name: /Upload report|Replace report/ }).click();
}

const yourReports = (page) => card(page, "Your reports");

test.describe("My reports", () => {
  test.afterEach(async ({ as }) => {
    // Leave no report behind for ai.dev1 so each test starts from "No reports yet".
    await (await as("ai.dev1")).delete(`/ai/usage-reports/mine/${LAST}`);
  });

  test("[AI-UI-01] a practitioner sees the skill, the upload form and an empty history — no Team tab", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await expect(page.getByRole("heading", { name: "Claude usage reports" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Team reports" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Download skill (.zip)" })).toHaveAttribute("href", "/skills/claude-usage-report.zip");
    await expect(page.getByLabel("Month")).toHaveValue(LAST); // defaults to the finished month
    await expect(page.getByLabel("Month").locator("option")).toHaveCount(12);
    await expect(yourReports(page).getByRole("heading", { name: "No reports yet" })).toBeVisible();
  });

  test("[AI-UI-02] the skill download link really serves the zip", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    const res = await page.request.get("/skills/claude-usage-report.zip");
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 2).toString()).toBe("PK");
  });

  test("[AI-UI-03] upload a PDF: it's listed, and the form switches to 'Replace report'", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "sage-usage.pdf");
    await expect(toast(page, `Report for ${LAST_LABEL} uploaded`)).toBeVisible();
    const row = yourReports(page).getByRole("row").filter({ hasText: LAST_LABEL });
    await expect(row).toContainText("sage-usage.pdf");
    await expect(page.getByRole("button", { name: "Replace report" })).toBeVisible();
    await expect(page.getByText(/Replaces the report uploaded/)).toBeVisible();
  });

  test("[AI-UI-04] uploading again for the same month replaces it (still one row)", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "first.pdf");
    await expect(yourReports(page)).toContainText("first.pdf");
    await uploadViaUi(page, "second.pdf");
    await expect(yourReports(page)).toContainText("second.pdf");
    await expect(yourReports(page)).not.toContainText("first.pdf");
    await expect(yourReports(page).getByRole("row").filter({ hasText: LAST_LABEL })).toHaveCount(1);
  });

  test("[AI-UI-05] pressing Upload without a file asks for the PDF", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await page.getByRole("button", { name: "Upload report" }).click();
    await expect(page.getByText("Choose the PDF your skill generated.")).toBeVisible();
  });

  test("[AI-UI-06] picking a non-PDF is refused in the browser", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await page.getByLabel("Report PDF").setInputFiles({ name: "notes.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from("PK..") });
    await expect(page.getByText("Choose a PDF file.")).toBeVisible();
    await page.getByRole("button", { name: "Upload report" }).click();
    await expect(page.getByText("Choose the PDF your skill generated.")).toBeVisible();
    await expect(yourReports(page).getByRole("heading", { name: "No reports yet" })).toBeVisible();
  });

  test("[AI-UI-07] a PDF over 4 MB is refused in the browser with its size", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await page.getByLabel("Report PDF").setInputFiles({ name: "huge.pdf", mimeType: "application/pdf", buffer: bigBuffer(4 * MB + 200 * 1024, "%PDF-1.4\n") });
    await expect(page.getByText(/That file is 4\.2 MB — the limit is 4 MB\./)).toBeVisible();
  });

  test("[AI-UI-08] a file named .pdf that isn't a PDF gets the server's error as a toast", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "renamed.pdf", Buffer.from("this is not a pdf"));
    await expect(toast(page, "Upload a PDF file")).toBeVisible();
    await expect(yourReports(page).getByRole("heading", { name: "No reports yet" })).toBeVisible();
  });

  test("[AI-UI-09] delete asks for confirmation; Cancel keeps the report, Delete removes it", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "to-delete.pdf");
    await page.getByRole("button", { name: `Delete report for ${LAST_LABEL}` }).click();
    const dialog = page.getByRole("dialog", { name: "Delete report?" });
    await expect(dialog).toContainText(`Your ${LAST_LABEL} report will be removed`);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(yourReports(page)).toContainText("to-delete.pdf");
    await page.getByRole("button", { name: `Delete report for ${LAST_LABEL}` }).click();
    await page.getByRole("dialog", { name: "Delete report?" }).getByRole("button", { name: "Delete report" }).click();
    await expect(toast(page, `Report for ${LAST_LABEL} deleted`)).toBeVisible();
    await expect(yourReports(page).getByRole("heading", { name: "No reports yet" })).toBeVisible();
  });

  test("[AI-UI-10] View opens the in-app PDF viewer, which closes with Escape", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "viewer.pdf");
    await yourReports(page).getByRole("button", { name: "View" }).click();
    const viewer = page.getByRole("dialog", { name: `Your report · ${LAST_LABEL} — PDF viewer` });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("canvas").first()).toBeVisible();
    await expect(viewer.getByRole("button", { name: "Previous page" })).toBeDisabled(); // one-page PDF
    await page.keyboard.press("Escape");
    await expect(viewer).toHaveCount(0);
  });
});

test.describe("Team reports", () => {
  test("[AI-UI-11] a Practice Manager sees their practice with Submitted / Pending and can filter", async ({ page, loginAs, as }) => {
    const dev = await as("ai.dev1");
    await dev.upload("PUT", `/ai/usage-reports/mine/${LAST}?fileName=sage.pdf`, makePdf("Sage"), "application/pdf");
    try {
      await loginAs("ai.manager");
      await page.goto("/ai-tracker?tab=team");
      await expect(page.getByRole("tab", { name: "Team reports" })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("heading", { name: `Reports for ${LAST_LABEL}` })).toBeVisible();
      const rows = page.getByRole("row");
      await expect(rows.filter({ hasText: "Sage Morgan" })).toContainText("Submitted");
      await expect(rows.filter({ hasText: "Emerson Kai" })).toContainText("Pending");
      await expect(rows.filter({ hasText: "Alex Rivera" })).toBeVisible(); // multi-practice member
      await expect(rows.filter({ hasText: "Riley Patel" })).toHaveCount(0); // other practice
      await page.getByLabel("Show").selectOption({ label: "Pending" });
      await expect(rows.filter({ hasText: "Sage Morgan" })).toHaveCount(0);
      await page.getByLabel("Show").selectOption({ label: "Submitted" });
      await expect(rows.filter({ hasText: "Emerson Kai" })).toHaveCount(0);
      await rows.filter({ hasText: "Sage Morgan" }).getByRole("button", { name: "View" }).click();
      await expect(page.getByRole("dialog", { name: `Sage Morgan · ${LAST_LABEL} — PDF viewer` })).toBeVisible();
    } finally {
      await dev.delete(`/ai/usage-reports/mine/${LAST}`);
    }
  });

  test("[AI-UI-12] switching to an older month with no uploads shows everyone as Pending", async ({ page, loginAs }) => {
    await loginAs("ai.manager");
    await page.goto("/ai-tracker?tab=team");
    const older = previousMonth(11);
    await page.getByLabel("Month").selectOption(older);
    await expect(page.getByRole("heading", { name: `Reports for ${monthLabel(older)}` })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Submitted" })).toHaveCount(0);
    await page.getByRole("button", { name: "Show stats" }).click(); // count tiles start hidden
    await expect(page.getByText("0%")).toBeVisible();
  });

  test("[AI-UI-13] a Lead (no team visibility) only gets My reports, even with ?tab=team", async ({ page, loginAs }) => {
    await loginAs("ai.lead");
    await page.goto("/ai-tracker?tab=team");
    await expect(page.getByRole("tab", { name: "Team reports" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Your reports" })).toBeVisible();
  });

  test("[AI-UI-14] AI Admin sees everyone, including AI-only members with no practice", async ({ page, loginAs }) => {
    await loginAs("aitracker.admin");
    await page.goto("/ai-tracker?tab=team");
    const rows = page.getByRole("row");
    await expect(rows.filter({ hasText: "Finley Ross" })).toBeVisible();
    await expect(rows.filter({ hasText: "Riley Patel" })).toBeVisible();
    await expect(rows.filter({ hasText: "Avery Stone" })).toHaveCount(0); // Super Admin isn't expected to submit
  });

  test("[AI-UI-15] an AI Member (no practice) can still submit their own report", async ({ page, loginAs, as }) => {
    await loginAs("aitracker.member");
    await page.goto("/ai-tracker");
    await uploadViaUi(page, "finley.pdf");
    await expect(toast(page, `Report for ${LAST_LABEL} uploaded`)).toBeVisible();
    await (await as("aitracker.member")).delete(`/ai/usage-reports/mine/${LAST}`);
  });
});
