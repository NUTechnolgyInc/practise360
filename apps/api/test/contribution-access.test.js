// Contribution rules (docs/rbac.md §4 "Contributions") against the seeded catalog. No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { PRACTICES, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { actionsFor, submissionProblems, nextStatus, viewablePractices, isOverdue } = require("../src/rbac/contribution-access");
const { FULLSTACK, DEVOPS, treeWith } = require("./fixtures");

const roles = Object.fromEntries(SYSTEM_ROLES.map((r) => [r._id, r]));
const userWith = (id, ...assignments) => ({
  id,
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const DE = "digital-engineering";
const owner = userWith("owner", ["practitioner", "practice", DE]);
const helper = userWith("helper", ["practitioner", "practice", DE]);
const bystander = userWith("bystander", ["practitioner", "practice", DE]);
const qaDev = userWith("qa", ["practitioner", "practice", "qa"]);
// owner, helper and lead sit in DE Fullstack; devopsLead leads DE DevOps.
const lead = userWith("lead", ["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);
const devopsLead = userWith("devopsLead", ["practitioner", "practice", DE], ["practice_lead", "group", DEVOPS]);
const TREE = treeWith([["owner", FULLSTACK], ["helper", FULLSTACK], ["lead", FULLSTACK], ["devopsLead", DEVOPS]]);
const manager = userWith("manager", ["practice_manager", "practice", DE]);
const admin = userWith("admin", ["practices_admin", "app", "practices"]);
const superAdmin = userWith("super", ["super_admin", "platform"]);

const contribution = (over = {}) => ({ practiceId: DE, ownerId: "owner", contributorIds: ["helper"], invites: [], joinRequests: [], status: "in_progress", dueDate: "2099-01-01", ...over });
const acts = (user, over) => actionsFor(user, contribution(over), TREE);

test("the whole practice sees contributions; other practices don't", () => {
  assert.ok(acts(bystander).view);
  assert.ok(!acts(qaDev).view);
  assert.deepEqual(viewablePractices(owner, TREE), [DE]);
  assert.equal(viewablePractices(admin, TREE).length, PRACTICES.length);
  assert.ok(acts(devopsLead).view, "groups don't narrow visibility — the whole practice still sees it");
});

test("only the Lead of the owner's group reviews and manages; the Manager covers members outside any group", () => {
  const s = { status: "lead_review" };
  assert.ok(acts(lead, s).review && acts(lead).logProgress);
  assert.ok(!acts(devopsLead, s).review && !acts(devopsLead).logProgress && !acts(devopsLead).manageMembers);
  const loner = contribution({ ...s, ownerId: "loner", contributorIds: [] });
  assert.ok(!actionsFor(lead, loner, TREE).review);
  assert.ok(actionsFor(manager, loner, TREE).review);
});

test("owner and contributors edit and log progress; bystanders can only ask to join", () => {
  for (const u of [owner, helper]) assert.ok(acts(u).edit && acts(u).logProgress);
  assert.ok(!acts(bystander).edit && !acts(bystander).logProgress);
  assert.ok(acts(bystander).requestJoin);
  assert.ok(!acts(bystander, { joinRequests: [{ userId: "bystander" }] }).requestJoin);
  assert.ok(!acts(lead, { status: "lead_review" }).requestJoin, "no joining once it's under review");
});

test("Lead, Manager, Practices Admin and Super Admin can log progress on anyone's contribution", () => {
  for (const u of [lead, manager, admin, superAdmin]) assert.ok(acts(u).logProgress, u.id);
});

test("only the owner submits; contributors manage nothing", () => {
  assert.ok(acts(owner).submit);
  assert.ok(!acts(helper).submit && !acts(helper).manageMembers);
  assert.ok(acts(owner, { status: "clarification" }).submit);
  assert.ok(!acts(owner, { status: "lead_review" }).submit);
});

test("Lead step: Lead or Manager, never a participant", () => {
  const s = { status: "lead_review" };
  assert.ok(acts(lead, s).review && acts(manager, s).review);
  assert.ok(!acts(bystander, s).review);
  assert.ok(!actionsFor(lead, contribution({ ...s, ownerId: "lead" }), TREE).review, "a Lead can't review their own");
});

test("Manager step: Manager or Practices Admin, not the person who did the Lead step", () => {
  const s = { status: "manager_review", leadReview: { by: "lead" } };
  assert.ok(acts(manager, s).approve && acts(admin, s).approve);
  assert.ok(!acts(lead, s).approve, "Leads can't give final approval");
  assert.ok(!acts(manager, { ...s, leadReview: { by: "manager" } }).approve, "one person can't do both steps");
});

test("published and declined contributions are read-only", () => {
  for (const status of ["published", "declined"]) {
    const a = acts(owner, { status });
    assert.ok(a.view && !a.edit && !a.logProgress && !a.submit && !a.manageMembers);
  }
});

test("submission needs description, summary, impact and a document; links must be http(s)", () => {
  const c = { description: "# nu-auth-shared" };
  const ok = { summary: "s", impact: "i", fileIds: ["f1"], repoUrl: "https://example.com/repo" };
  assert.deepEqual(submissionProblems(c, ok, 1), []);
  assert.equal(submissionProblems({ description: "" }, { fileIds: [] }, 0).length, 4);
  assert.match(submissionProblems(c, { ...ok, demoUrl: "javascript:alert(1)" }, 1)[0], /valid/);
});

test("review decisions move the workflow", () => {
  assert.equal(nextStatus("lead", "approve"), "manager_review");
  assert.equal(nextStatus("manager", "approve"), "published");
  assert.equal(nextStatus("lead", "clarify"), "clarification");
  assert.equal(nextStatus("manager", "decline"), "declined");
});

test("overdue only while the owner still holds the work", () => {
  assert.ok(isOverdue(contribution({ dueDate: "2000-01-01" })));
  assert.ok(!isOverdue(contribution({ dueDate: "2000-01-01", status: "lead_review" })));
  assert.ok(!isOverdue(contribution({ dueDate: "2000-01-01", status: "published" })));
});
