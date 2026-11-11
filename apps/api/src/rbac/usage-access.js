// Who may see whose Claude usage report (docs/rbac.md §4 "AI Tracker"). Pure — no DB, unit-tested.
// Reports have no scope of their own: like Cert Tracker they reuse the owner's practice scope, so a
// Practice Manager sees their practice; app-level viewers (AI Admin, Super Admin) see everyone.
const { can } = require("./engine");

const OWN = "ai.usage.manage:own";
const VIEW = "ai.usage.view";
const AI_APP = { type: "app", id: "ai-tracker" };
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Practice ids a user belongs to, from their practice-scope assignments. */
const practicesOf = (grants) => [...new Set(grants.filter((g) => g.scopeType === "practice").map((g) => g.scopeId))];

/** Whether `viewer` may see reports of someone in `ownerPractices`. */
function canViewReportsOf(viewer, ownerPractices, practices) {
  if (can(viewer, VIEW, AI_APP, undefined, practices)) return true;
  return ownerPractices.some((id) => can(viewer, VIEW, { type: "practice", id }, undefined, practices));
}

/** Holds the own-report permission (or `*`) at any scope. */
const canSubmit = (user) => user.grants.some((g) => g.permissions.includes("*") || g.permissions.includes(OWN));

/** Expected to submit monthly: holds the permission explicitly (Super Admin's `*` alone doesn't make them a submitter). */
const isSubmitter = (grants) => grants.some((g) => g.permissions.includes(OWN));

/** YYYY-MM, not in the future (UTC). */
function isValidPeriod(period, now = new Date()) {
  if (!PERIOD_RE.test(period || "")) return false;
  const current = now.toISOString().slice(0, 7);
  return period <= current;
}

module.exports = { OWN, VIEW, practicesOf, canViewReportsOf, canSubmit, isSubmitter, isValidPeriod };
