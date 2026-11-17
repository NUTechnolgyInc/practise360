// List-row presenters for contributions and certification plans. Shared by the feature lists and the person
// profile (routes/people.js), so a row carries the same fields — and the same per-viewer flags — everywhere.
const contributionAccess = require("../rbac/contribution-access");
const certAccess = require("../rbac/cert-access");
const { person } = require("./http");

const practiceRef = (tree, id) => ({ id, name: tree.practices.find((p) => p._id === id)?.name ?? id });

/** One contribution as a list row. `people` = usersById() of at least the owner and creator. */
function contributionSummary(c, people, tree, user) {
  const actions = contributionAccess.actionsFor(user, c, tree);
  return {
    id: String(c._id),
    title: c.title,
    type: c.type,
    customType: c.customType || null,
    practice: practiceRef(tree, c.practiceId),
    status: c.status,
    owner: person(people, c.ownerId),
    addedBy: person(people, contributionAccess.addedByOf(c)),
    contributorCount: (c.contributorIds || []).length,
    startDate: c.startDate,
    dueDate: c.dueDate,
    overdue: contributionAccess.isOverdue(c),
    updatedAt: c.updatedAt,
    submittedAt: c.submission?.submittedAt ?? null,
    publishedAt: c.publishedAt ?? null,
    pendingJoinRequests: (c.joinRequests || []).length,
    awaitingMe: actions.review || actions.approve,
    mine: contributionAccess.isParticipant(c, user.id),
  };
}

const hasCompletion = (p) => !!p.completion?.submittedAt;
const reimbursementOf = (p) => (p.completion?.reimbursement?.amount != null ? p.completion.reimbursement : null);

/** One certification plan as a list row. `people` = usersById() of at least the owner and creator. */
function planSummary(p, people, tree, user) {
  const actions = certAccess.certActionsFor(user, p, tree);
  const r = reimbursementOf(p);
  return {
    id: String(p._id),
    cert: p.cert,
    catalogId: p.catalogId ? String(p.catalogId) : null,
    practice: practiceRef(tree, p.practiceId),
    owner: person(people, p.ownerId),
    source: p.source,
    createdBy: person(people, p.createdBy),
    status: p.status,
    startDate: p.startDate ?? null,
    dueDate: p.dueDate ?? null,
    overdue: certAccess.isOverdue(p),
    expired: certAccess.isExpired(p),
    completedOn: hasCompletion(p) ? p.completion.completedOn : null,
    expiresOn: hasCompletion(p) ? (p.completion.expiresOn ?? null) : null,
    reimbursement: hasCompletion(p) && r ? { amount: r.amount, currency: r.currency } : null,
    submittedAt: p.completion?.submittedAt ?? null,
    completedAt: p.completedAt ?? null,
    updatedAt: p.updatedAt,
    mine: certAccess.sameId(p.ownerId, user.id),
    awaitingMe: actions.review || actions.approve,
  };
}

module.exports = { contributionSummary, planSummary, hasCompletion, reimbursementOf };
