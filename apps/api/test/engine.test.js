// Escalation guard + can() against the seeded catalog (docs/rbac.md §5–§6). No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { can, checkGrant, visibleApps } = require("../src/rbac/engine");
const { APPS, PRACTICES, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { CUSTOM_ROLES } = require("../src/seed/data");

const roles = Object.fromEntries([...SYSTEM_ROLES, ...CUSTOM_ROLES].map((r) => [r._id, r]));
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const practice = (id) => ({ type: "practice", id });
const grant = (actor, roleId, scope) => checkGrant(actor, roles[roleId], scope, PRACTICES).ok;

const superAdmin = userWith(["super_admin", "platform"]);
const practicesAdmin = userWith(["practices_admin", "app", "practices"]);
const deManager = userWith(["practice_manager", "practice", "digital-engineering"]);
const deLead = userWith(["practice_lead", "practice", "digital-engineering"]);

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
  assert.ok(grant(deManager, "practice_lead", practice("digital-engineering")));
  assert.ok(grant(deManager, "practitioner", practice("digital-engineering")));
  assert.ok(!grant(deManager, "practitioner", practice("qa")));
  assert.ok(!grant(deManager, "practice_manager", practice("digital-engineering")));
});

test("Practice Lead can't assign roles", () => {
  assert.ok(!grant(deLead, "practitioner", practice("digital-engineering")));
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
