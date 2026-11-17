// Practices → the Overview of a practice or of one of its groups: key information (Markdown) and files
// (docs/rbac.md §4 "Practices and groups"). Anyone who can view the practice reads both. A practice's Overview is
// edited with `practices.practice.update` (Manager, Practices Admin); a group's with `practices.group.update` (its
// Lead, plus the Manager and Practices Admin through the practice). Registered on the practices router (not mounted
// as a sub-router) so `load` resolves :id first and the OpenAPI route test sees plain paths.
const mongoose = require("mongoose");
const { GroupOverview, PracticeFile, PracticeOverview } = require("../models");
const { can } = require("../rbac/engine");
const { bad, wrap, rawBody, str, usersById, person, sendStoredFile, safeFileName } = require("../lib/http");

const MAX_BODY = 50000;
// Each file is ≤ 4 MB and stored in Mongo, so cap the count rather than let one overview grow without bound.
const MAX_FILES = 50;

/** What an Overview route works on: where its text and files live and which permission edits them. */
const TARGETS = {
  practice: (req) => ({
    label: "practice",
    Model: PracticeOverview,
    docId: req.practice._id,
    files: { practiceId: req.practice._id, groupId: null },
    perm: "practices.practice.update",
    scope: { type: "practice", id: req.practice._id },
  }),
  group: (req) => ({
    label: "group",
    Model: GroupOverview,
    docId: req.group._id,
    files: { practiceId: req.practice._id, groupId: req.group._id },
    perm: "practices.group.update",
    scope: { type: "group", id: req.group._id },
  }),
};

const canEdit = (req, t) => can(req.user, t.perm, t.scope, undefined, req.tree);

const presentFile = (f, people) => ({
  id: String(f._id),
  fileName: f.fileName,
  contentType: f.contentType,
  size: f.size,
  uploadedBy: person(people, f.uploadedBy),
  uploadedAt: f.createdAt,
});

async function overview(req, t) {
  const [doc, files] = await Promise.all([t.Model.findById(t.docId).lean(), PracticeFile.find(t.files).sort({ createdAt: -1 }).lean()]);
  const people = await usersById([doc?.updatedBy, ...files.map((f) => f.uploadedBy)]);
  return {
    body: doc?.body ?? "",
    updatedAt: doc?.updatedAt ?? null,
    updatedBy: person(people, doc?.updatedBy),
    files: files.map((f) => presentFile(f, people)),
    canEdit: canEdit(req, t),
  };
}

function findFile(req, t) {
  if (!mongoose.isValidObjectId(req.params.fileId)) return null;
  return PracticeFile.findOne({ _id: req.params.fileId, ...t.files });
}

/** Adds one set of Overview routes under `base`. `guards` load the practice (and group) the caller can view. */
function overviewRoutes(router, base, guards, targetOf) {
  const target = (req, res, next) => {
    req.overviewTarget = targetOf(req);
    next();
  };
  const requireEdit = (req, res, next) => (canEdit(req, req.overviewTarget) ? next() : bad(res, `Missing permission ${req.overviewTarget.perm}`, 403));
  const read = [...guards, target];

  router.get(base, ...read, wrap(async (req, res) => res.json(await overview(req, req.overviewTarget))));

  router.put(
    base,
    ...read,
    requireEdit,
    wrap(async (req, res) => {
      const t = req.overviewTarget;
      const body = str(req.body?.body, MAX_BODY, "Overview");
      await t.Model.updateOne({ _id: t.docId }, { body, updatedBy: req.user.id }, { upsert: true });
      res.json(await overview(req, t));
    }),
  );

  router.post(
    `${base}/files`,
    ...read,
    requireEdit,
    rawBody,
    wrap(async (req, res) => {
      const t = req.overviewTarget;
      const data = req.body;
      if (!Buffer.isBuffer(data) || data.length === 0) return bad(res, "Send the file as the request body");
      if ((await PracticeFile.countDocuments(t.files)) >= MAX_FILES) return bad(res, `A ${t.label} can hold up to ${MAX_FILES} files — remove one first`, 409);
      const contentType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0].slice(0, 100);
      const file = await PracticeFile.create({ ...t.files, uploadedBy: req.user.id, fileName: safeFileName(req.query.fileName), contentType, size: data.length, data });
      res.status(201).json(presentFile(file, await usersById([req.user.id])));
    }),
  );

  router.get(
    `${base}/files/:fileId`,
    ...read,
    wrap(async (req, res) => {
      const file = await findFile(req, req.overviewTarget)?.select("+data").lean();
      if (!file) return bad(res, "File not found", 404);
      sendStoredFile(res, file);
    }),
  );

  router.delete(
    `${base}/files/:fileId`,
    ...read,
    requireEdit,
    wrap(async (req, res) => {
      const file = await findFile(req, req.overviewTarget)?.lean();
      if (!file) return bad(res, "File not found", 404);
      await PracticeFile.deleteOne({ _id: file._id });
      res.status(204).end();
    }),
  );
}

/** Adds the practice and group Overview routes to the practices router. */
module.exports = function practiceOverviewRoutes(router, { load, loadGroup }) {
  overviewRoutes(router, "/:id/overview", [load], TARGETS.practice);
  overviewRoutes(router, "/:id/groups/:groupId/overview", [load, loadGroup], TARGETS.group);
};
