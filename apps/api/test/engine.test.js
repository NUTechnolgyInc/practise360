// Escalation guard + can() against the seeded catalog (docs/rbac.md §5–§6). No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { can, checkGrant, memberScope, scopeChain, visibleApps } = require("../src/rbac/engine");
const { APPS, PRACTICES, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { CUSTOM_ROLES } = require("../src/seed/data");
const { DE, FULLSTACK, QA_AUTO, treeWith } = require("./fixtures");

const roles = Object.fromEntries([...SYSTEM_ROLES, ...CUSTOM_ROLES].map((r) => [r._id, r]));
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const practice = (id) => ({ type: "practice", id });
const group = (id) => ({ type: "group", id });
const TREE = treeWith();
const grant = (actor, roleId, scope) => checkGrant(actor, roles[roleId], scope, TREE).ok;

const superAdmin = userWith(["super_admin", "platform"]);
const practicesAdmin = userWith(["practices_admin", "app", "practices"]);
const deManager = userWith(["practice_manager", "practice", "digital-engineering"]);
// A Lead is a practice member (Practitioner) who also leads a group.
const deLead = userWith(["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);

test("role granted at a parent applies to children", () => {
  assert.ok(can(practicesAdmin, "practices.members.manage", practice("qa"), undefined, PRACTICES));
  assert.ok(!can(deManager, "practices.members.manage", practice("qa"), undefined, PRACTICES));
});

test(":own only matches records the user owns", () => {
  const dev = userWith(["practitioner", "practice", "qa"]);
  assert.ok(can(dev, "cert.plan.manage", practice("qa"), { ownerId: "u1" }, PRACTICES));
  assert.ok(!can(dev, "cert.plan.manage", practice("qa"), { ownerId: "u2" }, PRACTICES));
});

test("Super Admin can grant app admin roles", () => {
  assert.ok(grant(superAdmin, "practices_admin", { type: "app", id: "practices" }));
  assert.ok(grant(superAdmin, "cert_admin", { type: "app", id: "cert-tracker" }));
});

test("Practices Admin appoints Managers in any practice, but not app admins", () => {
  assert.ok(grant(practicesAdmin, "practice_manager", practice("qa")));
  assert.ok(!grant(practicesAdmin, "cert_admin", { type: "app", id: "cert-tracker" }));
});

test("Practice Manager grants Lead/Practitioner only in their practice, never Manager", () => {
  assert.ok(grant(deManager, "practice_lead", group(FULLSTACK)), "Leads are appointed per group");
  assert.ok(!grant(deManager, "practice_lead", practice(DE)), "no practice-wide Lead any more");
  assert.ok(!grant(deManager, "practice_lead", group(QA_AUTO)), "not in another practice's groups");
  assert.ok(grant(deManager, "practitioner", practice("digital-engineering")));
  assert.ok(!grant(deManager, "practitioner", practice("qa")));
  assert.ok(!grant(deManager, "practice_manager", practice("digital-engineering")));
});

test("Practice Lead can't assign roles", () => {
  assert.ok(!grant(deLead, "practitioner", practice("digital-engineering")));
  assert.ok(!grant(deLead, "practice_lead", group(FULLSTACK)), "not even another Lead for their own group");
});

test("a group sits under its practice: practice and app grants reach it, sibling groups don't", () => {
  assert.deepEqual(scopeChain(group(FULLSTACK), TREE), [group(FULLSTACK), practice(DE), { type: "app", id: "practices" }, { type: "platform", id: null }]);
  assert.ok(can(deManager, "practices.contribution.review", group(FULLSTACK), undefined, TREE));
  assert.ok(can(practicesAdmin, "practices.contribution.review", group(QA_AUTO), undefined, TREE));
  assert.ok(can(deLead, "practices.contribution.review", group(FULLSTACK), undefined, TREE));
  assert.ok(!can(deLead, "practices.contribution.review", group("digital-engineering-devops"), undefined, TREE), "a Lead reaches only their group");
  assert.ok(!can(deLead, "practices.contribution.review", practice(DE), undefined, TREE), "nor the practice as a whole");
});

test("Practices Admin appoints Leads in any group; unknown groups are refused", () => {
  assert.ok(grant(practicesAdmin, "practice_lead", group(QA_AUTO)));
  assert.ok(!grant(practicesAdmin, "practice_lead", group("no-such-group")));
  assert.ok(!can(deManager, "practices.contribution.review", group("no-such-group"), undefined, TREE), "unknown groups fail closed");
});

test("memberScope resolves a member's group, or the practice when they're in none", () => {
  const tree = treeWith([["u1", FULLSTACK]]);
  assert.deepEqual(memberScope(tree, DE, "u1"), group(FULLSTACK));
  assert.deepEqual(memberScope(tree, DE, "u2"), practice(DE));
  assert.deepEqual(memberScope(tree, "qa", "u1"), practice("qa"), "membership is per practice");
});

test("custom roles are only grantable in their owning practice", () => {
  assert.ok(grant(deManager, "de_practice_coordinator", practice("digital-engineering")));
  assert.ok(!grant(superAdmin, "de_practice_coordinator", practice("qa")));
});

test("role must be granted at its own scope type", () => {
  assert.ok(!grant(superAdmin, "practice_lead", { type: "app", id: "practices" }));
});

test("app visibility is derived from permissions", () => {
  const ids = (u) => visibleApps(u, APPS).map((a) => a._id);
  // Practice members submit Claude usage reports, so AI Tracker is visible to them too.
  assert.deepEqual(ids(deLead), ["practices", "cert-tracker", "ai-tracker"]);
  assert.deepEqual(ids(userWith(["cert_admin", "app", "cert-tracker"])), ["cert-tracker"]);
  assert.deepEqual(ids(superAdmin), ["practices", "cert-tracker", "ai-tracker"]);
});

test("only Super Admin can edit system roles (platform.roles.manage)", () => {
  const platform = { type: "platform", id: null };
  assert.ok(can(superAdmin, "platform.roles.manage", platform, undefined, PRACTICES));
  for (const actor of [practicesAdmin, deManager, deLead]) assert.ok(!can(actor, "platform.roles.manage", platform, undefined, PRACTICES));
  const holders = SYSTEM_ROLES.filter((r) => r.permissions.includes("platform.roles.manage") || r.permissions.includes("*"));
  assert.deepEqual(holders.map((r) => r._id), ["super_admin"]);
});
