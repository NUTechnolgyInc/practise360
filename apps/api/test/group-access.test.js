// Running a group (docs/rbac.md §4 "Practices and groups"): who edits a group's Overview and who takes members in
// or out of it. No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { canManageGroupMembers, canMoveMember, canUpdateGroup } = require("../src/rbac/group-access");
const { checkGrant } = require("../src/rbac/engine");
const { SYSTEM_ROLES } = require("../src/rbac/catalog");
const { CUSTOM_ROLES } = require("../src/seed/data");
const { DE, DEVOPS, FULLSTACK, GROUPS, QA_AUTO, treeWith } = require("./fixtures");

const roles = Object.fromEntries([...SYSTEM_ROLES, ...CUSTOM_ROLES].map((r) => [r._id, r]));
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const TREE = treeWith();
const groupOf = (id) => GROUPS.find((g) => g._id === id);

const practicesAdmin = userWith(["practices_admin", "app", "practices"]);
const deManager = userWith(["practice_manager", "practice", DE]);
const fullstackLead = userWith(["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);
const practitioner = userWith(["practitioner", "practice", DE]);
const coordinator = userWith(["de_practice_coordinator", "practice", DE]);

test("the group's Lead, the Manager and Practices Admin edit a group's Overview", () => {
  for (const actor of [practicesAdmin, deManager, fullstackLead]) assert.ok(canUpdateGroup(actor, FULLSTACK, TREE));
  // Only their own group; nothing in another practice; members and the coordinator can't.
  assert.ok(!canUpdateGroup(fullstackLead, DEVOPS, TREE));
  assert.ok(!canUpdateGroup(deManager, QA_AUTO, TREE));
  assert.ok(!canUpdateGroup(practitioner, FULLSTACK, TREE));
  assert.ok(!canUpdateGroup(coordinator, FULLSTACK, TREE));
});

test("a Lead takes members into or out of their own group only", () => {
  assert.ok(canManageGroupMembers(fullstackLead, groupOf(FULLSTACK), TREE));
  assert.ok(!canManageGroupMembers(fullstackLead, groupOf(DEVOPS), TREE));
  assert.ok(!canManageGroupMembers(practitioner, groupOf(FULLSTACK), TREE));
  // Practice-wide members.manage (Manager, coordinator) covers every group of the practice.
  for (const actor of [practicesAdmin, deManager, coordinator]) assert.ok(canManageGroupMembers(actor, groupOf(DEVOPS), TREE));
  assert.ok(!canManageGroupMembers(coordinator, groupOf(QA_AUTO), TREE));
});

test("moving a member needs every group involved — a Lead can't take someone from another group", () => {
  assert.ok(canMoveMember(fullstackLead, DE, null, FULLSTACK, TREE), "someone not in a group joins the Lead's group");
  assert.ok(canMoveMember(fullstackLead, DE, FULLSTACK, null, TREE), "a member leaves the Lead's group");
  assert.ok(!canMoveMember(fullstackLead, DE, DEVOPS, FULLSTACK, TREE), "taking from DevOps needs DevOps too");
  assert.ok(!canMoveMember(fullstackLead, DE, FULLSTACK, DEVOPS, TREE), "pushing into DevOps needs DevOps too");
  assert.ok(!canMoveMember(fullstackLead, DE, null, null, TREE));
  assert.ok(!canMoveMember(practitioner, DE, null, FULLSTACK, TREE));
  for (const actor of [practicesAdmin, deManager, coordinator]) assert.ok(canMoveMember(actor, DE, DEVOPS, FULLSTACK, TREE));
  assert.ok(!canMoveMember(deManager, "qa", null, QA_AUTO, TREE));
});

test("Manager and Practices Admin still hold everything a Lead holds, so they can appoint one", () => {
  for (const actor of [practicesAdmin, deManager]) assert.ok(checkGrant(actor, roles.practice_lead, { type: "group", id: FULLSTACK }, TREE).ok);
  // The Lead role now carries group.update; a Lead still can't appoint another Lead.
  assert.ok(roles.practice_lead.permissions.includes("practices.group.update"));
  assert.ok(!checkGrant(fullstackLead, roles.practice_lead, { type: "group", id: FULLSTACK }, TREE).ok);
});
