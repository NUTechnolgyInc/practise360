// API shortcuts for putting a contribution into a known state before a test acts on it.
const { expect, unique, isoDay } = require("./fixtures");
const { makePdf } = require("./files");

async function ok(res, what) {
  expect(res.ok(), `${what} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.status() === 204 ? null : res.json();
}

/** Creates an in-progress contribution owned by `client`'s user. */
async function createContribution(client, overrides = {}) {
  const body = {
    title: unique("E2E contribution"),
    practiceId: "digital-engineering",
    type: "framework",
    startDate: isoDay(0),
    dueDate: isoDay(30),
    description: "## Problem\nShared auth for every project.\n\n## Approach\nOne package.",
    ...overrides,
  };
  return ok(await client.post("/contributions", body), `create contribution as ${client.username}`);
}

async function uploadFile(client, id, { name = "design.pdf", buffer = makePdf("design doc"), type = "application/pdf" } = {}) {
  return ok(await client.upload("POST", `/contributions/${id}/files?fileName=${encodeURIComponent(name)}`, buffer, type), `upload ${name}`);
}

const SUBMISSION = { summary: "Built a shared auth package.", impact: "Saves ~2 days per new project." };

/** Uploads a document if needed and submits for Lead review. */
async function submit(client, c, extra = {}) {
  const file = c.files?.[0] ?? (await uploadFile(client, c.id));
  return ok(await client.post(`/contributions/${c.id}/submit`, { ...SUBMISSION, fileIds: [file.id], ...extra }), "submit");
}

async function review(client, id, decision, comment = "") {
  return ok(await client.post(`/contributions/${id}/review`, { decision, comment }), `${client.username} ${decision}`);
}

/** owner creates + submits; returns the contribution in lead_review. */
async function inLeadReview(owner, overrides) {
  const c = await createContribution(owner, overrides);
  return submit(owner, c);
}

module.exports = { ok, createContribution, uploadFile, submit, review, inLeadReview, SUBMISSION };
