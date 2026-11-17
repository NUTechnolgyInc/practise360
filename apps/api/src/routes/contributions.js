// Practices → Contributions. Every route resolves the contribution's practice and checks actionsFor()
// (src/rbac/contribution-access.js) — the same rules the web app uses to hide buttons.
const express = require("express");
const mongoose = require("mongoose");
const { Contribution, ContributionFile, CONTRIBUTION_TYPES, CONTRIBUTION_STATUSES } = require("../models");
const { requireAnyScope } = require("../middleware/auth");
const { can } = require("../rbac/engine");
const access = require("../rbac/contribution-access");
const { bad, wrap, rawBody, str, parseDate, usersById, person, practiceMembers: membersWhere, sendStoredFile, safeFileName } = require("../lib/http");
const { contributionSummary: summary } = require("../lib/summaries");

const { PERM, actionsFor, viewablePractices, creatablePractices, addForPractices, canAddFor, submissionProblems, nextStatus, sameId } = access;
const router = express.Router();

// ---------- presentation ----------

const presentFile = (f) => ({ id: String(f._id), fileName: f.fileName, contentType: f.contentType, size: f.size, uploadedBy: String(f.uploadedBy), uploadedAt: f.createdAt });

async function detail(c, tree, user) {
  const ids = [
    c.ownerId,
    c.createdBy,
    ...(c.contributorIds || []),
    ...(c.invites || []).flatMap((i) => [i.userId, i.by]),
    ...(c.joinRequests || []).map((r) => r.userId),
    ...(c.events || []).flatMap((e) => [e.authorId, e.subjectId]),
    c.leadReview?.by,
    c.managerReview?.by,
  ];
  const [people, files] = await Promise.all([usersById(ids), ContributionFile.find({ contributionId: c._id }).sort({ createdAt: 1 }).lean()]);
  return {
    ...summary(c, people, tree, user),
    description: c.description,
    contributors: (c.contributorIds || []).map((id) => person(people, id)),
    invites: (c.invites || []).map((i) => ({ user: person(people, i.userId), by: person(people, i.by), at: i.at })),
    joinRequests: (c.joinRequests || []).map((r) => ({ user: person(people, r.userId), message: r.message || "", at: r.at })),
    clarificationStage: c.clarificationStage ?? null,
    submission: c.submission?.submittedAt ? { ...c.submission, fileIds: (c.submission.fileIds || []).map(String) } : null,
    leadReview: c.leadReview?.by ? { by: person(people, c.leadReview.by), at: c.leadReview.at } : null,
    managerReview: c.managerReview?.by ? { by: person(people, c.managerReview.by), at: c.managerReview.at } : null,
    files: files.map(presentFile),
    events: (c.events || [])
      .map((e) => ({
        id: String(e._id),
        kind: e.kind,
        at: e.at,
        author: person(people, e.authorId),
        body: e.body || "",
        fileIds: (e.fileIds || []).map(String),
        stage: e.stage ?? null,
        decision: e.decision ?? null,
        action: e.action ?? null,
        subject: person(people, e.subjectId),
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at)),
    actions: actionsFor(user, c, tree),
  };
}

// ---------- loading + guards ----------

/** Loads :id into req.contribution and req.actions; 404 when missing or not visible (don't leak existence). */
const load = wrap(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Contribution not found", 404);
  const c = await Contribution.findById(req.params.id);
  if (!c) return bad(res, "Contribution not found", 404);
  const actions = actionsFor(req.user, c, req.tree);
  if (!actions.view) return bad(res, "Contribution not found", 404);
  req.contribution = c;
  req.actions = actions;
  next();
});

const allow = (action, message) => (req, res, next) => (req.actions[action] ? next() : bad(res, message, 403));

const event = (req, fields) => ({ authorId: req.user.id, at: new Date(), ...fields });

async function respond(req, res, status = 200) {
  res.status(status).json(await detail(req.contribution, req.tree, req.user));
}

/** Only files that belong to this contribution may be referenced. */
async function ownFileIds(c, ids) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => mongoose.isValidObjectId(id)))];
  if (!wanted.length) return [];
  const files = await ContributionFile.find({ _id: { $in: wanted }, contributionId: c._id }, "_id").lean();
  return files.map((f) => f._id);
}

/** People who belong to a practice (any practice-scope assignment there) and may contribute there. */
const practiceMembers = (practiceId, practices) => membersWhere(practiceId, (u) => can(u, PERM.CREATE, { type: "practice", id: practiceId }, undefined, practices));

// ---------- list + create ----------

router.get(
  "/",
  requireAnyScope(PERM.VIEW),
  wrap(async (req, res) => {
    const { tree, user, query } = req;
    const visible = viewablePractices(user, tree);
    let practiceIds = query.practiceId ? visible.filter((id) => id === query.practiceId) : visible;
    const filter = { practiceId: { $in: practiceIds } };
    // A group's contributions = those owned by its current members, the same rule that routes them to its Lead.
    let groupOwners = null;
    if (query.groupId) {
      const group = tree.groups.find((g) => g._id === query.groupId);
      practiceIds = group ? practiceIds.filter((id) => id === group.practiceId) : [];
      groupOwners = tree.memberships.filter((m) => m.groupId === query.groupId).map((m) => m.userId);
      filter.practiceId = { $in: practiceIds };
      filter.ownerId = { $in: groupOwners };
    }
    if (CONTRIBUTION_STATUSES.includes(query.status)) filter.status = query.status;
    if (CONTRIBUTION_TYPES.includes(query.type)) filter.type = query.type;
    if (mongoose.isValidObjectId(query.ownerId)) filter.ownerId = groupOwners && !groupOwners.includes(query.ownerId) ? { $in: [] } : query.ownerId;
    if (query.q) filter.title = { $regex: String(query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").slice(0, 80), $options: "i" };

    const docs = await Contribution.find(filter, "-events -description").sort({ updatedAt: -1 }).limit(500).lean();
    const people = await usersById(docs.flatMap((c) => [c.ownerId, c.createdBy]));
    let rows = docs.map((c) => summary(c, people, tree, user));
    if (query.mine === "true") rows = rows.filter((r) => r.mine);
    if (query.awaitingMe === "true") rows = rows.filter((r) => r.awaitingMe);
    if (query.overdue === "true") rows = rows.filter((r) => r.overdue);

    res.json({
      contributions: rows,
      practices: tree.practices.filter((p) => visible.includes(p._id)).map((p) => ({ id: p._id, name: p.name })),
      canCreateIn: creatablePractices(user, tree),
      canAddForIn: addForPractices(user, tree),
    });
  }),
);

router.post(
  "/",
  wrap(async (req, res) => {
    const { user, tree } = req;
    const { practiceId, type } = req.body || {};
    const title = str(req.body?.title, 120, "Title");
    // ownerId = adding it on a member's behalf (rbac.md §4 "Contributions"); otherwise the caller owns it.
    const forId = req.body?.ownerId && !sameId(req.body.ownerId, user.id) ? String(req.body.ownerId) : null;
    if (forId) {
      if (!mongoose.isValidObjectId(forId)) return bad(res, "Pick a practice member");
      const members = await practiceMembers(practiceId, tree.practices);
      const member = members.find((m) => m.id === forId);
      if (!member) return bad(res, "You can only add a contribution for a member of this practice");
      if (!canAddFor(user, practiceId, forId, tree)) return bad(res, `Needs ${PERM.MANAGE} for ${member.displayName} — a Lead can only add contributions for their own group`, 403);
    } else if (!creatablePractices(user, tree).includes(practiceId)) {
      return bad(res, `Missing permission ${PERM.CREATE} in that practice`, 403);
    }
    if (!title) return bad(res, "Title is required");
    if (!CONTRIBUTION_TYPES.includes(type)) return bad(res, "Pick a contribution type");
    const customType = type === "other" ? str(req.body.customType, 60, "Custom type") : undefined;
    if (type === "other" && !customType) return bad(res, "Name the custom type");
    const startDate = parseDate(req.body.startDate);
    const dueDate = parseDate(req.body.dueDate);
    if (!startDate || !dueDate) return bad(res, "Start and due dates are required (YYYY-MM-DD)");
    if (dueDate < startDate) return bad(res, "Due date can't be before the start date");

    const c = await Contribution.create({
      practiceId,
      title,
      type,
      customType,
      description: str(req.body.description, 200000, "Description"),
      ownerId: forId ?? user.id,
      createdBy: user.id,
      startDate,
      dueDate,
      events: [forId ? { kind: "created", authorId: user.id, subjectId: forId, body: `Added **${title}** on their behalf` } : { kind: "created", authorId: user.id, body: `Started **${title}**` }],
    });
    req.contribution = c;
    await respond(req, res, 201);
  }),
);

/** Members of a practice who could be invited (for the invite picker). */
router.get(
  "/practices/:practiceId/people",
  wrap(async (req, res) => {
    const { practiceId } = req.params;
    if (!can(req.user, PERM.VIEW, { type: "practice", id: practiceId }, undefined, req.tree.practices)) return bad(res, `Missing permission ${PERM.VIEW}`, 403);
    res.json(await practiceMembers(practiceId, req.tree.practices));
  }),
);

/** Members the caller can add a contribution for — a Lead gets their group, a Manager the whole practice. */
router.get(
  "/practices/:practiceId/owners",
  wrap(async (req, res) => {
    const { practiceId } = req.params;
    const { user, tree } = req;
    if (!addForPractices(user, tree).includes(practiceId)) return bad(res, `Missing permission ${PERM.MANAGE} in that practice`, 403);
    const members = await practiceMembers(practiceId, tree.practices);
    res.json(members.filter((m) => !sameId(m.id, user.id) && canAddFor(user, practiceId, m.id, tree)));
  }),
);

// ---------- one contribution ----------

router.get("/:id", load, wrap((req, res) => respond(req, res)));

router.patch(
  "/:id",
  load,
  allow("edit", "You can't edit this contribution now"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const b = req.body || {};
    if (b.title !== undefined) {
      const title = str(b.title, 120, "Title");
      if (!title) return bad(res, "Title is required");
      c.title = title;
    }
    if (b.type !== undefined) {
      if (!CONTRIBUTION_TYPES.includes(b.type)) return bad(res, "Pick a contribution type");
      c.type = b.type;
    }
    if (b.customType !== undefined || b.type !== undefined) c.customType = c.type === "other" ? str(b.customType ?? c.customType, 60, "Custom type") : undefined;
    if (c.type === "other" && !c.customType) return bad(res, "Name the custom type");
    if (b.description !== undefined) c.description = str(b.description, 200000, "Description");
    for (const key of ["startDate", "dueDate"]) {
      if (b[key] === undefined) continue;
      const d = parseDate(b[key]);
      if (!d) return bad(res, `${key} must be YYYY-MM-DD`);
      c[key] = d;
    }
    if (c.dueDate < c.startDate) return bad(res, "Due date can't be before the start date");
    await c.save();
    await respond(req, res);
  }),
);

// ---------- files ----------

router.post(
  "/:id/files",
  load,
  allow("upload", "You can't add files to this contribution"),
  rawBody,
  wrap(async (req, res) => {
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) return bad(res, "Send the file as the request body");
    const fileName = safeFileName(req.query.fileName);
    const contentType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].slice(0, 100);
    const file = await ContributionFile.create({ contributionId: req.contribution._id, uploadedBy: req.user.id, fileName, contentType, size: data.length, data });
    res.status(201).json(presentFile(file));
  }),
);

router.get(
  "/:id/files/:fileId",
  load,
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.fileId)) return bad(res, "File not found", 404);
    const file = await ContributionFile.findOne({ _id: req.params.fileId, contributionId: req.contribution._id }).select("+data").lean();
    if (!file) return bad(res, "File not found", 404);
    sendStoredFile(res, file);
  }),
);

router.delete(
  "/:id/files/:fileId",
  load,
  allow("edit", "Files can only be removed while the contribution is being worked on"),
  wrap(async (req, res) => {
    const c = req.contribution;
    if (!mongoose.isValidObjectId(req.params.fileId)) return bad(res, "File not found", 404);
    const file = await ContributionFile.findOne({ _id: req.params.fileId, contributionId: c._id }).lean();
    if (!file) return bad(res, "File not found", 404);
    // Files on a progress entry are part of the record — keep them.
    if (c.events.some((e) => e.fileIds.some((id) => sameId(id, file._id)))) return bad(res, "This file is attached to a progress update and can't be removed", 409);
    if (!sameId(file.uploadedBy, req.user.id) && !sameId(c.ownerId, req.user.id) && !req.actions.manageMembers) return bad(res, "Only the uploader or owner can remove this file", 403);
    await ContributionFile.deleteOne({ _id: file._id });
    if (c.submission?.fileIds) c.submission.fileIds = c.submission.fileIds.filter((id) => !sameId(id, file._id));
    await c.save();
    res.status(204).end();
  }),
);

// ---------- progress ----------

router.post(
  "/:id/updates",
  load,
  allow("logProgress", "Only the owner, contributors, Leads, Managers and admins can log progress"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const body = str(req.body?.body, 50000, "Update");
    if (!body) return bad(res, "Write what changed");
    c.events.push(event(req, { kind: "progress", body, fileIds: await ownFileIds(c, req.body?.fileIds) }));
    await c.save();
    await respond(req, res, 201);
  }),
);

// ---------- people ----------

router.post(
  "/:id/invites",
  load,
  allow("manageMembers", "Only the owner, Leads and Managers can invite"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const { userId } = req.body || {};
    const members = await practiceMembers(c.practiceId, req.tree.practices);
    if (!members.some((m) => m.id === userId)) return bad(res, "Only members of this practice can be invited");
    if (access.isParticipant(c, userId)) return bad(res, "Already a contributor");
    if (c.invites.some((i) => sameId(i.userId, userId))) return bad(res, "Already invited");
    // An open join request from the same person is accepted straight away.
    if (c.joinRequests.some((r) => sameId(r.userId, userId))) {
      c.joinRequests = c.joinRequests.filter((r) => !sameId(r.userId, userId));
      c.contributorIds.push(userId);
      c.events.push(event(req, { kind: "member", action: "joined", subjectId: userId }));
    } else {
      c.invites.push({ userId, by: req.user.id });
      c.events.push(event(req, { kind: "member", action: "invited", subjectId: userId }));
    }
    await c.save();
    await respond(req, res);
  }),
);

router.delete(
  "/:id/invites/:userId",
  load,
  allow("manageMembers", "Only the owner, Leads and Managers can withdraw invites"),
  wrap(async (req, res) => {
    const c = req.contribution;
    c.invites = c.invites.filter((i) => !sameId(i.userId, req.params.userId));
    await c.save();
    await respond(req, res);
  }),
);

router.post(
  "/:id/invites/respond",
  load,
  allow("respondInvite", "You have no open invite"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const accept = req.body?.accept === true;
    c.invites = c.invites.filter((i) => !sameId(i.userId, req.user.id));
    if (accept) c.contributorIds.push(req.user.id);
    c.events.push(event(req, { kind: "member", action: accept ? "joined" : "declined_invite", subjectId: req.user.id }));
    await c.save();
    await respond(req, res);
  }),
);

router.post(
  "/:id/join-requests",
  load,
  allow("requestJoin", "You can't request to join this contribution"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const message = str(req.body?.message, 1000, "Message");
    c.joinRequests.push({ userId: req.user.id, message });
    c.events.push(event(req, { kind: "member", action: "requested", subjectId: req.user.id, body: message }));
    await c.save();
    await respond(req, res, 201);
  }),
);

router.delete(
  "/:id/join-requests/mine",
  load,
  allow("cancelRequest", "You have no open request"),
  wrap(async (req, res) => {
    const c = req.contribution;
    c.joinRequests = c.joinRequests.filter((r) => !sameId(r.userId, req.user.id));
    await c.save();
    await respond(req, res);
  }),
);

router.post(
  "/:id/join-requests/:userId",
  load,
  allow("manageMembers", "Only the owner, Leads and Managers can answer join requests"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const { userId } = req.params;
    if (!c.joinRequests.some((r) => sameId(r.userId, userId))) return bad(res, "No open request from that person", 404);
    const accept = req.body?.accept === true;
    c.joinRequests = c.joinRequests.filter((r) => !sameId(r.userId, userId));
    if (accept) c.contributorIds.push(userId);
    c.events.push(event(req, { kind: "member", action: accept ? "joined" : "rejected_request", subjectId: userId }));
    await c.save();
    await respond(req, res);
  }),
);

router.delete(
  "/:id/contributors/:userId",
  load,
  wrap(async (req, res) => {
    const c = req.contribution;
    const { userId } = req.params;
    const self = sameId(userId, req.user.id);
    if (!(self ? req.actions.leave : req.actions.manageMembers)) return bad(res, "You can't remove this contributor", 403);
    if (!c.contributorIds.some((id) => sameId(id, userId))) return bad(res, "Not a contributor", 404);
    c.contributorIds = c.contributorIds.filter((id) => !sameId(id, userId));
    c.events.push(event(req, { kind: "member", action: self ? "left" : "removed", subjectId: userId }));
    await c.save();
    await respond(req, res);
  }),
);

// ---------- submit + review ----------

router.post(
  "/:id/submit",
  load,
  allow("submit", "Only the owner can submit, while the contribution is in progress or awaiting clarification"),
  wrap(async (req, res) => {
    const c = req.contribution;
    const b = req.body || {};
    const links = (Array.isArray(b.links) ? b.links : [])
      .map((l) => ({ label: str(l?.label, 80, "Link label"), url: str(l?.url, 500, "Link") }))
      .filter((l) => l.url)
      .slice(0, 20);
    const sub = { summary: str(b.summary, 10000, "Summary"), impact: str(b.impact, 10000, "Impact"), repoUrl: str(b.repoUrl, 500, "Repository link"), demoUrl: str(b.demoUrl, 500, "Demo link"), links, fileIds: await ownFileIds(c, b.fileIds) };
    const problems = submissionProblems(c, sub, sub.fileIds.length);
    if (problems.length) return res.status(400).json({ error: problems[0], problems });

    const resubmit = c.status === "clarification";
    const returnTo = resubmit ? c.clarificationStage : "lead";
    c.submission = { ...sub, submittedAt: new Date() };
    c.status = returnTo === "manager" ? "manager_review" : "lead_review";
    c.clarificationStage = undefined;
    const note = str(b.note, 10000, "Reply");
    c.events.push(event(req, { kind: "submitted", stage: returnTo, body: note || (resubmit ? "Resubmitted with clarifications" : "Submitted for review"), fileIds: sub.fileIds }));
    await c.save();
    await respond(req, res);
  }),
);

router.post(
  "/:id/review",
  load,
  wrap(async (req, res) => {
    const c = req.contribution;
    const stage = c.status === "lead_review" ? "lead" : c.status === "manager_review" ? "manager" : null;
    if (!stage) return bad(res, "This contribution isn't waiting for a review", 409);
    if (!req.actions[stage === "lead" ? "review" : "approve"]) {
      return bad(res, stage === "lead" ? `Needs ${PERM.REVIEW} in this practice, and you can't review your own work` : `Needs ${PERM.APPROVE}; the Lead-step reviewer and participants can't give final approval`, 403);
    }
    const { decision } = req.body || {};
    if (!["approve", "decline", "clarify"].includes(decision)) return bad(res, "decision must be approve, decline or clarify");
    const comment = str(req.body?.comment, 10000, "Comment");
    if (decision !== "approve" && !comment) return bad(res, "Add a comment explaining the decision");

    const now = new Date();
    c.status = nextStatus(stage, decision);
    if (decision === "clarify") c.clarificationStage = stage;
    if (decision === "approve") c[stage === "lead" ? "leadReview" : "managerReview"] = { by: req.user.id, at: now };
    c.events.push(event(req, { kind: "review", stage, decision, body: comment, at: now }));
    if (c.status === "published") {
      c.publishedAt = now;
      c.events.push(event(req, { kind: "published", at: new Date(now.getTime() + 1) }));
    }
    await c.save();
    await respond(req, res);
  }),
);

module.exports = router;
