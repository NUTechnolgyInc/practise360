// CON-API — practice contributions: create/validate, isolation, workflow, review separation, people, files
// (docs/rbac.md §4 "Practice contributions", apps/api/src/rbac/contribution-access.js).
const { test, expect, unique, isoDay } = require("../../support/fixtures");
const { makePdf, bigBuffer, MB } = require("../../support/files");
const { ok, createContribution, uploadFile, submit, review, inLeadReview, SUBMISSION } = require("../../support/contributions");

const userId = async (as, username) => (await (await as(username)).me()).id;

test.describe("Contributions API — create & validate", () => {
  test("[CON-API-01] practitioner starts a contribution in their practice", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev, { title: "  Shared auth kit  " });
    expect(c).toMatchObject({ title: "Shared auth kit", status: "in_progress", practice: { id: "digital-engineering" }, owner: { username: "de.dev1" }, mine: true });
    expect(c.events.map((e) => e.kind)).toEqual(["created"]);
    expect(c.actions).toMatchObject({ edit: true, submit: true, logProgress: true, review: false, approve: false });
  });

  const base = { title: "Valid", practiceId: "digital-engineering", type: "blog", startDate: isoDay(0), dueDate: isoDay(10) };
  for (const [label, patch, message] of [
    ["blank title", { title: "   " }, "Title is required"],
    ["unknown type", { type: "podcast" }, "Pick a contribution type"],
    ["'other' without a custom label", { type: "other", customType: " " }, "Name the custom type"],
    ["missing due date", { dueDate: undefined }, "Start and due dates are required (YYYY-MM-DD)"],
    ["non-ISO date", { startDate: "12/11/2026" }, "Start and due dates are required (YYYY-MM-DD)"],
    ["garbage after the date", { dueDate: "2027-01-15x" }, "Start and due dates are required (YYYY-MM-DD)"],
    // Feb 31 must not silently roll over to 3 March.
    ["impossible calendar date (Feb 31)", { startDate: "2027-02-01", dueDate: "2027-02-31" }, "Start and due dates are required (YYYY-MM-DD)"],
    ["due date before start date", { startDate: isoDay(5), dueDate: isoDay(1) }, "Due date can't be before the start date"],
  ]) {
    test(`[CON-API-02] create rejects ${label} → 400`, async ({ as }) => {
      const res = await (await as("de.dev1")).post("/contributions", { ...base, ...patch });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(message);
    });
  }

  test("[CON-API-03] 'other' type keeps its custom label; a 120-char title is fine, 121 is refused (not cut)", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev, { type: "other", customType: "Conference talk", title: "T".repeat(120) });
    expect(c.customType).toBe("Conference talk");
    expect(c.title).toHaveLength(120);
    const res = await dev.post("/contributions", { ...base, title: "T".repeat(121) });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Title is too long (max 120 characters)");
  });

  test("[CON-API-04] same-day start and due date is allowed (boundary)", async ({ as }) => {
    const c = await createContribution(await as("de.dev1"), { startDate: isoDay(0), dueDate: isoDay(0) });
    expect(c.status).toBe("in_progress");
  });

  test("[CON-API-05] practitioner can't start a contribution in another practice", async ({ as }) => {
    const res = await (await as("de.dev1")).post("/contributions", { ...base, practiceId: "qa" });
    expect(res.status()).toBe(403);
  });

  for (const username of ["cert.admin", "aitracker.member", "de.coordinator"]) {
    test(`[CON-API-06] ${username} (no contribution permissions) can neither list nor create`, async ({ as }) => {
      const client = await as(username);
      expect((await client.get("/contributions")).status()).toBe(403);
      expect((await client.post("/contributions", base)).status()).toBe(403);
    });
  }

  test("[CON-API-07] unauthenticated requests are refused", async ({ as }) => {
    const anon = await as(null);
    expect((await anon.get("/contributions")).status()).toBe(401);
    expect((await anon.post("/contributions", base)).status()).toBe(401);
  });
});

test.describe("Contributions API — visibility & isolation", () => {
  test("[CON-API-08] another practice gets 404 (not 403) so the contribution's existence isn't leaked", async ({ as }) => {
    const c = await createContribution(await as("de.dev1"));
    for (const outsider of ["qa.tester1", "qa.manager", "platform.lead"]) {
      const res = await (await as(outsider)).get(`/contributions/${c.id}`);
      expect(res.status(), outsider).toBe(404);
      expect(await res.json()).toEqual({ error: "Contribution not found" });
    }
  });

  test("[CON-API-09] the whole practice can see it; Practices Admin and Super Admin see every practice", async ({ as }) => {
    const c = await createContribution(await as("de.dev1"));
    for (const viewer of ["de.lead", "de.manager", "practices.admin", "superadmin"]) {
      expect((await (await as(viewer)).get(`/contributions/${c.id}`)).status(), viewer).toBe(200);
    }
    const qaList = await (await as("qa.tester1")).json("/contributions");
    expect(qaList.contributions.map((r) => r.id)).not.toContain(c.id);
    expect(qaList.practices.map((p) => p.id)).toEqual(["qa"]);
    const adminList = await (await as("practices.admin")).json("/contributions");
    expect(adminList.contributions.map((r) => r.id)).toContain(c.id);
    expect(adminList.practices).toHaveLength(4);
  });

  test("[CON-API-10] list filters: practice, status, type, mine, search (regex characters are treated literally)", async ({ as }) => {
    const dev = await as("de.dev1");
    const title = unique("Filter (probe) [x]*");
    const c = await createContribution(dev, { title, type: "case_study" });
    const ids = async (q) => (await dev.json(`/contributions?${q}`)).contributions.map((r) => r.id);
    expect(await ids(`q=${encodeURIComponent("(probe) [x]*")}`)).toContain(c.id);
    expect(await ids("q=.*")).not.toContain(c.id); // ".*" must not act as a wildcard
    expect(await ids("type=case_study")).toContain(c.id);
    expect(await ids("type=blog")).not.toContain(c.id);
    expect(await ids("status=published")).not.toContain(c.id);
    expect(await ids("mine=true")).toContain(c.id);
    expect(await ids("practiceId=qa")).toEqual([]); // not a practice de.dev1 can see
    expect((await dev.get("/contributions?q=%28%28%28%5B")).status()).toBe(200);
  });

  test("[CON-API-11] malformed or unknown ids → 404", async ({ as }) => {
    const dev = await as("de.dev1");
    expect((await dev.get("/contributions/not-an-id")).status()).toBe(404);
    expect((await dev.get("/contributions/64b000000000000000000000")).status()).toBe(404);
    expect((await dev.post("/contributions/64b000000000000000000000/updates", { body: "x" })).status()).toBe(404);
  });

  test("[CON-API-12] invite picker lists only members of that practice; other practices → 403", async ({ as }) => {
    const people = await (await as("de.dev1")).json("/contributions/practices/digital-engineering/people");
    // Invites span the whole practice, across groups. The coordinator can't contribute.
    expect(people.map((p) => p.username).sort()).toEqual(["de.dev1", "de.dev2", "de.lead", "de.lead2", "de.manager"]);
    expect((await (await as("de.dev1")).get("/contributions/practices/qa/people")).status()).toBe(403);
  });
});

test.describe("Contributions API — editing & progress", () => {
  test("[CON-API-13] a practice member who isn't the owner or a contributor can't edit or log progress", async ({ as }) => {
    const c = await createContribution(await as("de.lead"));
    const dev = await as("de.dev1");
    expect((await dev.patch(`/contributions/${c.id}`, { title: "Hijacked" })).status()).toBe(403);
    expect((await dev.post(`/contributions/${c.id}/updates`, { body: "me too" })).status()).toBe(403);
    expect((await dev.upload("POST", `/contributions/${c.id}/files?fileName=x.pdf`, makePdf(), "application/pdf")).status()).toBe(403);
  });

  test("[CON-API-14] owner edits details; invalid edits are refused", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    const saved = await ok(await dev.patch(`/contributions/${c.id}`, { title: "Renamed", type: "other", customType: "Workshop" }), "edit");
    expect(saved).toMatchObject({ title: "Renamed", type: "other", customType: "Workshop" });
    expect((await dev.patch(`/contributions/${c.id}`, { title: "" })).status()).toBe(400);
    expect((await dev.patch(`/contributions/${c.id}`, { dueDate: "1999-01-01" })).status()).toBe(400);
    expect((await dev.patch(`/contributions/${c.id}`, { startDate: "soon" })).status()).toBe(400);
    expect((await dev.patch(`/contributions/${c.id}`, { type: "other", customType: "" })).status()).toBe(400);
  });

  test("[CON-API-15] progress updates: empty body refused, attached files become permanent", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    expect((await dev.post(`/contributions/${c.id}/updates`, { body: "   " })).status()).toBe(400);
    const file = await uploadFile(dev, c.id, { name: "progress.png", buffer: Buffer.from("png-bytes"), type: "image/png" });
    const after = await ok(await dev.post(`/contributions/${c.id}/updates`, { body: "Added the **backend** provider", fileIds: [file.id, "64b000000000000000000000"] }), "post update");
    const update = after.events.find((e) => e.kind === "progress");
    expect(update.fileIds).toEqual([file.id]); // foreign/unknown file ids are dropped
    const del = await dev.delete(`/contributions/${c.id}/files/${file.id}`);
    expect(del.status()).toBe(409);
  });

  test("[CON-API-16] a Lead (manage permission) can log progress on any contribution in the practice", async ({ as }) => {
    const c = await createContribution(await as("de.dev1"));
    const res = await (await as("de.lead")).post(`/contributions/${c.id}/updates`, { body: "Lead note" });
    expect(res.status()).toBe(201);
  });
});

test.describe("Contributions API — files", () => {
  test("[CON-API-17] PDFs are served inline; HTML is forced to download with nosniff (no stored XSS)", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    const pdf = await uploadFile(dev, c.id);
    const html = await uploadFile(dev, c.id, { name: "evil.html", buffer: Buffer.from("<script>alert(1)</script>"), type: "text/html" });
    const pdfRes = await dev.get(`/contributions/${c.id}/files/${pdf.id}`);
    expect(pdfRes.headers()["content-type"]).toBe("application/pdf");
    expect(pdfRes.headers()["content-disposition"]).toMatch(/^inline/);
    const htmlRes = await dev.get(`/contributions/${c.id}/files/${html.id}`);
    expect(htmlRes.headers()["content-type"]).toBe("application/octet-stream");
    expect(htmlRes.headers()["content-disposition"]).toMatch(/^attachment/);
    expect(htmlRes.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("[CON-API-18] file names are sanitised (no path traversal or header injection)", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    const f = await uploadFile(dev, c.id, { name: '../../etc/passwd"\r\nX-Evil: 1.pdf' });
    expect(f.fileName).not.toMatch(/[/"\r\n]/);
    const res = await dev.get(`/contributions/${c.id}/files/${f.id}`);
    expect(res.headers()["x-evil"]).toBeUndefined();
  });

  test("[CON-API-19] empty upload → 400; over 4 MB → 413", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    expect((await dev.upload("POST", `/contributions/${c.id}/files?fileName=empty.txt`, Buffer.alloc(0), "text/plain")).status()).toBe(400);
    expect((await dev.upload("POST", `/contributions/${c.id}/files?fileName=big.bin`, bigBuffer(4 * MB + 10), "application/octet-stream")).status()).toBe(413);
  });

  test("[CON-API-20] files of another practice's contribution can't be fetched; unknown file ids → 404", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    const f = await uploadFile(dev, c.id);
    expect((await (await as("qa.tester1")).get(`/contributions/${c.id}/files/${f.id}`)).status()).toBe(404);
    expect((await dev.get(`/contributions/${c.id}/files/64b000000000000000000000`)).status()).toBe(404);
    expect((await dev.get(`/contributions/${c.id}/files/nope`)).status()).toBe(404);
  });

  test("[CON-API-21] a contributor can't remove a file the owner uploaded; the owner can", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    const file = await uploadFile(lead, c.id);
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: await userId(as, "de.dev1") }), "invite");
    const dev = await as("de.dev1");
    await ok(await dev.post(`/contributions/${c.id}/invites/respond`, { accept: true }), "accept");
    expect((await dev.delete(`/contributions/${c.id}/files/${file.id}`)).status()).toBe(403);
    expect((await lead.delete(`/contributions/${c.id}/files/${file.id}`)).status()).toBe(204);
  });
});

test.describe("Contributions API — submit & review workflow", () => {
  test("[CON-API-22] happy path: practitioner submits → Lead approves → Manager approves → published", async ({ as }) => {
    const dev = await as("de.dev1");
    const submitted = await inLeadReview(dev);
    expect(submitted.status).toBe("lead_review");
    expect(submitted.actions.edit).toBe(false); // frozen while in review
    const afterLead = await review(await as("de.lead"), submitted.id, "approve");
    expect(afterLead.status).toBe("manager_review");
    expect(afterLead.leadReview.by.username).toBe("de.lead");
    const published = await review(await as("de.manager"), submitted.id, "approve", "Great work");
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();
    expect(published.events.slice(0, 2).map((e) => e.kind)).toEqual(["published", "review"]);
    // Closed: nothing else can happen to it.
    expect(published.actions).toMatchObject({ edit: false, logProgress: false, submit: false, manageMembers: false });
    expect((await dev.post(`/contributions/${submitted.id}/updates`, { body: "late" })).status()).toBe(403);
  });

  for (const [label, extra, expected] of [
    ["no summary", { summary: "" }, "A summary is required to submit"],
    ["no impact", { impact: "  " }, "The impact is required to submit"],
    ["no documents", { fileIds: [] }, "Attach at least one document"],
    ["javascript: repo link", { repoUrl: "javascript:alert(1)" }, "Not a valid http(s) link: javascript:alert(1)"],
    ["ftp demo link", { demoUrl: "ftp://files.example" }, "Not a valid http(s) link: ftp://files.example"],
    ["bad extra link", { links: [{ label: "x", url: "www.no-scheme.example" }] }, "Not a valid http(s) link: www.no-scheme.example"],
  ]) {
    test(`[CON-API-23] submit refused: ${label}`, async ({ as }) => {
      const dev = await as("de.dev1");
      const c = await createContribution(dev);
      const file = await uploadFile(dev, c.id);
      const res = await dev.post(`/contributions/${c.id}/submit`, { ...SUBMISSION, fileIds: [file.id], ...extra });
      expect(res.status()).toBe(400);
      expect((await res.json()).problems).toContain(expected);
    });
  }

  test("[CON-API-24] submit refused without a description, and file ids from another contribution don't count", async ({ as }) => {
    const dev = await as("de.dev1");
    const other = await createContribution(dev);
    const foreign = await uploadFile(dev, other.id);
    const c = await createContribution(dev, { description: "" });
    const res = await dev.post(`/contributions/${c.id}/submit`, { ...SUBMISSION, fileIds: [foreign.id] });
    expect(res.status()).toBe(400);
    expect((await res.json()).problems).toEqual(expect.arrayContaining(["A description is required to submit", "Attach at least one document"]));
  });

  test("[CON-API-25] only the owner can submit — not a contributor or the Lead", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(await as("de.dev1")); // de.dev1 is in de.lead's group, so the Lead can add files
    const file = await uploadFile(lead, c.id);
    const res = await lead.post(`/contributions/${c.id}/submit`, { ...SUBMISSION, fileIds: [file.id] });
    expect(res.status()).toBe(403);
  });

  test("[CON-API-26] nobody reviews their own work: a Lead-owned contribution is reviewed by the Manager, who then can't also approve", async ({ as }) => {
    const lead = await as("de.lead");
    const manager = await as("de.manager");
    const c = await inLeadReview(lead);
    const self = await lead.post(`/contributions/${c.id}/review`, { decision: "approve" });
    expect(self.status()).toBe(403);
    const afterLeadStep = await review(manager, c.id, "approve"); // Manager takes the Lead step
    expect(afterLeadStep.status).toBe("manager_review");
    const twice = await manager.post(`/contributions/${c.id}/review`, { decision: "approve" });
    expect(twice.status()).toBe(403); // same person can't do both steps
    const published = await review(await as("practices.admin"), c.id, "approve");
    expect(published.status).toBe("published");
  });

  test("[CON-API-27] a practitioner can't review, and a Lead can't give final approval", async ({ as }) => {
    const c = await inLeadReview(await as("de.dev1"));
    expect((await (await as("de.dev2")).post(`/contributions/${c.id}/review`, { decision: "approve" })).status()).toBe(403);
    await review(await as("de.lead"), c.id, "approve");
    const leadFinal = await (await as("de.lead")).post(`/contributions/${c.id}/review`, { decision: "approve" });
    expect(leadFinal.status()).toBe(403);
    expect((await (await as("qa.manager")).post(`/contributions/${c.id}/review`, { decision: "approve" })).status()).toBe(404);
  });

  test("[CON-API-27b] only the Lead of the owner's group reviews; another group's Lead sees it but can't act", async ({ as }) => {
    const c = await inLeadReview(await as("de.dev1")); // de.dev1 sits in Fullstack
    const otherLead = await as("de.lead2"); // leads DevOps
    const seen = await otherLead.json(`/contributions/${c.id}`);
    expect(seen.actions).toMatchObject({ view: true, review: false, logProgress: false });
    expect((await otherLead.post(`/contributions/${c.id}/review`, { decision: "approve" })).status()).toBe(403);
    expect((await review(await as("de.lead"), c.id, "approve")).status).toBe("manager_review");
  });

  test("[CON-API-28] decline and clarify need a comment; unknown decisions are refused", async ({ as }) => {
    const c = await inLeadReview(await as("de.dev1"));
    const lead = await as("de.lead");
    for (const decision of ["decline", "clarify"]) {
      const res = await lead.post(`/contributions/${c.id}/review`, { decision, comment: "  " });
      expect(res.status(), decision).toBe(400);
      expect((await res.json()).error).toBe("Add a comment explaining the decision");
    }
    expect((await lead.post(`/contributions/${c.id}/review`, { decision: "maybe" })).status()).toBe(400);
  });

  test("[CON-API-29] clarification round-trip returns to the reviewer who asked (Lead stage, then Manager stage)", async ({ as }) => {
    const dev = await as("de.dev1");
    let c = await inLeadReview(dev);
    c = await review(await as("de.lead"), c.id, "clarify", "Which projects use it?");
    expect(c).toMatchObject({ status: "clarification", clarificationStage: "lead" });
    expect(c.actions.edit).toBe(true); // owner can update while answering
    c = await submit(dev, c, { note: "Used by 3 client projects" });
    expect(c.status).toBe("lead_review");
    c = await review(await as("de.lead"), c.id, "approve");
    c = await review(await as("de.manager"), c.id, "clarify", "Add the demo link");
    expect(c.clarificationStage).toBe("manager");
    c = await submit(dev, c, { demoUrl: "https://demo.example.com", note: "Added" });
    expect(c.status).toBe("manager_review"); // skips the Lead the second time
  });

  test("[CON-API-30] decline closes the contribution for good", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await review(await as("de.lead"), (await inLeadReview(dev)).id, "decline", "Duplicate of an existing framework");
    expect(c.status).toBe("declined");
    expect((await dev.patch(`/contributions/${c.id}`, { title: "Try again" })).status()).toBe(403);
    expect((await dev.post(`/contributions/${c.id}/submit`, SUBMISSION)).status()).toBe(403);
    expect((await dev.post(`/contributions/${c.id}/updates`, { body: "but" })).status()).toBe(403);
  });

  test("[CON-API-31] reviewing something that isn't waiting for review → 409", async ({ as }) => {
    const c = await createContribution(await as("de.dev1"));
    const res = await (await as("de.lead")).post(`/contributions/${c.id}/review`, { decision: "approve" });
    expect(res.status()).toBe(409);
  });

  test("[CON-API-32] 'awaiting my review' queue shows the item to the right reviewer only", async ({ as }) => {
    const c = await inLeadReview(await as("de.dev1"));
    const queue = async (u) => (await (await as(u)).json("/contributions?awaitingMe=true")).contributions.map((r) => r.id);
    expect(await queue("de.lead")).toContain(c.id);
    expect(await queue("de.dev1")).not.toContain(c.id);
    await review(await as("de.lead"), c.id, "approve");
    expect(await queue("de.lead")).not.toContain(c.id);
    expect(await queue("de.manager")).toContain(c.id);
  });
});

test.describe("Contributions API — people (invites, join requests, leaving)", () => {
  test("[CON-API-33] invite → accept makes a contributor who can edit and log progress but not submit", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    const devId = await userId(as, "de.dev1");
    const invited = await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "invite");
    expect(invited.invites.map((i) => i.user.username)).toEqual(["de.dev1"]);
    const dev = await as("de.dev1");
    const joined = await ok(await dev.post(`/contributions/${c.id}/invites/respond`, { accept: true }), "accept");
    expect(joined.contributors.map((p) => p.username)).toEqual(["de.dev1"]);
    expect(joined.actions).toMatchObject({ edit: true, logProgress: true, submit: false, leave: true, manageMembers: false });
    expect((await dev.patch(`/contributions/${c.id}`, { title: "Edited by contributor" })).status()).toBe(200);
  });

  test("[CON-API-34] invite validation: outsiders, duplicates and existing contributors are refused", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    expect((await lead.post(`/contributions/${c.id}/invites`, { userId: await userId(as, "qa.tester1") })).status()).toBe(400);
    expect((await lead.post(`/contributions/${c.id}/invites`, { userId: await userId(as, "de.lead") })).status()).toBe(400); // owner
    const devId = await userId(as, "de.dev1");
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "invite");
    const again = await lead.post(`/contributions/${c.id}/invites`, { userId: devId });
    expect(again.status()).toBe(400);
    expect((await again.json()).error).toBe("Already invited");
    expect((await (await as("de.dev1")).post(`/contributions/${c.id}/invites`, { userId: devId })).status()).toBe(403); // not owner/manager
  });

  test("[CON-API-35] declining an invite and withdrawing one both clear it", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    const devId = await userId(as, "de.dev1");
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "invite");
    const declined = await ok(await (await as("de.dev1")).post(`/contributions/${c.id}/invites/respond`, { accept: false }), "decline");
    expect(declined.invites).toEqual([]);
    expect(declined.contributors).toEqual([]);
    expect((await (await as("de.dev1")).post(`/contributions/${c.id}/invites/respond`, { accept: true })).status()).toBe(403); // no open invite
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "re-invite");
    const withdrawn = await ok(await lead.delete(`/contributions/${c.id}/invites/${devId}`), "withdraw");
    expect(withdrawn.invites).toEqual([]);
  });

  test("[CON-API-36] join request → owner accepts; duplicate requests are refused; the requester can cancel", async ({ as }) => {
    const lead = await as("de.lead");
    const dev = await as("de.dev1");
    const c = await createContribution(lead);
    const requested = await dev.post(`/contributions/${c.id}/join-requests`, { message: "I can write the tests" });
    expect(requested.status()).toBe(201);
    expect((await dev.post(`/contributions/${c.id}/join-requests`, {})).status()).toBe(403);
    const cancelled = await ok(await dev.delete(`/contributions/${c.id}/join-requests/mine`), "cancel");
    expect(cancelled.joinRequests).toEqual([]);
    await ok(await dev.post(`/contributions/${c.id}/join-requests`, { message: "again" }), "re-request");
    const accepted = await ok(await lead.post(`/contributions/${c.id}/join-requests/${await userId(as, "de.dev1")}`, { accept: true }), "accept");
    expect(accepted.contributors.map((p) => p.username)).toEqual(["de.dev1"]);
    expect(accepted.joinRequests).toEqual([]);
  });

  test("[CON-API-37] owner rejects a join request; answering a request that doesn't exist → 404", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    await ok(await (await as("de.dev1")).post(`/contributions/${c.id}/join-requests`, {}), "request");
    const devId = await userId(as, "de.dev1");
    const rejected = await ok(await lead.post(`/contributions/${c.id}/join-requests/${devId}`, { accept: false }), "reject");
    expect(rejected.contributors).toEqual([]);
    expect((await lead.post(`/contributions/${c.id}/join-requests/${devId}`, { accept: true })).status()).toBe(404);
  });

  test("[CON-API-38] inviting someone who already asked to join adds them straight away", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    await ok(await (await as("de.dev1")).post(`/contributions/${c.id}/join-requests`, {}), "request");
    const after = await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: await userId(as, "de.dev1") }), "invite");
    expect(after.contributors.map((p) => p.username)).toEqual(["de.dev1"]);
    expect(after.invites).toEqual([]);
  });

  test("[CON-API-39] nobody can join once it's in review, and other practices can't ask at all", async ({ as }) => {
    const c = await inLeadReview(await as("de.lead"));
    expect((await (await as("de.dev1")).post(`/contributions/${c.id}/join-requests`, {})).status()).toBe(403);
    expect((await (await as("qa.tester1")).post(`/contributions/${c.id}/join-requests`, {})).status()).toBe(404);
  });

  test("[CON-API-40] contributors can leave; the owner can't 'leave'; the owner can remove a contributor", async ({ as }) => {
    const lead = await as("de.lead");
    const c = await createContribution(lead);
    const devId = await userId(as, "de.dev1");
    const leadId = await userId(as, "de.lead");
    const dev = await as("de.dev1");
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "invite");
    await ok(await dev.post(`/contributions/${c.id}/invites/respond`, { accept: true }), "accept");
    const left = await ok(await dev.delete(`/contributions/${c.id}/contributors/${devId}`), "leave");
    expect(left.contributors).toEqual([]);
    expect((await lead.delete(`/contributions/${c.id}/contributors/${leadId}`)).status()).toBe(403);
    await ok(await lead.post(`/contributions/${c.id}/invites`, { userId: devId }), "re-invite");
    await ok(await dev.post(`/contributions/${c.id}/invites/respond`, { accept: true }), "re-accept");
    const removed = await ok(await lead.delete(`/contributions/${c.id}/contributors/${devId}`), "remove");
    expect(removed.events[0]).toMatchObject({ kind: "member", action: "removed" });
    expect((await lead.delete(`/contributions/${c.id}/contributors/${devId}`)).status()).toBe(404);
  });

  test("[CON-API-41] a contributor can't review the contribution they work on, even as a Lead", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    await ok(await dev.post(`/contributions/${c.id}/invites`, { userId: await userId(as, "de.lead") }), "invite lead");
    await ok(await (await as("de.lead")).post(`/contributions/${c.id}/invites/respond`, { accept: true }), "lead joins");
    const submitted = await submit(dev, await (await as("de.dev1")).json(`/contributions/${c.id}`));
    expect((await (await as("de.lead")).post(`/contributions/${submitted.id}/review`, { decision: "approve" })).status()).toBe(403);
    expect(await review(await as("de.manager"), submitted.id, "approve")).toMatchObject({ status: "manager_review" });
  });
});

test.describe("Contributions API — data integrity edge cases", () => {
  test("[CON-API-42] an over-long description is refused with a clear message, not silently cut (no data loss)", async ({ as }) => {
    const dev = await as("de.dev1");
    const body = { title: "Big write-up", practiceId: "digital-engineering", type: "blog", startDate: isoDay(0), dueDate: isoDay(5) };
    const res = await dev.post("/contributions", { ...body, description: "A".repeat(210_000) }); // under the 1 MB body cap
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe("Description is too long (max 200,000 characters)");
    const atLimit = await ok(await dev.post("/contributions", { ...body, description: "A".repeat(200_000) }), "200,000 chars");
    expect(atLimit.description).toHaveLength(200_000); // boundary: exactly the limit is kept whole
    expect((await dev.patch(`/contributions/${atLimit.id}`, { description: "B".repeat(200_001) })).status()).toBe(400);
  });

  test("[CON-API-43] clients can't set owner, status or practice through create/edit (mass assignment)", async ({ as }) => {
    const dev = await as("de.dev1");
    const leadId = (await (await as("de.lead")).me()).id;
    const c = await createContribution(dev, { status: "published", ownerId: leadId, publishedAt: new Date().toISOString(), contributorIds: [leadId] });
    expect(c).toMatchObject({ status: "in_progress", owner: { username: "de.dev1" }, publishedAt: null, contributors: [] });
    const edited = await ok(await dev.patch(`/contributions/${c.id}`, { practiceId: "qa", status: "published", ownerId: leadId }), "patch");
    expect(edited).toMatchObject({ status: "in_progress", practice: { id: "digital-engineering" }, owner: { username: "de.dev1" } });
  });

  test("[CON-API-44] unicode and emoji titles round-trip and are searchable", async ({ as }) => {
    const dev = await as("de.dev1");
    const title = unique("Café ✨ 日本語 — naïve résumé");
    const c = await createContribution(dev, { title });
    expect(c.title).toBe(title);
    const found = await dev.json(`/contributions?q=${encodeURIComponent("日本語")}`);
    expect(found.contributions.map((r) => r.id)).toContain(c.id);
  });

  test("[CON-API-45] over-long summary, comment, progress update and link are refused with the field named", async ({ as }) => {
    const dev = await as("de.dev1");
    const c = await createContribution(dev);
    const file = await uploadFile(dev, c.id);
    const submitWith = (extra) => dev.post(`/contributions/${c.id}/submit`, { ...SUBMISSION, fileIds: [file.id], ...extra });
    for (const [extra, message] of [
      [{ summary: "s".repeat(10_001) }, "Summary is too long (max 10,000 characters)"],
      [{ impact: "i".repeat(10_001) }, "Impact is too long (max 10,000 characters)"],
      [{ links: [{ label: "x", url: `https://example.com/${"p".repeat(500)}` }] }, "Link is too long (max 500 characters)"],
    ]) {
      const res = await submitWith(extra);
      expect(res.status(), message).toBe(400);
      expect((await res.json()).error).toBe(message);
    }
    const update = await dev.post(`/contributions/${c.id}/updates`, { body: "u".repeat(50_001) });
    expect((await update.json()).error).toBe("Update is too long (max 50,000 characters)");
    const submitted = await ok(await submitWith({ summary: "s".repeat(10_000) }), "summary at the limit");
    expect(submitted.submission.summary).toHaveLength(10_000);
    const res = await (await as("de.lead")).post(`/contributions/${c.id}/review`, { decision: "clarify", comment: "c".repeat(10_001) });
    expect((await res.json()).error).toBe("Comment is too long (max 10,000 characters)");
    expect((await (await as("de.dev1")).json(`/contributions/${c.id}`)).status).toBe("lead_review"); // nothing changed
  });

  test("[CON-API-46] calendar edge dates: leap day only in leap years; full ISO timestamps still accepted", async ({ as }) => {
    const dev = await as("de.dev1");
    const base = { title: "Dates", practiceId: "digital-engineering", type: "blog" };
    const leap = await createContribution(dev, { startDate: "2028-02-01", dueDate: "2028-02-29" });
    expect(leap.dueDate.slice(0, 10)).toBe("2028-02-29");
    const notLeap = await dev.post("/contributions", { ...base, startDate: "2027-02-01", dueDate: "2027-02-29" });
    expect(notLeap.status()).toBe(400);
    for (const bad of ["2027-04-31", "2027-13-01", "2027-00-10"]) {
      expect((await dev.post("/contributions", { ...base, startDate: "2027-01-01", dueDate: bad })).status(), bad).toBe(400);
    }
    const iso = await createContribution(dev, { startDate: "2027-03-01T00:00:00.000Z", dueDate: "2027-03-31T00:00:00.000Z" });
    expect(iso.dueDate.slice(0, 10)).toBe("2027-03-31");
  });
});

