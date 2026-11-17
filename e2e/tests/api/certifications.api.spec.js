// CERT-API — Certification Tracker: catalog, plans, visibility, recommend/assign, completion, two-step approval
// (docs/rbac.md §4 "Certification Tracker", apps/api/src/rbac/cert-access.js).
const { test, expect, unique, isoDay } = require("../../support/fixtures");
const { makePdf } = require("../../support/files");
const { ok, DE, oneOff, createPlan, uploadCertFile, submitCompletion, decide, inCertLeadReview, memberId } = require("../../support/certs");

test.describe("Certification API — catalog", () => {
  test("[CERT-API-01] every practice member sees the seeded catalog; AI Tracker-only users don't", async ({ as }) => {
    const { items, canCreate } = await (await as("de.dev1")).json("/certifications/catalog");
    expect(items.length).toBeGreaterThanOrEqual(11);
    expect(canCreate).toBe(false);
    expect((await (await as("aitracker.member")).get("/certifications/catalog")).status()).toBe(403);
  });

  test("[CERT-API-02] Lead adds to the catalog; practitioner can't; same title + provider is refused", async ({ as }) => {
    const entry = { title: unique("E2E Catalog Course"), type: "course", provider: "E2E Academy" };
    expect((await (await as("de.dev1")).post("/certifications/catalog", entry)).status()).toBe(403);
    const added = await ok(await (await as("de.lead")).post("/certifications/catalog", entry), "add");
    expect(added).toMatchObject({ title: entry.title, isActive: true, canEdit: true, canRetire: false });
    const dup = await (await as("qa.manager")).post("/certifications/catalog", { ...entry, title: `  ${entry.title.toUpperCase()} ` });
    expect(dup.status()).toBe(409);
  });

  test("[CERT-API-03] only Cert Admin retires; a retired entry can't be planned, and restoring brings it back", async ({ as }) => {
    const lead = await as("de.lead");
    const item = await ok(await lead.post("/certifications/catalog", { title: unique("E2E Retire"), type: "certification" }), "add");
    expect((await lead.patch(`/certifications/catalog/${item.id}`, { isActive: false })).status()).toBe(403);
    const admin = await as("cert.admin");
    await ok(await admin.patch(`/certifications/catalog/${item.id}`, { isActive: false }), "retire");
    const res = await (await as("de.dev1")).post("/certifications/plans", { practiceId: DE, catalogId: item.id, startDate: isoDay(0), dueDate: isoDay(5) });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Pick an active catalog entry");
    await ok(await admin.patch(`/certifications/catalog/${item.id}`, { isActive: true }), "restore");
  });
});

test.describe("Certification API — own plans & visibility", () => {
  test("[CERT-API-04] practitioner plans from the catalog; a second open plan for it is refused", async ({ as }) => {
    const dev = await as("de.dev1");
    const item = await ok(await (await as("de.lead")).post("/certifications/catalog", { title: unique("E2E Plan Me"), type: "course" }), "add");
    const plan = await createPlan(dev, { catalogId: item.id, cert: undefined, notes: "Weekends" });
    expect(plan).toMatchObject({ status: "planned", source: "self", cert: { title: item.title, type: "course" }, mine: true });
    expect(plan.actions).toMatchObject({ submit: true, drop: true, editDueDate: true, review: false });
    const again = await dev.post("/certifications/plans", { practiceId: DE, catalogId: item.id, startDate: isoDay(0), dueDate: isoDay(5) });
    expect(again.status()).toBe(409);
  });

  test("[CERT-API-05] a one-off cert stays off the catalog", async ({ as }) => {
    const plan = await createPlan(await as("de.dev1"));
    expect(plan.catalogId).toBeNull();
    const titles = (await (await as("de.dev1")).json("/certifications/catalog")).items.map((i) => i.title);
    expect(titles).not.toContain(plan.cert.title);
  });

  for (const [label, patch, message] of [
    ["missing due date", { dueDate: undefined }, "Start and due dates are required (YYYY-MM-DD)"],
    ["impossible date", { dueDate: "2027-02-31" }, "Dates must be YYYY-MM-DD"],
    ["due before start", { startDate: isoDay(5), dueDate: isoDay(1) }, "Due date can't be before the start date"],
    ["no cert", { cert: undefined }, "Pick a certification from the catalog or add a new one"],
    ["javascript: link", { cert: { title: "X", type: "course", url: "javascript:alert(1)" } }, "Not a valid http(s) link: javascript:alert(1)"],
  ]) {
    test(`[CERT-API-06] create rejects ${label} → 400`, async ({ as }) => {
      const res = await (await as("de.dev1")).post("/certifications/plans", { practiceId: DE, cert: oneOff(), startDate: isoDay(0), dueDate: isoDay(5), ...patch });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(message);
    });
  }

  test("[CERT-API-07] can't plan in another practice", async ({ as }) => {
    expect((await (await as("de.dev1")).post("/certifications/plans", { practiceId: "qa", cert: oneOff(), startDate: isoDay(0), dueDate: isoDay(5) })).status()).toBe(403);
  });

  test("[CERT-API-08] visibility: owner, DE Lead/Manager/Coordinator, admins — not peers or other practices (404)", async ({ as }) => {
    const plan = await createPlan(await as("de.dev1"));
    for (const u of ["de.lead", "de.manager", "de.coordinator", "practices.admin", "cert.admin", "superadmin"]) {
      expect((await (await as(u)).get(`/certifications/plans/${plan.id}`)).status(), u).toBe(200);
    }
    for (const u of ["qa.lead", "qa.tester1", "platform.manager", "aitracker.admin"]) {
      expect((await (await as(u)).get(`/certifications/plans/${plan.id}`)).status(), u).toBe(404);
    }
    const list = await (await as("qa.lead")).json("/certifications/plans");
    expect(list.plans.some((p) => p.id === plan.id)).toBe(false);
  });

  test("[CERT-API-09] a practitioner's list has only their own plans", async ({ as }) => {
    await createPlan(await as("de.dev1"));
    const { plans, teamPractices } = await (await as("de.dev1")).json("/certifications/plans");
    expect(teamPractices).toEqual([]);
    expect(plans.every((p) => p.owner.username === "de.dev1")).toBe(true);
  });
});

test.describe("Certification API — recommend & assign", () => {
  test("[CERT-API-10] Manager assigns a new cert to members of two groups; it lands in the catalog; the owner can't drop it; their Lead can move it", async ({ as }) => {
    const manager = await as("de.manager");
    const lead = await as("de.lead");
    // The Manager reaches every group; de.dev1 is in Fullstack (de.lead's), de.dev2 in DevOps.
    const ids = [await memberId(as, DE, "de.dev1", "de.manager"), await memberId(as, DE, "de.dev2", "de.manager")];
    const title = unique("E2E Assigned Cert");
    const res = await ok(await manager.post("/certifications/assignments", { mode: "assign", practiceId: DE, userIds: ids, cert: { title, type: "certification" }, dueDate: isoDay(40), note: "Client ask" }), "assign");
    expect(res.created).toHaveLength(2);
    expect(res.created[0]).toMatchObject({ source: "assigned", status: "planned", createdBy: { username: "de.manager" } });
    expect((await lead.json("/certifications/catalog")).items.map((i) => i.title)).toContain(title);
    const other = res.created.find((p) => p.owner.username === "de.dev2");
    expect((await lead.patch(`/certifications/plans/${other.id}`, { dueDate: isoDay(90) })).status()).toBe(404); // not de.lead's group

    const dev = await as("de.dev1");
    const mine = res.created.find((p) => p.owner.username === "de.dev1");
    expect((await dev.post(`/certifications/plans/${mine.id}/drop`, {})).status()).toBe(403);
    expect((await dev.patch(`/certifications/plans/${mine.id}`, { dueDate: isoDay(90) })).status()).toBe(403);
    const moved = await ok(await lead.patch(`/certifications/plans/${mine.id}`, { dueDate: isoDay(90) }), "lead moves due date");
    expect(moved.events[0]).toMatchObject({ kind: "updated", author: { username: "de.lead" } });
  });

  test("[CERT-API-11] assign needs a due date in the future; only practice members; not across practices", async ({ as }) => {
    const lead = await as("de.lead");
    const dev = await memberId(as, DE, "de.dev1");
    const body = { mode: "assign", practiceId: DE, userIds: [dev], cert: oneOff() };
    expect((await (await lead.post("/certifications/assignments", body)).json()).error).toBe("An assignment needs a due date");
    expect((await (await lead.post("/certifications/assignments", { ...body, dueDate: isoDay(-1) })).json()).error).toBe("The due date can't be in the past");
    const qaTester = await memberId(as, "qa", "qa.tester1", "qa.lead");
    expect((await lead.post("/certifications/assignments", { ...body, userIds: [qaTester], dueDate: isoDay(5) })).status()).toBe(400);
    expect((await (await as("qa.lead")).post("/certifications/assignments", { ...body, dueDate: isoDay(5) })).status()).toBe(403);
    expect((await (await as("de.dev1")).post("/certifications/assignments", { ...body, dueDate: isoDay(5) })).status()).toBe(403);
  });

  test("[CERT-API-12] recommendation: accept needs dates; decline closes it; someone with an open plan is skipped", async ({ as }) => {
    const manager = await as("de.manager");
    const dev = await as("de.dev1");
    const devId = await memberId(as, DE, "de.dev1");
    const item = await ok(await manager.post("/certifications/catalog", { title: unique("E2E Recommend"), type: "course" }), "add");
    const { created } = await ok(await manager.post("/certifications/assignments", { mode: "suggest", practiceId: DE, userIds: [devId], catalogId: item.id, note: "Good next step" }), "suggest");
    const plan = created[0];
    expect(plan.status).toBe("suggested");
    const again = await ok(await manager.post("/certifications/assignments", { mode: "suggest", practiceId: DE, userIds: [devId], catalogId: item.id }), "suggest twice");
    expect(again.skipped[0].reason).toBe("Already has an open plan for it");

    expect((await dev.post(`/certifications/plans/${plan.id}/accept`, {})).status()).toBe(400);
    expect((await manager.post(`/certifications/plans/${plan.id}/accept`, { startDate: isoDay(0), dueDate: isoDay(5) })).status()).toBe(403);
    const declined = await ok(await dev.post(`/certifications/plans/${plan.id}/decline`, { reason: "Not this quarter" }), "decline");
    expect(declined.status).toBe("declined");
    expect(declined.events[0]).toMatchObject({ kind: "declined", body: "Not this quarter" });
  });

  test("[CERT-API-13] withdraw: the recommender's peers can; once accepted it's the member's plan", async ({ as }) => {
    const lead = await as("de.lead");
    const devId = await memberId(as, DE, "de.dev1");
    const make = async () => (await ok(await lead.post("/certifications/assignments", { mode: "suggest", practiceId: DE, userIds: [devId], cert: oneOff("E2E Withdraw") }), "suggest")).created[0];
    const p1 = await make();
    expect((await ok(await (await as("de.manager")).post(`/certifications/plans/${p1.id}/withdraw`, {}), "withdraw")).status).toBe("dropped");
    const p2 = await make();
    await ok(await (await as("de.dev1")).post(`/certifications/plans/${p2.id}/accept`, { startDate: isoDay(0), dueDate: isoDay(9) }), "accept");
    expect((await lead.post(`/certifications/plans/${p2.id}/withdraw`, {})).status()).toBe(403);
  });
});

test.describe("Certification API — completion & approval", () => {
  test("[CERT-API-14] completion needs a date, a verification link and a certificate; a claim needs a receipt", async ({ as }) => {
    const dev = await as("de.dev1");
    const plan = await createPlan(dev);
    const cert = await uploadCertFile(dev, plan.id);
    const base = { completedOn: isoDay(0), verificationUrl: "https://verify.example.com/x", certificateFileIds: [cert.id] };
    for (const [patch, message] of [
      [{ verificationUrl: "" }, "A verification link is required"],
      [{ verificationUrl: "ftp://x" }, "Not a valid http(s) link: ftp://x"],
      [{ completedOn: isoDay(2) }, "The completion date can't be in the future"],
      [{ certificateFileIds: [] }, "Attach the certificate"],
      [{ reimbursement: { amount: 500, currency: "INR", receiptFileIds: [] } }, "Attach the payment receipt"],
      [{ reimbursement: { amount: 500, currency: "EUR", receiptFileIds: [] } }, "Pick a currency (INR or USD)"],
    ]) {
      const res = await dev.post(`/certifications/plans/${plan.id}/submit`, { ...base, ...patch });
      expect(res.status(), message).toBe(400);
      expect((await res.json()).error).toBe(message);
    }
  });

  test("[CERT-API-15] uploads: PDFs/images only, and only by the owner", async ({ as }) => {
    const dev = await as("de.dev1");
    const plan = await createPlan(dev);
    expect((await dev.upload("POST", `/certifications/plans/${plan.id}/files?fileName=x.html`, Buffer.from("<b>x</b>"), "text/html")).status()).toBe(400);
    expect((await (await as("de.lead")).upload("POST", `/certifications/plans/${plan.id}/files?fileName=c.pdf`, makePdf("c"), "application/pdf")).status()).toBe(403);
    const img = await uploadCertFile(dev, plan.id, "certificate", { name: "cert.png", buffer: Buffer.from("89504e470d0a1a0a", "hex"), type: "image/png" });
    expect(img).toMatchObject({ kind: "certificate", contentType: "image/png" });
  });

  test("[CERT-API-16] full chain: Lead rejects → back to planned → resubmit → Lead approves → Manager clarifies → resubmit → completed", async ({ as }) => {
    const dev = await as("de.dev1");
    const lead = await as("de.lead");
    const manager = await as("de.manager");
    const plan = await inCertLeadReview(as, { claim: { amount: 4500 } });
    expect(plan.status).toBe("lead_review");

    expect((await dev.post(`/certifications/plans/${plan.id}/review`, { decision: "approve" })).status()).toBe(403);
    expect((await lead.post(`/certifications/plans/${plan.id}/review`, { decision: "reject" })).status()).toBe(400); // comment required
    const rejected = await decide(lead, plan, "reject", "Link is broken");
    expect(rejected).toMatchObject({ status: "planned", leadReview: null });
    expect(rejected.completion.reimbursement.amount).toBe(4500); // kept for the resubmit

    const c = rejected.completion;
    const resubmit = async (note) => ok(await dev.post(`/certifications/plans/${plan.id}/submit`, { completedOn: isoDay(0), verificationUrl: c.verificationUrl, certificateFileIds: c.certificateFileIds, reimbursement: c.reimbursement, note }), "resubmit");
    expect((await resubmit()).status).toBe("lead_review");
    expect((await decide(lead, plan, "approve")).status).toBe("manager_review");
    expect((await lead.post(`/certifications/plans/${plan.id}/review`, { decision: "approve" })).status()).toBe(403); // no verify
    expect((await decide(manager, plan, "clarify", "Which exam version?")).status).toBe("clarification");
    expect((await resubmit("v3")).status).toBe("manager_review"); // back to the reviewer who asked
    const done = await decide(manager, plan, "approve");
    expect(done).toMatchObject({ status: "completed", reimbursement: { amount: 4500, currency: "INR" }, managerReview: { by: { username: "de.manager" } } });
    expect(done.events.slice(0, 2).map((e) => e.kind)).toEqual(["completed", "review"]);
  });

  test("[CERT-API-17] the person who did the Lead step can't give final approval; Practices Admin can", async ({ as }) => {
    const manager = await as("de.manager");
    const plan = await inCertLeadReview(as);
    await decide(manager, plan, "approve"); // Manager covers the Lead step
    expect((await manager.post(`/certifications/plans/${plan.id}/review`, { decision: "approve" })).status()).toBe(403);
    expect((await decide(await as("practices.admin"), plan, "approve")).status).toBe("completed");
  });

  test("[CERT-API-18] a file that was part of a submission can't be deleted afterwards", async ({ as }) => {
    const dev = await as("de.dev1");
    const plan = await inCertLeadReview(as);
    const rejected = await decide(await as("de.lead"), plan, "reject", "Wrong file");
    const res = await dev.delete(`/certifications/plans/${plan.id}/files/${rejected.completion.certificateFileIds[0]}`);
    expect(res.status()).toBe(409);
  });

  test("[CERT-API-19] unauthenticated requests are refused", async ({ as }) => {
    const anon = await as(null);
    expect((await anon.get("/certifications/plans")).status()).toBe(401);
    expect((await anon.get("/certifications/catalog")).status()).toBe(401);
  });
});
