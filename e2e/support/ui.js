// Small UI helpers shared by the browser specs.
const { expect } = require("./fixtures");

/** A kit <Card> located by its header title. */
const card = (page, title) => page.locator("div.rounded-3xl").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

/** A toast (success = role=status, error = role=alert) containing `text`. */
const toast = (page, text) => page.locator("[role=status],[role=alert]").filter({ hasText: text });

/** Accept the next window.confirm(). */
const acceptNextDialog = (page) => page.once("dialog", (d) => d.accept());

/** The status badge in a contribution's page header. */
async function expectStatus(page, label) {
  await expect(page.locator("main").getByText(label, { exact: true }).first()).toBeVisible();
}

module.exports = { card, toast, acceptNextDialog, expectStatus };
