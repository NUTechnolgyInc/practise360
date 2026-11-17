// API shortcuts for putting a certification plan into a known state before a test acts on it.
const { expect, unique, isoDay } = require("./fixtures");
const { makePdf } = require("./files");

async function ok(res, what) {
  expect(res.ok(), `${what} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.status() === 204 ? null : res.json();
}

const DE = "digital-engineering";

/** A one-off cert (never added to the catalog) with a unique title, so plans don't collide across tests. */
const oneOff = (label = "E2E cert") => ({ title: unique(label), type: "certification", provider: "E2E Provider" });

/** Creates a self plan owned by `client`'s user. */
async function createPlan(client, overrides = {}) {
  const body = { practiceId: DE, cert: oneOff(), startDate: isoDay(0), dueDate: isoDay(30), ...overrides };
  return ok(await client.post("/certifications/plans", body), `create plan as ${client.username}`);
}

async function uploadCertFile(client, id, kind = "certificate", { name = `${kind}.pdf`, buffer = makePdf(kind), type = "application/pdf" } = {}) {
  return ok(await client.upload("POST", `/certifications/plans/${id}/files?fileName=${encodeURIComponent(name)}&kind=${kind}`, buffer, type), `upload ${name}`);
}

/** Uploads a certificate (and a receipt when claiming) and submits the completion for the Lead step. */
async function submitCompletion(client, plan, { claim, ...overrides } = {}) {
  const cert = await uploadCertFile(client, plan.id);
  const receipt = claim ? await uploadCertFile(client, plan.id, "receipt") : null;
  const body = {
    completedOn: isoDay(0),
    verificationUrl: "https://verify.example.com/e2e",
    certificateFileIds: [cert.id],
    reimbursement: claim ? { amount: 12000, currency: "INR", receiptFileIds: [receipt.id], ...claim } : null,
    ...overrides,
  };
  return ok(await client.post(`/certifications/plans/${plan.id}/submit`, body), "submit completion");
}

const decide = async (client, plan, decision, comment) =>
  ok(await client.post(`/certifications/plans/${plan.id}/review`, { decision, comment }), `${decision} as ${client.username}`);

/** A plan owned by de.dev1, already submitted and waiting for the Lead step. */
async function inCertLeadReview(as, opts) {
  const dev = await as("de.dev1");
  const plan = await createPlan(dev);
  return submitCompletion(dev, plan, opts);
}

async function memberId(as, practiceId, username, by = "de.lead") {
  const people = await (await as(by)).json(`/certifications/people/${practiceId}`);
  return people.find((p) => p.username === username)?.id;
}

module.exports = { ok, DE, oneOff, createPlan, uploadCertFile, submitCompletion, decide, inCertLeadReview, memberId };
