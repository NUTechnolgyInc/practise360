// Audit log viewer (docs/rbac.md §4 "Audit log"). Mounted behind platform.audit.view, which only Super Admin holds.
// Read-only on purpose: no route edits or deletes an entry.
const express = require("express");
const mongoose = require("mongoose");
const { AuditLog, AUDIT_OUTCOMES, CertCatalogItem, CertPlan, Contribution, Group, Practice, Role, User } = require("../models");
const { CATEGORIES } = require("../lib/audit-actions");
const { bad, wrap, parseDate } = require("../lib/http");

const router = express.Router();
const PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Mongo filter from the query string. Returns { error } for input the caller should fix. */
function filterFrom(q) {
  const filter = {};
  if (q.category) {
    if (!CATEGORIES.includes(q.category)) return { error: "Unknown category" };
    filter.category = q.category;
  }
  if (q.outcome) {
    if (!AUDIT_OUTCOMES.includes(q.outcome)) return { error: "outcome must be success, denied or failed" };
    filter.outcome = q.outcome;
  }
  if (q.actorId) {
    if (q.actorId === "none") filter.actorId = null;
    else if (mongoose.isValidObjectId(q.actorId)) filter.actorId = q.actorId;
    else return { error: "Unknown person" };
  }
  if (q.from || q.to) {
    const from = q.from ? parseDate(q.from) : null;
    const to = q.to ? parseDate(q.to) : null;
    if ((q.from && !from) || (q.to && !to)) return { error: "Dates must be YYYY-MM-DD" };
    filter.at = {};
    if (from) filter.at.$gte = from;
    // "to" is a whole day, so entries made during it are included.
    if (to) filter.at.$lt = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }
  const text = String(q.q || "").trim().slice(0, 100);
  if (text) {
    const re = new RegExp(escapeRegex(text), "i");
    filter.$or = [{ label: re }, { action: re }, { actorName: re }, { actorUsername: re }, { route: re }, { error: re }, { ip: re }];
  }
  return { filter };
}

/** Every string value in an entry's params and details — the ids worth turning into names. */
function collectValues(value, out = new Set()) {
  if (typeof value === "string") out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectValues(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectValues(v, out));
  return out;
}

/** id → readable name for the people, practices, groups, roles, contributions and certs the page mentions. */
async function namesFor(entries) {
  const values = new Set();
  for (const e of entries) {
    collectValues(e.params, values);
    collectValues(e.details, values);
    if (e.resultId) values.add(e.resultId);
  }
  const all = [...values].filter((v) => v.length <= 80);
  const objectIds = all.filter((v) => /^[a-f\d]{24}$/i.test(v));
  const slugs = all.filter((v) => /^[a-z\d_-]+$/.test(v));
  const [users, contributions, plans, catalog, practices, groups, roles] = await Promise.all([
    User.find({ _id: { $in: objectIds } }, "displayName").lean(),
    Contribution.find({ _id: { $in: objectIds } }, "title").lean(),
    CertPlan.find({ _id: { $in: objectIds } }, "cert.title").lean(),
    CertCatalogItem.find({ _id: { $in: objectIds } }, "title").lean(),
    Practice.find({ _id: { $in: slugs } }, "name").lean(),
    Group.find({ _id: { $in: slugs } }, "name").lean(),
    Role.find({ _id: { $in: slugs } }, "name").lean(),
  ]);
  return Object.fromEntries([
    ...roles.map((r) => [r._id, r.name]),
    ...groups.map((g) => [g._id, g.name]),
    ...practices.map((p) => [p._id, p.name]),
    ...catalog.map((c) => [String(c._id), c.title]),
    ...plans.map((p) => [String(p._id), p.cert?.title]),
    ...contributions.map((c) => [String(c._id), c.title]),
    ...users.map((u) => [String(u._id), u.displayName]),
  ]);
}

const present = (e) => ({
  id: String(e._id),
  at: e.at,
  actor: e.actorId || e.actorName ? { id: e.actorId ? String(e.actorId) : null, displayName: e.actorName ?? "Unknown user", username: e.actorUsername } : null,
  action: e.action,
  label: e.label,
  category: e.category,
  method: e.method,
  route: e.route,
  params: e.params ?? {},
  details: e.details ?? {},
  resultId: e.resultId,
  status: e.status,
  outcome: e.outcome,
  error: e.error,
  ip: e.ip ?? null,
  userAgent: e.userAgent ?? null,
});

router.get(
  "/",
  wrap(async (req, res) => {
    const { filter, error } = filterFrom(req.query);
    if (error) return bad(res, error);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query.pageSize, 10) || PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const [entries, total, actors] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AuditLog.countDocuments(filter),
      // Everyone who appears in the log, for the "Who" filter — names as they were recorded.
      AuditLog.aggregate([
        { $match: { actorId: { $ne: null } } },
        { $sort: { at: -1 } },
        { $group: { _id: "$actorId", displayName: { $first: "$actorName" }, username: { $first: "$actorUsername" } } },
        { $sort: { displayName: 1 } },
      ]),
    ]);

    res.json({
      entries: entries.map(present),
      names: await namesFor(entries),
      total,
      page,
      pageSize,
      filters: {
        categories: CATEGORIES,
        outcomes: AUDIT_OUTCOMES,
        actors: actors.map((a) => ({ id: String(a._id), displayName: a.displayName ?? "Unknown user", username: a.username })),
      },
    });
  }),
);

module.exports = router;
