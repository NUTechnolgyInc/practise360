const express = require("express");
const mongoose = require("mongoose");
const { Role, RoleAssignment, UsageReport, User } = require("../models");
const { requireAnyScope } = require("../middleware/auth");
const { OWN, VIEW, practicesOf, canViewReportsOf, canSubmit, isSubmitter, isValidPeriod } = require("../rbac/usage-access");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

// Vercel caps request bodies at 4.5 MB, so the PDF limit sits just under it.
const MAX_BYTES = 4 * 1024 * 1024;
const pdfBody = express.raw({ type: "application/pdf", limit: MAX_BYTES });

const present = (r) => ({ id: String(r._id), period: r.period, fileName: r.fileName, size: r.size, uploadedAt: r.updatedAt });

/** Every active user with their resolved grants — the org is small, and visibility needs each owner's practices. */
async function loadPeople() {
  const [users, assignments, roles] = await Promise.all([User.find({ isActive: true }).lean(), RoleAssignment.find().lean(), Role.find().lean()]);
  const perms = new Map(roles.map((r) => [r._id, r.permissions]));
  return users.map((u) => ({
    user: u,
    grants: assignments
      .filter((a) => String(a.userId) === String(u._id) && perms.has(a.roleId))
      .map((a) => ({ scopeType: a.scopeType, scopeId: a.scopeId, permissions: perms.get(a.roleId) })),
  }));
}

async function ownerGrants(userId) {
  const [person] = (await loadPeople()).filter((p) => String(p.user._id) === String(userId));
  return person?.grants ?? [];
}

// ---------- own reports ----------

router.get(
  "/mine",
  requireAnyScope(OWN),
  wrap(async (req, res) => {
    const reports = await UsageReport.find({ userId: req.user.id }).sort({ period: -1 }).lean();
    res.json(reports.map(present));
  }),
);

router.put(
  "/mine/:period",
  requireAnyScope(OWN),
  pdfBody,
  wrap(async (req, res) => {
    const { period } = req.params;
    if (!isValidPeriod(period)) return res.status(400).json({ error: "Period must be YYYY-MM and not in the future" });
    const pdf = req.body;
    // Check the magic bytes, not just the content-type header the client chose to send.
    if (!Buffer.isBuffer(pdf) || pdf.length < 5 || pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return res.status(400).json({ error: "Upload a PDF file (Content-Type: application/pdf)" });
    }
    const fileName = String(req.query.fileName || `claude-usage-${period}.pdf`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
    const report = await UsageReport.findOneAndUpdate(
      { userId: req.user.id, period },
      { fileName, size: pdf.length, pdf },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();
    res.json(present(report));
  }),
);

router.delete(
  "/mine/:period",
  requireAnyScope(OWN),
  wrap(async (req, res) => {
    const { deletedCount } = await UsageReport.deleteOne({ userId: req.user.id, period: req.params.period });
    if (!deletedCount) return res.status(404).json({ error: "No report for that month" });
    res.status(204).end();
  }),
);

// ---------- team view ----------

/** Everyone the caller may see for a month: expected submitters plus anyone who uploaded, with their report or null. */
router.get(
  "/",
  requireAnyScope(VIEW),
  wrap(async (req, res) => {
    const period = req.query.period;
    if (!isValidPeriod(period)) return res.status(400).json({ error: "period query must be YYYY-MM and not in the future" });
    const { practices } = req.tree;
    const [people, reports] = await Promise.all([loadPeople(), UsageReport.find({ period }).lean()]);
    const byUser = new Map(reports.map((r) => [String(r.userId), r]));
    const practiceName = (id) => practices.find((p) => p._id === id)?.name ?? id;

    const rows = people
      .map(({ user, grants }) => ({ user, practiceIds: practicesOf(grants), report: byUser.get(String(user._id)) ?? null, expected: isSubmitter(grants) }))
      .filter((p) => (p.expected || p.report) && canViewReportsOf(req.user, p.practiceIds, practices))
      .map((p) => ({
        user: { id: String(p.user._id), username: p.user.username, displayName: p.user.displayName },
        practices: p.practiceIds.map((id) => ({ id, name: practiceName(id) })),
        report: p.report && present(p.report),
      }))
      .sort((a, b) => a.user.displayName.localeCompare(b.user.displayName));

    res.json({ period, summary: { people: rows.length, submitted: rows.filter((r) => r.report).length }, people: rows });
  }),
);

/** The PDF itself — for the owner, or anyone who may view the owner's reports. */
router.get(
  "/:id/file",
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Report not found" });
    const report = await UsageReport.findById(req.params.id).select("+pdf").lean();
    if (!report) return res.status(404).json({ error: "Report not found" });

    const isOwner = String(report.userId) === req.user.id && canSubmit(req.user);
    const allowed = isOwner || canViewReportsOf(req.user, practicesOf(await ownerGrants(report.userId)), req.tree.practices);
    if (!allowed) return res.status(403).json({ error: `Missing permission ${VIEW}` });

    const pdf = Buffer.from(report.pdf.buffer ?? report.pdf);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": pdf.length,
      "Content-Disposition": `inline; filename="${report.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    });
    res.send(pdf);
  }),
);

module.exports = router;
