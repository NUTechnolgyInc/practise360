// People profiles: one person's basic details, practices and roles, contributions, certification plans and Claude
// usage reports — each part filtered by the rule of the screen it comes from (rbac/profile-access.js).
const express = require("express");
const mongoose = require("mongoose");
const { CertPlan, Contribution, UsageReport, User } = require("../models");
const { loadGrants } = require("../rbac/load");
const { profileView } = require("../rbac/profile-access");
const { actionsFor } = require("../rbac/contribution-access");
const { certActionsFor } = require("../rbac/cert-access");
const { bad, wrap, usersById } = require("../lib/http");
const { contributionSummary, planSummary } = require("../lib/summaries");

const router = express.Router();
const LIMIT = 500;
const NOT_FOUND = "Person not found";

const presentReport = (r) => ({ id: String(r._id), period: r.period, fileName: r.fileName, size: r.size, uploadedAt: r.updatedAt });

router.get(
  "/:id",
  wrap(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return bad(res, NOT_FOUND, 404);
    const person = await User.findById(id, "username displayName email isActive createdAt").lean();
    if (!person) return bad(res, NOT_FOUND, 404);

    const { user: viewer, tree } = req;
    const [grants, contributionDocs, planDocs, reports] = await Promise.all([
      loadGrants(person._id),
      Contribution.find({ $or: [{ ownerId: id }, { contributorIds: id }] }, "-events -description").sort({ updatedAt: -1 }).limit(LIMIT).lean(),
      CertPlan.find({ ownerId: id }, "-events -notes").sort({ updatedAt: -1 }).limit(LIMIT).lean(),
      UsageReport.find({ userId: id }).sort({ period: -1 }).lean(),
    ]);
    const view = profileView(viewer, id, grants, tree);

    // Each record keeps its own rule, so a co-contributor from the practice still sees the shared contribution.
    const contributions = contributionDocs.filter((c) => actionsFor(viewer, c, tree).view);
    const plans = planDocs.filter((p) => certActionsFor(viewer, p, tree).view);
    const people = await usersById([...contributions.flatMap((c) => [c.ownerId, c.createdBy]), ...plans.flatMap((p) => [p.ownerId, p.createdBy])]);
    const sections = {
      // null = this part of the profile is hidden from the viewer; [] = shown, but empty.
      contributions: view.contributions || contributions.length ? contributions.map((c) => contributionSummary(c, people, tree, viewer)) : null,
      certifications: view.certifications || plans.length ? plans.map((p) => planSummary(p, people, tree, viewer)) : null,
      usageReports: view.reports && (view.submitsReports || reports.length) ? reports.map(presentReport) : null,
    };

    // Anyone who can open the people directory already sees this person's name; otherwise only a visible part opens it.
    const visible =
      view.self ||
      (person.isActive && view.directory) ||
      view.practices.length > 0 ||
      view.appRoles.length > 0 ||
      Object.values(sections).some((s) => s !== null);
    if (!visible) return bad(res, NOT_FOUND, 404);

    res.json({
      id: String(person._id),
      username: person.username,
      displayName: person.displayName,
      email: person.email || null,
      isActive: person.isActive,
      memberSince: person.createdAt ?? null,
      isSelf: view.self,
      practices: view.practices,
      appRoles: view.appRoles,
      ...sections,
    });
  }),
);

module.exports = router;
