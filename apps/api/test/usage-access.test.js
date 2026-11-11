// Claude usage report visibility (docs/rbac.md §4 AI Tracker). No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { checkGrant } = require("../src/rbac/engine");
const { PRACTICES, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { canViewReportsOf, canSubmit, isSubmitter, isValidPeriod } = require("../src/rbac/usage-access");

const roles = Object.fromEntries(SYSTEM_ROLES.map((r) => [r._id, r]));
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: roles[roleId].permissions })),
});
const sees = (viewer, ownerPractices) => canViewReportsOf(viewer, ownerPractices, PRACTICES);

test("every practice role and AI Member can submit their own report", () => {
  for (const r of ["practitioner", "practice_lead", "practice_manager"]) assert.ok(canSubmit(userWith([r, "practice", "qa"])), r);
  assert.ok(canSubmit(userWith(["ai_member", "app", "ai-tracker"])));
  assert.ok(isSubmitter(userWith(["practitioner", "practice", "qa"]).grants));
  assert.ok(!isSubmitter(userWith(["super_admin", "platform"]).grants), "Super Admin isn't chased for a report");
});

test("Practice Manager sees only their practice's reports", () => {
  const qaManager = userWith(["practice_manager", "practice", "qa"]);
  assert.ok(sees(qaManager, ["qa"]));
  assert.ok(sees(qaManager, ["ai", "qa"]), "multi-practice owner");
  assert.ok(!sees(qaManager, ["digital-engineering"]));
  assert.ok(!sees(qaManager, []), "no-practice users are app-level only");
});

test("Leads and Practitioners can't see other people's reports", () => {
  assert.ok(!sees(userWith(["practice_lead", "practice", "qa"]), ["qa"]));
  assert.ok(!sees(userWith(["practitioner", "practice", "qa"]), ["qa"]));
  assert.ok(!sees(userWith(["ai_member", "app", "ai-tracker"]), ["qa"]));
});

test("Practices Admin sees all practices; AI Admin and Super Admin see everyone", () => {
  assert.ok(sees(userWith(["practices_admin", "app", "practices"]), ["platform"]));
  assert.ok(!sees(userWith(["practices_admin", "app", "practices"]), []));
  assert.ok(sees(userWith(["ai_admin", "app", "ai-tracker"]), []));
  assert.ok(sees(userWith(["ai_admin", "app", "ai-tracker"]), ["qa"]));
  assert.ok(sees(userWith(["super_admin", "platform"]), []));
});

test("escalation guard still lets Practices Admin appoint Managers and Managers appoint Leads", () => {
  assert.ok(checkGrant(userWith(["practices_admin", "app", "practices"]), roles.practice_manager, { type: "practice", id: "qa" }, PRACTICES).ok);
  assert.ok(checkGrant(userWith(["practice_manager", "practice", "qa"]), roles.practice_lead, { type: "practice", id: "qa" }, PRACTICES).ok);
});

test("period must be YYYY-MM and not in the future", () => {
  const now = new Date("2026-11-12T00:00:00Z");
  assert.ok(isValidPeriod("2026-10", now));
  assert.ok(isValidPeriod("2026-11", now));
  assert.ok(!isValidPeriod("2026-12", now));
  assert.ok(!isValidPeriod("2026-13", now));
  assert.ok(!isValidPeriod("26-10", now));
  assert.ok(!isValidPeriod(undefined, now));
});
