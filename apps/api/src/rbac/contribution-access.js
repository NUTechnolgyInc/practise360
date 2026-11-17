// Who may do what on a contribution (docs/rbac.md §4 "Contributions"). Pure — no DB, unit-tested.
// Contributions live in a practice and are checked at the owner's group when they're in one (so only that group's
// Lead reviews them), else at the practice. "Own" means owner or contributor, so `update:own` covers both.
const { can, memberScope, treeOf } = require("./engine");

const PERM = {
  VIEW: "practices.contribution.view",
  CREATE: "practices.contribution.create",
  UPDATE: "practices.contribution.update", // held as update:own by practice members
  MANAGE: "practices.contribution.manage",
  REVIEW: "practices.contribution.review",
  APPROVE: "practices.contribution.approve",
};

const EDITABLE = ["in_progress", "clarification"];
const CLOSED = ["published", "declined"];

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const scopeOf = (c, tree) => memberScope(tree, c.practiceId, c.ownerId);
const participantIds = (c) => [c.ownerId, ...(c.contributorIds || [])];
const isParticipant = (c, userId) => participantIds(c).some((id) => sameId(id, userId));

/** Everything the UI may offer `user` on `c`. The routes call the same function, so UI and API can't drift. */
function actionsFor(user, c, tree) {
  const scope = scopeOf(c, tree);
  const has = (perm, resource) => can(user, perm, scope, resource, tree);
  const uid = user.id;
  const owner = sameId(c.ownerId, uid);
  const participant = isParticipant(c, uid);
  const manage = has(PERM.MANAGE);
  const work = manage || has(PERM.UPDATE, { ownerIds: participantIds(c) });
  const open = !CLOSED.includes(c.status);
  const invited = (c.invites || []).some((i) => sameId(i.userId, uid));
  const requested = (c.joinRequests || []).some((r) => sameId(r.userId, uid));

  return {
    view: has(PERM.VIEW) || participant,
    edit: work && EDITABLE.includes(c.status),
    logProgress: work && open,
    upload: work && open,
    manageMembers: open && ((owner && work) || manage),
    // Joining is only for work still being done — joining mid-review would make a reviewer a participant.
    requestJoin: EDITABLE.includes(c.status) && !participant && !invited && !requested && has(PERM.CREATE),
    cancelRequest: requested,
    respondInvite: open && invited,
    leave: open && participant && !owner,
    // Only the owner hands the work in; it can be (re)submitted while in progress or after a clarification request.
    submit: owner && work && EDITABLE.includes(c.status),
    // Nobody reviews their own work. A Manager can take the Lead step but can't then also give final approval.
    review: c.status === "lead_review" && !participant && has(PERM.REVIEW),
    approve: c.status === "manager_review" && !participant && !sameId(c.leadReview?.by, uid) && has(PERM.APPROVE),
  };
}

/** Practice ids where the user may see contributions. */
const viewablePractices = (user, tree) => treeOf(tree).practices.filter((p) => can(user, PERM.VIEW, { type: "practice", id: p._id }, undefined, tree)).map((p) => p._id);

/** Practice ids where the user may start a contribution. */
const creatablePractices = (user, tree) => treeOf(tree).practices.filter((p) => can(user, PERM.CREATE, { type: "practice", id: p._id }, undefined, tree)).map((p) => p._id);

const MISSING = (field) => `${field} is required to submit`;

/** Submission checks. Returns a list of problems (empty = ok). `fileCount` = attachments on the contribution. */
function submissionProblems(c, sub, fileCount) {
  const problems = [];
  if (!c.description?.trim()) problems.push(MISSING("A description"));
  if (!sub.summary?.trim()) problems.push(MISSING("A summary"));
  if (!sub.impact?.trim()) problems.push(MISSING("The impact"));
  if (!(sub.fileIds?.length > 0) || fileCount === 0) problems.push("Attach at least one document");
  for (const url of [sub.repoUrl, sub.demoUrl, ...(sub.links || []).map((l) => l.url)].filter(Boolean)) {
    if (!/^https?:\/\/\S+$/i.test(url)) problems.push(`Not a valid http(s) link: ${url}`);
  }
  return problems;
}

/** Next status after a review decision. */
function nextStatus(stage, decision) {
  if (decision === "decline") return "declined";
  if (decision === "clarify") return "clarification";
  return stage === "lead" ? "manager_review" : "published";
}

const isOverdue = (c, now = new Date()) => !CLOSED.includes(c.status) && c.status !== "lead_review" && c.status !== "manager_review" && new Date(c.dueDate) < now;

module.exports = { PERM, EDITABLE, CLOSED, actionsFor, viewablePractices, creatablePractices, submissionProblems, nextStatus, isParticipant, isOverdue, sameId };
