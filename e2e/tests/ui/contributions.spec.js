// CON-UI — starting, finding, editing and documenting a contribution as a single user.
const { test, expect, unique, isoDay } = require("../../support/fixtures");
const { makePdf, bigBuffer, MB } = require("../../support/files");
const { createContribution, uploadFile } = require("../../support/contributions");
const { card, toast, acceptNextDialog, expectStatus } = require("../../support/ui");

test.describe("Start a contribution (form)", () => {
  test("[CON-UI-01] practitioner starts a contribution and lands on its page", async ({ page, loginAs }) => {
    const title = unique("Shared auth kit");
    await loginAs("de.dev1");
    await page.goto("/practices/contributions");
    await page.getByRole("link", { name: "Start a contribution" }).click();
    await expect(page.getByRole("heading", { name: "Start a contribution" })).toBeVisible();
    await expect(page.getByLabel("Practice")).toBeDisabled(); // only one practice → fixed
    await expect(page.getByLabel("Practice")).toHaveValue("digital-engineering");
    await expect(page.getByLabel("Start date")).toHaveValue(isoDay(0));
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption({ label: "Reusable framework / accelerator" });
    await page.getByLabel("Due date").fill(isoDay(21));
    await page.getByRole("button", { name: "Start contribution" }).click();

    await expect(page).toHaveURL(/\/practices\/contributions\/[a-f0-9]{24}$/);
    await expect(toast(page, `Started ${title}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expectStatus(page, "In Progress");
    // The untouched template isn't saved as a description.
    await expect(card(page, "Description")).toContainText("No description yet — add one before submitting.");

    await page.getByRole("link", { name: "← Contributions" }).click();
    await page.getByRole("tab", { name: "Mine" }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("[CON-UI-02] submitting an empty form shows every problem inline and creates nothing", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByText("Give it a title")).toBeVisible();
    await expect(page.getByText("Choose a type")).toBeVisible();
    await expect(page.getByText("Pick a due date")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/new$/);
  });

  test("[CON-UI-03] a title of only spaces is treated as empty", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill("     ");
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Due date").fill(isoDay(5));
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByText("Give it a title")).toBeVisible();
  });

  test("[CON-UI-04] 'Other' reveals a required custom type field", async ({ page, loginAs }) => {
    const title = unique("Talk");
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await expect(page.getByLabel("Custom type")).toHaveCount(0);
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption({ label: "Other (custom)" });
    await page.getByLabel("Due date").fill(isoDay(5));
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByText("Name the type")).toBeVisible();
    await page.getByLabel("Custom type").fill("Conference talk");
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.locator("main")).toContainText("Conference talk · Digital Engineering · started by Riley Patel");
  });

  test("[CON-UI-05] due date before the start date is caught before saving", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill("Backwards dates");
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Start date").fill(isoDay(10));
    await page.getByLabel("Due date").fill(isoDay(2));
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByText("Due date is before the start date")).toBeVisible();
    await expect(page).toHaveURL(/\/new$/);
  });

  test("[CON-UI-06] Markdown description previews and renders on the contribution page", async ({ page, loginAs }) => {
    const title = unique("Markdown check");
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Due date").fill(isoDay(5));
    await page.locator("#c-description").fill("## Why it matters\n\n- **Faster** onboarding\n- Fewer bugs");
    await page.getByRole("tab", { name: "Preview" }).click();
    await expect(page.getByRole("heading", { name: "Why it matters" })).toBeVisible();
    await page.getByRole("tab", { name: "Write" }).click();
    await page.getByRole("button", { name: "Start contribution" }).click();
    const description = card(page, "Description");
    await expect(description.getByRole("heading", { name: "Why it matters" })).toBeVisible();
    await expect(description.locator("strong")).toHaveText("Faster");
  });

  test("[CON-UI-07] Cancel goes back to the list without creating anything", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill("Never saved");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/practices\/contributions$/);
    await expect(page.getByRole("link", { name: "Never saved" })).toHaveCount(0);
  });
});

test.describe("Contribution list", () => {
  test("[CON-UI-08] search, type filter and Clear narrow the list; no match shows a friendly empty state", async ({ page, loginAs, as }) => {
    const tag = unique("Zeta");
    const dev = await as("de.dev1");
    await createContribution(dev, { title: `${tag} framework`, type: "framework" });
    await createContribution(dev, { title: `${tag} blog post`, type: "blog" });
    await loginAs("de.dev1");
    await page.goto("/practices/contributions");
    const search = page.getByLabel("Search by title or owner");
    await search.fill(tag);
    await expect(page.getByRole("link", { name: new RegExp(tag) })).toHaveCount(2);
    await page.getByLabel("Type").selectOption({ label: "Blog" });
    await expect(page.getByRole("link", { name: new RegExp(tag) })).toHaveCount(1);
    await expect(page.getByRole("link", { name: `${tag} blog post` })).toBeVisible();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(search).toHaveValue("");
    await expect(page.getByRole("button", { name: "Clear" })).toBeDisabled();
    await search.fill("no-such-contribution-xyz");
    await expect(page.getByRole("heading", { name: "Nothing matches" })).toBeVisible();
    await expect(page.getByText("Try clearing a filter.")).toBeVisible();
  });

  test("[CON-UI-09] search also matches the owner's name", async ({ page, loginAs, as }) => {
    const title = unique("Owner search");
    await createContribution(await as("de.lead"), { title });
    await loginAs("de.dev1");
    await page.goto("/practices/contributions");
    await page.getByLabel("Search by title or owner").fill("casey");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  });

  test("[CON-UI-10] practitioners get All and Mine; reviewers also get 'Awaiting my review'", async ({ page, loginAs, pageAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions?tab=review");
    await expect(page.getByRole("tablist", { name: "Contribution views" }).getByRole("tab")).toHaveText(["All", "Mine"]);
    await expect(page.getByRole("tab", { name: "All" })).toHaveAttribute("aria-selected", "true"); // unknown tab → All
    const lead = await pageAs("de.lead");
    await lead.goto("/practices/contributions");
    await expect(lead.getByRole("tablist", { name: "Contribution views" }).getByRole("tab")).toHaveText(["All", "Mine", "Awaiting my review"]);
  });

  test("[CON-UI-11] overdue work is flagged in the list and on its page, and can be filtered", async ({ page, loginAs, as }) => {
    const title = unique("Late work");
    await createContribution(await as("de.dev1"), { title, startDate: isoDay(-30), dueDate: isoDay(-3) });
    await loginAs("de.dev1");
    await page.goto("/practices/contributions");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("(overdue)");
    await page.getByRole("checkbox", { name: "Overdue only" }).check();
    await expect(row).toBeVisible();
    await page.getByLabel("Search by title or owner").fill(title);
    await page.getByRole("link", { name: title }).click();
    await expect(page.locator("main").getByText("Overdue", { exact: true })).toBeVisible();
  });

  test("[CON-UI-12] someone who sees several practices gets a Practice column and filter", async ({ page, loginAs }) => {
    await loginAs("practices.admin");
    await page.goto("/practices/contributions");
    await expect(page.getByLabel("Practice", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Practice", { exact: true }).locator("option")).toHaveText(["All practices", "Digital Engineering", "Platform", "QA", "AI"]);
  });

  test("[CON-UI-13] someone in a practice with no contributions sees the 'No contributions yet' state", async ({ page, loginAs }) => {
    await loginAs("ai.dev1");
    await page.goto("/practices/contributions");
    await expect(page.getByRole("heading", { name: "No contributions yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start a contribution" })).toBeVisible();
  });
});

test.describe("Contribution page", () => {
  test("[CON-UI-14] another practice's contribution (or a bad id) shows 'Contribution not found'", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"));
    await loginAs("qa.tester1");
    await page.goto(`/practices/contributions/${c.id}`);
    await expect(page.getByRole("heading", { name: "Contribution not found" })).toBeVisible();
    await expect(page.getByText(c.title)).toHaveCount(0);
    await page.goto("/practices/contributions/not-a-real-id");
    await expect(page.getByRole("heading", { name: "Contribution not found" })).toBeVisible();
  });

  test("[CON-UI-15] edit details: a blank title is refused, a new title is saved", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"));
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await card(page, "Details").getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit details" });
    await dialog.getByLabel("Title").fill("");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByText("Give it a title")).toBeVisible();
    const renamed = unique("Renamed");
    await dialog.getByLabel("Title").fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(toast(page, "Saved")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();
  });

  test("[CON-UI-16] edit the description in the Markdown editor", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"), { description: "" });
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await card(page, "Description").getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit description" });
    await dialog.locator("#edit-description").fill("### Approach\nOne shared package.");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(card(page, "Description").getByRole("heading", { name: "Approach" })).toBeVisible();
  });

  test("[CON-UI-17] log progress: Post is disabled until something is written; the update appears newest-first", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"));
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    const post = page.getByRole("button", { name: "Post update" });
    await expect(post).toBeDisabled();
    await page.locator("#progress-body").fill("   ");
    await expect(post).toBeDisabled();
    await page.locator("#progress-body").fill("Added the **backend** provider");
    await post.click();
    await expect(toast(page, "Update posted")).toBeVisible();
    await expect(page.locator("#progress-body")).toHaveValue("");
    const first = page.locator("ol > li").first();
    await expect(first).toContainText("posted an update");
    await expect(first.locator("strong")).toHaveText("backend");
  });

  test("[CON-UI-18] upload a document, then remove it after confirming", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"));
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    const docs = card(page, "Documents");
    await expect(docs).toContainText("No documents yet.");
    await docs.locator("input[type=file]").setInputFiles({ name: "architecture.pdf", mimeType: "application/pdf", buffer: makePdf("arch") });
    await expect(docs.getByTitle("Open architecture.pdf")).toBeVisible();
    await expect(docs).toContainText("1 file");
    acceptNextDialog(page);
    await docs.getByRole("button", { name: "Remove architecture.pdf" }).click();
    await expect(toast(page, "architecture.pdf removed")).toBeVisible();
    await expect(docs).toContainText("No documents yet.");
  });

  test("[CON-UI-19] a file over 4 MB is refused in the browser before uploading", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"));
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    const docs = card(page, "Documents");
    await docs.locator("input[type=file]").setInputFiles({ name: "huge-video.mp4", mimeType: "video/mp4", buffer: bigBuffer(4 * MB + 1) });
    await expect(toast(page, "huge-video.mp4: over the 4 MB limit")).toBeVisible();
    await expect(docs).toContainText("No documents yet.");
  });

  test("[CON-UI-20] submit for review: every missing requirement is listed and nothing is submitted", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.dev1"), { description: "" });
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await page.getByRole("button", { name: "Submit for review" }).click();
    const dialog = page.getByRole("dialog", { name: "Submit for review" });
    await dialog.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Add a description to the contribution first");
    await expect(dialog.getByText("Summarise what was built or achieved")).toBeVisible();
    await expect(dialog.getByText("Describe the impact")).toBeVisible();
    await expect(dialog.getByText("Attach at least one document")).toBeVisible();
    await dialog.getByLabel("Repository link").fill("github.com/no-scheme");
    await dialog.getByRole("button", { name: "Add link" }).click();
    await dialog.getByLabel("Link 1 URL").fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(dialog.getByText("Use a full http(s):// link")).toBeVisible();
    await expect(dialog.getByText("Every link needs a full http(s):// URL")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expectStatus(page, "In Progress");
  });

  test("[CON-UI-21] a practice member who isn't on the contribution can ask to join but not edit or submit", async ({ page, loginAs, as }) => {
    const c = await createContribution(await as("de.lead"));
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await expect(page.getByRole("button", { name: "Ask to join" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit for review" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Post update" })).toHaveCount(0);
    await expect(card(page, "Documents").getByRole("button", { name: "Upload" })).toHaveCount(0);
  });

  test("[CON-UI-22] HTML and script in a description are shown as text, never executed", async ({ page, loginAs, as }) => {
    const payload = [
      "<img src=x onerror=\"window.__xss='img'\">",
      "<script>window.__xss='script'</script>",
      "[click me](javascript:window.__xss='link')",
    ].join("\n\n");
    const c = await createContribution(await as("de.dev1"), { title: "<b>bold title</b>", description: payload });
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    await expect(page.getByRole("heading", { level: 1, name: "<b>bold title</b>" })).toBeVisible();
    const description = card(page, "Description");
    await expect(description).toContainText("<script>");
    await expect(description.locator("img")).toHaveCount(0);
    const link = description.getByRole("link", { name: "click me" });
    if (await link.count()) await expect(link).not.toHaveAttribute("href", /javascript:/i);
    await link.click({ trial: false }).catch(() => {});
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("[CON-UI-23] documents open from their chip (PDF opens in a new tab)", async ({ page, loginAs, as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    await uploadFile(dev, c.id, { name: "slides.pdf" });
    await loginAs("de.dev1");
    await page.goto(`/practices/contributions/${c.id}`);
    // The chip fetches the file with the auth header and opens it from a blob URL. Headless Chromium has no PDF
    // viewer (the tab turns into a download), so check the popup opened and the blob really holds the PDF.
    await page.evaluate(() => {
      const open = window.open;
      window.open = (...args) => ((window.__openedUrl = args[0]), open.apply(window, args));
    });
    const popup = page.waitForEvent("popup");
    await card(page, "Documents").getByTitle("Open slides.pdf").click();
    await popup;
    const head = await page.evaluate(async () => (await (await fetch(window.__openedUrl)).text()).slice(0, 5));
    expect(head).toBe("%PDF-");
  });
});

test.describe("Impatient and unusual users", () => {
  test("[CON-UI-24] double-clicking 'Start contribution' creates exactly one contribution", async ({ page, loginAs, as }) => {
    const title = unique("Double click");
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Due date").fill(isoDay(7));
    await page.getByRole("button", { name: "Start contribution" }).dblclick();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    const list = await (await as("de.dev1")).json(`/contributions?q=${encodeURIComponent(title)}`);
    expect(list.contributions).toHaveLength(1);
  });

  test("[CON-UI-25] someone who can start contributions in several practices must pick one", async ({ page, loginAs }) => {
    await loginAs("practices.admin");
    await page.goto("/practices/contributions/new");
    await expect(page.getByLabel("Practice")).toBeEnabled();
    await page.getByLabel("Title").fill("Cross-practice");
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Due date").fill(isoDay(7));
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.getByText("Choose a practice")).toBeVisible();
    await page.getByLabel("Practice").selectOption({ label: "QA" });
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(page.locator("main")).toContainText("Blog · QA · started by Jordan Blake");
  });

  test("[CON-UI-26] importing a Markdown file replaces the description and switches to Preview", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    acceptNextDialog(page); // "Replace the current text…?" — the template is already there
    await page.locator("#c-description-import").setInputFiles({ name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Imported heading\n\n| Col A | Col B |\n|---|---|\n| 1 | 2 |\n") });
    await expect(toast(page, "Imported notes.md")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Imported heading" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Col B" }).or(page.getByRole("columnheader", { name: "Col B" }))).toBeVisible();
  });

  test("[CON-UI-27] importing an unsupported file type explains which formats work", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    acceptNextDialog(page);
    await page.locator("#c-description-import").setInputFiles({ name: "deck.pptx", mimeType: "application/vnd.ms-powerpoint", buffer: Buffer.from("PK") });
    await expect(toast(page, "Import a .docx, .md or .txt file")).toBeVisible();
    await expect(page.locator("#c-description")).toHaveValue(/## Problem/); // template untouched
  });

  test("[CON-UI-28] the description editor counts characters near the limit and the save is refused with a clear message over it", async ({ page, loginAs }) => {
    await loginAs("de.dev1");
    await page.goto("/practices/contributions/new");
    await page.getByLabel("Title").fill("Huge import");
    await page.getByLabel("Type").selectOption("blog");
    await page.getByLabel("Due date").fill(isoDay(7));
    const editor = page.locator("#c-description");
    await editor.fill("a".repeat(190_000));
    await expect(page.getByText("190,000 / 200,000 characters")).toBeVisible();
    await editor.fill("a".repeat(200_001));
    await expect(page.getByText("200,001 / 200,000 characters — shorten it to save")).toBeVisible();
    await expect(editor).toHaveAttribute("aria-invalid", "true");
    await page.getByRole("button", { name: "Start contribution" }).click();
    await expect(toast(page, "Description is too long (max 200,000 characters)")).toBeVisible();
    await expect(page).toHaveURL(/\/new$/); // nothing lost: still on the form with the text in place
    await expect(editor).toHaveValue(/^a{200001}$/);
  });
});

