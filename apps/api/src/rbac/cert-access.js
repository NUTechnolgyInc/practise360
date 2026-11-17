// Who may do what on a certification plan (docs/rbac.md §4 "Certification Tracker"). Pure — no DB, unit-tested.
// Plans live in the owner's practice and are checked at the owner's group when they're in one (so only that group's
// Lead reaches them), else at the practice. Cert Admin holds its grant at app:cert-tracker, which isn't on a
// practice's scope chain (group → practice → app:practices → platform), so that scope is checked as well.
const { can, canWithin, memberScope, treeOf } = require("./engine");

const PERM = {
  CATALOG_VIEW: "cert.catalog.view",
  CATALOG_CREATE: "cert.catalog.create",
  CATALOG_MANAGE: "cert.catalog.manage",
  OWN: "cert.plan.manage", // held as manage:own by practice members
  VIEW: "cert.plan.view",
  SUGGEST: "cert.plan.suggest",
  ASSIGN: "cert.plan.assign",
  REVIEW: "cert.plan.review",
  VERIFY: "cert.plan.verify",
};

const APP_SCOPE = { type: "app", id: "cert-tracker" };
const EDITABLE = ["planned", "clarification"];
const OPEN = ["suggested", "planned", "lead_review", "manager_review", "clarification"];
const CURRENCIES = ["INR", "USD"];
const MAX_AMOUNT = 10_000_000;

/** Lower-cased "title|provider" — the catalog's duplicate key. */
const catalogKey = (title, provider) => [title, provider || ""].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

/** can() at `scope`, or at app:cert-tracker for app-wide roles. */
const canOn = (user, permission, scope, tree, resource) => can(user, permission, scope, resource, tree) || can(user, permission, APP_SCOPE, resource, tree);

/** can() at the practice, or at app:cert-tracker for app-wide roles. */
const canAt = (user, permission, practiceId, tree, resource) => canOn(user, permission, { type: "practice", id: practiceId }, tree, resource);

/** Whether `user` may act with `permission` on `memberId`'s plans in a practice — for a Lead, only their group's members. */
const canForMember = (user, permission, practiceId, memberId, tree) => canOn(user, permission, memberScope(tree, practiceId, memberId), tree);

/** Holds `permission` somewhere in the practice (the practice itself or one of its groups), or app-wide. */
const canInPractice = (user, permission, practiceId, tree) => canWithin(user, permission, practiceId, tree) || can(user, permission, APP_SCOPE, undefined, tree);

/** Everything the UI may offer `user` on plan `p`. The routes call the same function, so UI and API can't drift. */
function certActionsFor(user, p, tree) {
  const scope = memberScope(tree, p.practiceId, p.ownerId);
  const has = (perm, resource) => canOn(user, perm, scope, tree, resource);
  const owner = sameId(p.ownerId, user.id);
  const ownWork = owner && has(PERM.OWN, { ownerId: p.ownerId });
  const editable = EDITABLE.includes(p.status);
  const assigned = p.source === "assigned";
  // Withdrawing needs the permission that created it. An accepted recommendation is the member's own plan now.
  const canWithdraw =
    p.source === "assigned" ? EDITABLE.includes(p.status) && has(PERM.ASSIGN) : p.source === "suggested" && p.status === "suggested" && has(PERM.SUGGEST);

  return {
    view: owner || has(PERM.VIEW),
    accept: ownWork && p.status === "suggested",
    decline: ownWork && p.status === "suggested",
    edit: ownWork && editable,
    // An assigned due date is the assigner's call, not the owner's — even when the owner is a Lead themselves.
    editDueDate: editable && (assigned ? !owner && has(PERM.ASSIGN) : ownWork),
    upload: ownWork && editable,
    submit: ownWork && editable,
    drop: ownWork && editable && !assigned,
    withdraw: !owner && !!canWithdraw,
    // Nobody reviews their own plan. A Manager can take the Lead step but can't then also give final approval.
    review: p.status === "lead_review" && !owner && has(PERM.REVIEW),
    approve: p.status === "manager_review" && !owner && !sameId(p.leadReview?.by, user.id) && has(PERM.VERIFY),
  };
}

const practicesWhere = (perm) => (user, tree) => treeOf(tree).practices.filter((p) => canInPractice(user, perm, p._id, tree)).map((p) => p._id);

/** Practice ids where the user can see at least some members' plans (a Lead: their group's). */
const viewablePractices = practicesWhere(PERM.VIEW);
/** Practice ids where the user can plan their own certifications. */
const ownPractices = (user, tree) => treeOf(tree).practices.filter((p) => can(user, `${PERM.OWN}:own`, { type: "practice", id: p._id }, { ownerId: user.id }, tree)).map((p) => p._id);
const suggestablePractices = practicesWhere(PERM.SUGGEST);
const assignablePractices = practicesWhere(PERM.ASSIGN);

/** Holds `permission` at any scope (catalog actions aren't tied to one practice). */
const holdsAnywhere = (user, ...permissions) => user.grants.some((g) => g.permissions.includes("*") || permissions.some((p) => g.permissions.includes(p)));

const isUrl = (v) => /^https?:\/\/\S+$/i.test(v || "");
const startOfDay = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Completion checks. Returns a list of problems (empty = ok).
 * `sub` = { completedOn: Date|null, verificationUrl, expiresOn: Date|null, certificateFileIds, reimbursement: null | { amount, currency, receiptFileIds } }
 */
function completionProblems(sub, now = new Date()) {
  const problems = [];
  if (!sub.completedOn) problems.push("The completion date is required (YYYY-MM-DD)");
  else if (startOfDay(sub.completedOn) > startOfDay(now)) problems.push("The completion date can't be in the future");
  if (!sub.verificationUrl) problems.push("A verification link is required");
  else if (!isUrl(sub.verificationUrl)) problems.push(`Not a valid http(s) link: ${sub.verificationUrl}`);
  if (!(sub.certificateFileIds?.length > 0)) problems.push("Attach the certificate");
  if (sub.expiresOn && sub.completedOn && sub.expiresOn <= sub.completedOn) problems.push("The expiry date must be after the completion date");
  const r = sub.reimbursement;
  if (r) {
    if (!(typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0)) problems.push("Enter the reimbursement amount");
    else if (r.amount > MAX_AMOUNT) problems.push("The reimbursement amount looks too large");
    if (!CURRENCIES.includes(r.currency)) problems.push("Pick a currency (INR or USD)");
    if (!(r.receiptFileIds?.length > 0)) problems.push("Attach the payment receipt");
  }
  return problems;
}

/** Next status after a review decision. A rejection reopens the plan so the member can fix it and resubmit. */
function nextStatus(stage, decision) {
  if (decision === "reject") return "planned";
  if (decision === "clarify") return "clarification";
  return stage === "lead" ? "manager_review" : "completed";
}

const isOverdue = (p, now = new Date()) => EDITABLE.includes(p.status) && !!p.dueDate && new Date(p.dueDate) < now;
const isExpired = (p, now = new Date()) => p.status === "completed" && !!p.completion?.expiresOn && new Date(p.completion.expiresOn) < now;

module.exports = {
  PERM,
  EDITABLE,
  OPEN,
  CURRENCIES,
  canAt,
  canOn,
  canForMember,
  canInPractice,
  certActionsFor,
  viewablePractices,
  ownPractices,
  suggestablePractices,
  assignablePractices,
  holdsAnywhere,
  completionProblems,
  nextStatus,
  isOverdue,
  isExpired,
  isUrl,
  sameId,
  catalogKey,
};
