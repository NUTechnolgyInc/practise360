// Certification Tracker rules (docs/rbac.md §4 "Certification Tracker") against the seeded catalog. No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { PRACTICES, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { checkGrant } = require("../src/rbac/engine");
const cert = require("../src/rbac/cert-access");
const { FULLSTACK, DEVOPS, QA_AUTO, treeWith } = require("./fixtures");

const { certActionsFor, completionProblems, nextStatus, viewablePractices, ownPractices, assignablePractices, isOverdue, isExpired } = cert;
const roles = Object.fromEntries(SYSTEM_ROLES.map((r) => [r._id, r]));
const userWith = (id, ...assignments) => ({
  id,
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const DE = "digital-engineering";
const owner = userWith("owner", ["practitioner", "practice", DE]);
const peer = userWith("peer", ["practitioner", "practice", DE]);
// Leads lead a group and are practice members too. owner, peer and lead sit in DE Fullstack.
const qaLead = userWith("qaLead", ["practitioner", "practice", "qa"], ["practice_lead", "group", QA_AUTO]);
const lead = userWith("lead", ["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);
const devopsLead = userWith("devopsLead", ["practitioner", "practice", DE], ["practice_lead", "group", DEVOPS]);
const TREE = treeWith([["owner", FULLSTACK], ["peer", FULLSTACK], ["lead", FULLSTACK], ["devopsLead", DEVOPS]]);
const manager = userWith("manager", ["practice_manager", "practice", DE]);
const admin = userWith("admin", ["practices_admin", "app", "practices"]);
const certAdmin = userWith("certAdmin", ["cert_admin", "app", "cert-tracker"]);

const plan = (over = {}) => ({ practiceId: DE, ownerId: "owner", source: "self", status: "planned", dueDate: "2099-01-01", ...over });
const acts = (user, over) => certActionsFor(user, plan(over), TREE);

test("owner, Lead, Manager, admins and Cert Admin see a plan; peers and other practices don't", () => {
  for (const u of [owner, lead, manager, admin, certAdmin]) assert.ok(acts(u).view, u.id);
  assert.ok(!acts(peer).view, "practitioners don't see each other's plans");
  assert.ok(!acts(qaLead).view, "a QA Lead doesn't see DE plans");
  assert.deepEqual(viewablePractices(lead, TREE), [DE], "a group Lead has a team view in their practice");
  assert.equal(viewablePractices(certAdmin, TREE).length, PRACTICES.length, "Cert Admin's app-scope grant reaches every practice");
  assert.deepEqual(viewablePractices(owner, TREE), []);
});

test("a Lead reaches only their own group's members; the Manager reaches everyone", () => {
  const s = { status: "lead_review" };
  assert.ok(!acts(devopsLead, s).view && !acts(devopsLead, s).review, "another group's Lead");
  const loner = plan({ ...s, ownerId: "loner" }); // not in any group
  assert.ok(!certActionsFor(lead, loner, TREE).review, "members outside every group fall to the Manager");
  assert.ok(certActionsFor(manager, loner, TREE).review);
  assert.ok(cert.canForMember(lead, "cert.plan.assign", DE, "owner", TREE));
  assert.ok(!cert.canForMember(lead, "cert.plan.assign", DE, "devopsLead", TREE));
  assert.ok(cert.canForMember(manager, "cert.plan.assign", DE, "devopsLead", TREE));
});

test("moving a member to another group hands their open plans to that group's Lead", () => {
  const moved = treeWith([["owner", DEVOPS], ["lead", FULLSTACK], ["devopsLead", DEVOPS]]);
  assert.ok(certActionsFor(devopsLead, plan({ status: "lead_review" }), moved).review);
  assert.ok(!certActionsFor(lead, plan({ status: "lead_review" }), moved).review);
});

test("practice members plan their own certs only in their practice", () => {
  assert.deepEqual(ownPractices(owner, TREE), [DE]);
  assert.deepEqual(ownPractices(lead, TREE), [DE]);
  assert.deepEqual(assignablePractices(owner, TREE), [], "a Practitioner can't assign");
  assert.deepEqual(assignablePractices(lead, TREE), [DE]);
});

test("owner edits, uploads and submits while planned or awaiting clarification", () => {
  for (const status of ["planned", "clarification"]) {
    const a = acts(owner, { status });
    assert.ok(a.edit && a.upload && a.submit && a.editDueDate, status);
  }
  for (const status of ["suggested", "lead_review", "manager_review", "completed", "dropped"]) assert.ok(!acts(owner, { status }).submit, status);
  assert.ok(!acts(lead).submit, "only the owner submits");
});

test("a recommendation is accepted or declined by its owner; an assignment can't be declined or dropped", () => {
  const suggested = { source: "suggested", status: "suggested", createdBy: "lead" };
  assert.ok(acts(owner, suggested).accept && acts(owner, suggested).decline);
  assert.ok(!acts(lead, suggested).accept);
  assert.ok(acts(owner, { source: "suggested" }).drop, "an accepted recommendation is the member's own plan");
  const assigned = { source: "assigned", createdBy: "lead" };
  assert.ok(!acts(owner, assigned).drop && !acts(owner, assigned).decline);
  assert.ok(acts(owner, assigned).submit, "but it can be completed");
});

test("an assigned due date is moved by an assigner, not by the owner", () => {
  const assigned = { source: "assigned" };
  assert.ok(!acts(owner, assigned).editDueDate);
  assert.ok(acts(lead, assigned).editDueDate && acts(manager, assigned).editDueDate);
  assert.ok(!certActionsFor(lead, plan({ ...assigned, ownerId: "lead" }), TREE).editDueDate, "a Lead can't extend their own assignment");
  assert.ok(acts(owner).editDueDate, "self plans: the owner sets the due date");
});

test("withdraw: open recommendations (suggest) and assignments (assign), never by the owner", () => {
  assert.ok(acts(lead, { source: "suggested", status: "suggested" }).withdraw);
  assert.ok(!acts(lead, { source: "suggested", status: "planned" }).withdraw, "once accepted it's the member's plan");
  assert.ok(acts(manager, { source: "assigned" }).withdraw);
  assert.ok(!acts(lead, { source: "assigned", status: "lead_review" }).withdraw, "not mid-review");
  assert.ok(!acts(lead).withdraw, "self plans can't be withdrawn");
  assert.ok(!acts(peer, { source: "assigned" }).withdraw);
});

test("Lead step: Lead or Manager (or admins), never the owner", () => {
  const s = { status: "lead_review" };
  for (const u of [lead, manager, admin, certAdmin]) assert.ok(acts(u, s).review, u.id);
  assert.ok(!acts(owner, s).review && !acts(peer, s).review && !acts(qaLead, s).review);
  assert.ok(!certActionsFor(lead, plan({ ...s, ownerId: "lead" }), TREE).review, "a Lead can't review their own");
  assert.ok(!acts(lead, s).approve, "Lead step only");
});

test("Manager step: Manager or admins, not the owner and not whoever did the Lead step", () => {
  const s = { status: "manager_review", leadReview: { by: "lead" } };
  for (const u of [manager, admin, certAdmin]) assert.ok(acts(u, s).approve, u.id);
  assert.ok(!acts(lead, s).approve, "Leads don't hold cert.plan.verify");
  assert.ok(!acts(manager, { ...s, leadReview: { by: "manager" } }).approve, "the same person can't do both steps");
  assert.ok(!certActionsFor(manager, plan({ ...s, ownerId: "manager" }), TREE).approve);
});

test("decisions: approve advances, clarify pauses, reject reopens the plan", () => {
  assert.equal(nextStatus("lead", "approve"), "manager_review");
  assert.equal(nextStatus("manager", "approve"), "completed");
  assert.equal(nextStatus("lead", "clarify"), "clarification");
  assert.equal(nextStatus("manager", "reject"), "planned");
});

test("completion needs a date, a verification link and a certificate; reimbursement needs amount, currency and receipt", () => {
  const now = new Date("2026-11-12T10:00:00Z");
  const ok = { completedOn: new Date("2026-11-12"), verificationUrl: "https://example.com/verify/1", certificateFileIds: ["f1"], reimbursement: null };
  assert.deepEqual(completionProblems(ok, now), []);
  assert.equal(completionProblems({ ...ok, verificationUrl: "" }, now).length, 1);
  assert.equal(completionProblems({ ...ok, verificationUrl: "javascript:alert(1)" }, now).length, 1);
  assert.equal(completionProblems({ ...ok, certificateFileIds: [] }, now).length, 1);
  assert.equal(completionProblems({ ...ok, completedOn: new Date("2026-11-13") }, now).length, 1, "not in the future");
  assert.equal(completionProblems({ ...ok, expiresOn: new Date("2026-11-01") }, now).length, 1, "expiry after completion");
  const claim = { amount: 12000, currency: "INR", receiptFileIds: ["r1"] };
  assert.deepEqual(completionProblems({ ...ok, reimbursement: claim }, now), []);
  assert.equal(completionProblems({ ...ok, reimbursement: { ...claim, amount: 0 } }, now).length, 1);
  assert.equal(completionProblems({ ...ok, reimbursement: { ...claim, currency: "EUR" } }, now).length, 1);
  assert.equal(completionProblems({ ...ok, reimbursement: { ...claim, receiptFileIds: [] } }, now).length, 1);
});

test("overdue only while it's still being worked on; expired only once completed", () => {
  const now = new Date("2026-11-12");
  assert.ok(isOverdue(plan({ dueDate: "2026-11-01" }), now));
  assert.ok(!isOverdue(plan({ dueDate: "2026-11-01", status: "lead_review" }), now));
  assert.ok(isExpired(plan({ status: "completed", completion: { expiresOn: "2026-10-01" } }), now));
  assert.ok(!isExpired(plan({ status: "planned", completion: { expiresOn: "2026-10-01" } }), now));
});

test("escalation guard still lets Practices Admin appoint Managers and Managers appoint Leads", () => {
  assert.ok(checkGrant(admin, roles.practice_manager, { type: "practice", id: DE }, PRACTICES).ok);
  assert.ok(checkGrant(manager, roles.practice_lead, { type: "group", id: FULLSTACK }, TREE).ok);
});
