// People profile rules (docs/rbac.md §4 "People profiles") against the seeded catalog. No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { APPS, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { profileView, canSeeGrant } = require("../src/rbac/profile-access");
const { DE, FULLSTACK, DEVOPS, treeWith } = require("./fixtures");

const roles = Object.fromEntries(SYSTEM_ROLES.map((r) => [r._id, r]));
const grant = ([roleId, scopeType, scopeId = null]) => ({ roleId, roleName: roles[roleId].name, scopeType, scopeId, permissions: roles[roleId].permissions });
const userWith = (id, ...assignments) => ({ id, grants: assignments.map(grant) });

// dev1 + lead in DE Fullstack, dev2 in DE DevOps; the Manager isn't in a group.
const TREE = { ...treeWith([["dev1", FULLSTACK], ["lead", FULLSTACK], ["dev2", DEVOPS]]), apps: APPS };
const dev1 = userWith("dev1", ["practitioner", "practice", DE]);
const dev2 = userWith("dev2", ["practitioner", "practice", DE]);
const lead = userWith("lead", ["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);
const manager = userWith("manager", ["practice_manager", "practice", DE]);
const qaDev = userWith("qa", ["practitioner", "practice", "qa"]);
const practicesAdmin = userWith("padmin", ["practices_admin", "app", "practices"]);
const certAdmin = userWith("cadmin", ["cert_admin", "app", "cert-tracker"]);
const aiMember = userWith("aimember", ["ai_member", "app", "ai-tracker"]);
const superAdmin = userWith("super", ["super_admin", "platform"]);

const view = (viewer, person) => profileView(viewer, person.id, person.grants, TREE);

test("a practice member sees a peer's practice, group and roles, and their contributions — not their plans or reports", () => {
  const v = view(dev1, dev2);
  assert.equal(v.self, false);
  assert.deepEqual(v.practices, [{ id: DE, name: "Digital Engineering", group: { id: DEVOPS, name: "DevOps" }, roles: ["Practitioner"], groupRoles: [] }]);
  assert.ok(v.directory && v.contributions);
  assert.ok(!v.certifications, "practitioners don't see each other's plans");
  assert.ok(!v.reports, "usage reports are for Managers and above");
});

test("a Lead's role shows on their profile; only their own group's members' plans are open to them", () => {
  assert.deepEqual(view(dev1, lead).practices[0].groupRoles, [{ role: "Practice Lead", group: { id: FULLSTACK, name: "Fullstack" } }]);
  assert.ok(view(lead, dev1).certifications);
  assert.ok(!view(lead, dev2).certifications, "dev2 is in another group");
  assert.ok(!view(lead, dev1).reports);
});

test("the Manager and Practices Admin see plans and usage reports across the practice", () => {
  for (const viewer of [manager, practicesAdmin]) {
    for (const person of [dev1, dev2]) assert.ok(view(viewer, person).certifications && view(viewer, person).reports);
  }
});

test("someone outside the practice sees the name (directory) but nothing about the practice", () => {
  const v = view(qaDev, dev1);
  assert.ok(v.directory);
  assert.deepEqual(v.practices, []);
  assert.ok(!v.contributions && !v.certifications && !v.reports);
});

test("Practices Admin is named to anyone who can see a practice; other app roles only to whoever manages access", () => {
  const padminGrant = practicesAdmin.grants[0];
  const certGrant = certAdmin.grants[0];
  assert.ok(canSeeGrant(dev1, padminGrant, TREE) && canSeeGrant(qaDev, padminGrant, TREE));
  assert.ok(!canSeeGrant(certAdmin, padminGrant, TREE), "Cert Admin has no Practices view");
  assert.ok(!canSeeGrant(dev1, certGrant, TREE));
  assert.ok(canSeeGrant(superAdmin, certGrant, TREE));
  assert.deepEqual(view(dev1, practicesAdmin).appRoles.map((r) => `${r.roleName} @ ${r.scopeLabel}`), ["Practices Admin @ Practices"]);
});

test("Cert Admin reaches every member's plans but not their practice or directory", () => {
  const v = view(certAdmin, dev2);
  assert.ok(v.certifications);
  assert.ok(!v.directory && !v.contributions && !v.reports);
  assert.deepEqual(v.practices, []);
});

test("an AI Member alone sees nothing about anyone", () => {
  const v = view(aiMember, dev1);
  assert.ok(!v.directory && !v.contributions && !v.certifications && !v.reports);
  assert.deepEqual([v.practices, v.appRoles], [[], []]);
});

test("everyone sees all of their own profile", () => {
  const v = view(lead, lead);
  assert.ok(v.self && v.contributions && v.certifications && v.reports && v.submitsReports);
  assert.equal(v.practices[0].group.name, "Fullstack");
  assert.ok(view(aiMember, aiMember).reports, "AI Members submit usage reports too");
  assert.deepEqual(view(aiMember, aiMember).appRoles.map((r) => r.roleName), ["AI Member"]);
});

test("viewing a practice without its member list shows the Manager and Leads, but not who's a Practitioner or in which group", () => {
  const viewerOnly = { id: "viewer", grants: [{ roleId: "custom", roleName: "Practice Viewer", scopeType: "practice", scopeId: DE, permissions: ["practices.practice.view"] }] };
  assert.equal(view(viewerOnly, manager).practices[0].roles[0], "Practice Manager");
  const ofLead = view(viewerOnly, lead).practices[0];
  assert.deepEqual(ofLead.roles, []);
  assert.equal(ofLead.group, null);
  assert.equal(ofLead.groupRoles[0].role, "Practice Lead");
  assert.deepEqual(view(viewerOnly, dev1).practices, []);
});
