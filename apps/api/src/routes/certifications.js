// Certification Tracker: shared catalog, member plans, recommend/assign, completion + Lead → Manager approval.
// Every plan route resolves the plan's practice and checks certActionsFor() (src/rbac/cert-access.js) — the same
// rules the web app uses to hide buttons.
const express = require("express");
const mongoose = require("mongoose");
const { CertCatalogItem, CertPlan, CertFile, CERT_TYPES, CERT_STATUSES } = require("../models");
const { can } = require("../rbac/engine");
const access = require("../rbac/cert-access");
const { bad, InputError, wrap, rawBody, str, parseDate, usersById, person, practiceMembers, sendStoredFile, safeFileName } = require("../lib/http");
const { planSummary: summary, hasCompletion, reimbursementOf } = require("../lib/summaries");

const { PERM, OPEN, catalogKey, certActionsFor, holdsAnywhere, completionProblems, nextStatus, isUrl, sameId } = access;
const router = express.Router();
const OWN_PERM = `${PERM.OWN}:own`;
const CERT_FILE_TYPES = /^(application\/pdf|image\/(png|jpeg|webp))$/;
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

// ---------- catalog ----------

/** Validated cert fields from a request body (new catalog entry or a one-off on a plan). */
function certInput(b) {
  const title = str(b?.title, 160, "Title");
  if (!title) throw new InputError("Name the certification or course");
  if (!CERT_TYPES.includes(b?.type)) throw new InputError("Pick a type: certification or course");
  const url = str(b?.url, 500, "Link");
  if (url && !isUrl(url)) throw new InputError(`Not a valid http(s) link: ${url}`);
  return { title, type: b.type, provider: str(b?.provider, 80, "Provider"), url, description: str(b?.description, 2000, "Description") };
}

const snapshot = (c) => ({ title: c.title, type: c.type, provider: c.provider || "", url: c.url || "" });

function presentCatalog(item, user, people) {
  const manage = holdsAnywhere(user, PERM.CATALOG_MANAGE);
  return {
    id: String(item._id),
    title: item.title,
    type: item.type,
    provider: item.provider,
    url: item.url,
    description: item.description,
    isActive: item.isActive,
    createdBy: person(people, item.createdBy),
    createdAt: item.createdAt,
    canEdit: manage || (sameId(item.createdBy, user.id) && holdsAnywhere(user, PERM.CATALOG_CREATE)),
    canRetire: manage,
  };
}

/** Adds a cert to the shared catalog, or reuses the entry that's already there under the same title + provider. */
async function catalogEntryFor(input, userId) {
  const key = catalogKey(input.title, input.provider);
  const existing = await CertCatalogItem.findOne({ key });
  if (existing && !existing.isActive) throw new InputError(`"${existing.title}" is retired in the catalog — ask a Cert Admin to restore it`);
  return existing ?? CertCatalogItem.create({ ...input, key, createdBy: userId });
}

/**
 * The cert a plan is for: an active catalog entry (`catalogId`), or a new one (`cert`). New certs from a
 * recommendation/assignment go into the shared catalog; on your own plan they stay one-off (rbac.md §4).
 */
async function resolveCert(b, user, { addToCatalog }) {
  if (b?.catalogId) {
    const item = mongoose.isValidObjectId(b.catalogId) ? await CertCatalogItem.findById(b.catalogId).lean() : null;
    if (!item || !item.isActive) throw new InputError("Pick an active catalog entry");
    return { catalogId: item._id, cert: snapshot(item) };
  }
  if (!b?.cert) throw new InputError("Pick a certification from the catalog or add a new one");
  const input = certInput(b.cert);
  if (!addToCatalog) return { catalogId: null, cert: snapshot(input) };
  if (!holdsAnywhere(user, PERM.CATALOG_CREATE, PERM.CATALOG_MANAGE)) throw new InputError(`Adding to the catalog needs ${PERM.CATALOG_CREATE}`);
  const item = await catalogEntryFor(input, user.id);
  return { catalogId: item._id, cert: snapshot(item) };
}

router.get(
  "/catalog",
  wrap(async (req, res) => {
    if (!holdsAnywhere(req.user, PERM.CATALOG_VIEW)) return bad(res, `Missing permission ${PERM.CATALOG_VIEW}`, 403);
    // Retired entries are only listed for people who can restore them.
    const filter = req.query.includeRetired === "true" && holdsAnywhere(req.user, PERM.CATALOG_MANAGE) ? {} : { isActive: true };
    const items = await CertCatalogItem.find(filter).sort({ title: 1 }).lean();
    const people = await usersById(items.map((i) => i.createdBy));
    res.json({
      items: items.map((i) => presentCatalog(i, req.user, people)),
      canCreate: holdsAnywhere(req.user, PERM.CATALOG_CREATE, PERM.CATALOG_MANAGE),
      canManage: holdsAnywhere(req.user, PERM.CATALOG_MANAGE),
    });
  }),
);

router.post(
  "/catalog",
  wrap(async (req, res) => {
    if (!holdsAnywhere(req.user, PERM.CATALOG_CREATE, PERM.CATALOG_MANAGE)) return bad(res, `Missing permission ${PERM.CATALOG_CREATE}`, 403);
    const input = certInput(req.body);
    const key = catalogKey(input.title, input.provider);
    if (await CertCatalogItem.exists({ key })) return bad(res, `"${input.title}" is already in the catalog`, 409);
    const item = await CertCatalogItem.create({ ...input, key, createdBy: req.user.id });
    res.status(201).json(presentCatalog(item.toObject(), req.user, await usersById([item.createdBy])));
  }),
);

router.patch(
  "/catalog/:id",
  wrap(async (req, res) => {
    const item = mongoose.isValidObjectId(req.params.id) ? await CertCatalogItem.findById(req.params.id) : null;
    if (!item || !holdsAnywhere(req.user, PERM.CATALOG_VIEW)) return bad(res, "Catalog entry not found", 404);
    const view = presentCatalog(item.toObject(), req.user, new Map());
    const b = req.body || {};
    if (b.isActive !== undefined && !view.canRetire) return bad(res, `Retiring or restoring needs ${PERM.CATALOG_MANAGE}`, 403);
    const editing = ["title", "type", "provider", "url", "description"].some((k) => b[k] !== undefined);
    if (editing && !view.canEdit) return bad(res, `Only the person who added it or a Cert Admin (${PERM.CATALOG_MANAGE}) can edit it`, 403);
    if (editing) {
      const input = certInput({ title: item.title, type: item.type, provider: item.provider, url: item.url, description: item.description, ...b });
      const key = catalogKey(input.title, input.provider);
      if (key !== item.key && (await CertCatalogItem.exists({ key }))) return bad(res, `"${input.title}" is already in the catalog`, 409);
      Object.assign(item, input, { key });
    }
    if (b.isActive !== undefined) item.isActive = b.isActive === true;
    await item.save();
    res.json(presentCatalog(item.toObject(), req.user, await usersById([item.createdBy])));
  }),
);

// ---------- presentation ----------

const presentFile = (f) => ({ id: String(f._id), kind: f.kind, fileName: f.fileName, contentType: f.contentType, size: f.size, uploadedBy: String(f.uploadedBy), uploadedAt: f.createdAt });

async function detail(p, tree, user) {
  const ids = [p.ownerId, p.createdBy, p.leadReview?.by, p.managerReview?.by, ...(p.events || []).map((e) => e.authorId)];
  const [people, files] = await Promise.all([usersById(ids), CertFile.find({ planId: p._id }).sort({ createdAt: 1 }).lean()]);
  const c = p.completion;
  const r = reimbursementOf(p);
  return {
    ...summary(p, people, tree, user),
    notes: p.notes || "",
    clarificationStage: p.clarificationStage ?? null,
    completion: hasCompletion(p)
      ? {
          completedOn: c.completedOn,
          verificationUrl: c.verificationUrl,
          credentialId: c.credentialId || "",
          expiresOn: c.expiresOn ?? null,
          certificateFileIds: (c.certificateFileIds || []).map(String),
          reimbursement: r ? { amount: r.amount, currency: r.currency, receiptFileIds: (r.receiptFileIds || []).map(String) } : null,
          submittedAt: c.submittedAt,
        }
      : null,
    leadReview: p.leadReview?.by ? { by: person(people, p.leadReview.by), at: p.leadReview.at } : null,
    managerReview: p.managerReview?.by ? { by: person(people, p.managerReview.by), at: p.managerReview.at } : null,
    files: files.map(presentFile),
    events: (p.events || [])
      .map((e) => ({
        id: String(e._id),
        kind: e.kind,
        at: e.at,
        author: person(people, e.authorId),
        body: e.body || "",
        fileIds: (e.fileIds || []).map(String),
        stage: e.stage ?? null,
        decision: e.decision ?? null,
      }))
      .sort((a, b) => new Date(b.at) - new Date(a.at)),
    actions: certActionsFor(user, p, tree),
  };
}

// ---------- loading + guards ----------

/** Loads :id into req.plan and req.actions; 404 when missing or not visible (don't leak existence). */
const load = wrap(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return bad(res, "Plan not found", 404);
  const p = await CertPlan.findById(req.params.id);
  if (!p) return bad(res, "Plan not found", 404);
  const actions = certActionsFor(req.user, p, req.tree);
  if (!actions.view) return bad(res, "Plan not found", 404);
  req.plan = p;
  req.actions = actions;
  next();
});

const allow = (action, message) => (req, res, next) => (req.actions[action] ? next() : bad(res, message, 403));
const event = (req, fields) => ({ authorId: req.user.id, at: new Date(), ...fields });
const respond = async (req, res, status = 200) => res.status(status).json(await detail(req.plan, req.tree, req.user));

/** Only this plan's files of the given kind may be referenced. */
async function ownFileIds(p, ids, kind) {
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => mongoose.isValidObjectId(id)))];
  if (!wanted.length) return [];
  const files = await CertFile.find({ _id: { $in: wanted }, planId: p._id, kind }, "_id").lean();
  return files.map((f) => f._id);
}

/** People who can hold plans in a practice (cert.plan.manage:own through a practice-scope assignment). */
const certMembers = (practiceId, practices) =>
  practiceMembers(practiceId, (u) => can(u, OWN_PERM, { type: "practice", id: practiceId }, { ownerId: u.id }, practices));

const requireDates = (startRaw, dueRaw, { startRequired = true } = {}) => {
  const startDate = startRaw ? parseDate(startRaw) : null;
  const dueDate = dueRaw ? parseDate(dueRaw) : null;
  if ((startRaw && !startDate) || (dueRaw && !dueDate)) throw new InputError("Dates must be YYYY-MM-DD");
  if (startRequired && (!startDate || !dueDate)) throw new InputError("Start and due dates are required (YYYY-MM-DD)");
  if (startDate && dueDate && dueDate < startDate) throw new InputError("Due date can't be before the start date");
  return { startDate, dueDate };
};

const openPlanFor = (ownerId, catalogId) => (catalogId ? CertPlan.exists({ ownerId, catalogId, status: { $in: OPEN } }) : null);

// ---------- list + create ----------

router.get(
  "/plans",
  wrap(async (req, res) => {
    const { tree, user } = req;
    const own = access.ownPractices(user, tree);
    const team = access.viewablePractices(user, tree);
    if (!own.length && !team.length) return bad(res, `Missing one of ${OWN_PERM}, ${PERM.VIEW}`, 403);

    const filter = { $or: [{ ownerId: user.id }, { practiceId: { $in: team } }] };
    if (CERT_STATUSES.includes(req.query.status)) filter.status = req.query.status;
    // A Lead's team practice includes other groups' plans — keep only what they may see.
    const docs = (await CertPlan.find(filter, "-events -notes").sort({ updatedAt: -1 }).limit(1000).lean()).filter((p) => certActionsFor(user, p, tree).view);
    const people = await usersById(docs.flatMap((p) => [p.ownerId, p.createdBy]));
    const visible = [...new Set([...own, ...team])];
    res.json({
      plans: docs.map((p) => summary(p, people, tree, user)),
      practices: tree.practices.filter((p) => visible.includes(p._id)).map((p) => ({ id: p._id, name: p.name })),
      canPlanIn: own,
      canSuggestIn: access.suggestablePractices(user, tree),
      canAssignIn: access.assignablePractices(user, tree),
      teamPractices: team,
    });
  }),
);

router.post(
  "/plans",
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!access.ownPractices(req.user, req.tree).includes(b.practiceId)) return bad(res, `Missing permission ${OWN_PERM} in that practice`, 403);
    const { catalogId, cert } = await resolveCert(b, req.user, { addToCatalog: false });
    const { startDate, dueDate } = requireDates(b.startDate, b.dueDate);
    if (await openPlanFor(req.user.id, catalogId)) return bad(res, `You already have an open plan for ${cert.title}`, 409);
    const notes = str(b.notes, 5000, "Notes");
    const p = await CertPlan.create({
      practiceId: b.practiceId,
      ownerId: req.user.id,
      catalogId,
      cert,
      source: "self",
      createdBy: req.user.id,
      startDate,
      dueDate,
      notes,
      status: "planned",
      events: [{ kind: "created", authorId: req.user.id, body: notes }],
    });
    req.plan = p;
    await respond(req, res, 201);
  }),
);

/** Recommend or assign a cert to one or more practice members — one plan each. */
router.post(
  "/assignments",
  wrap(async (req, res) => {
    const { tree, user } = req;
    const b = req.body || {};
    const mode = b.mode;
    if (!["suggest", "assign"].includes(mode)) return bad(res, "mode must be suggest or assign");
    const perm = mode === "assign" ? PERM.ASSIGN : PERM.SUGGEST;
    if (!tree.practices.some((p) => p._id === b.practiceId) || !access.canInPractice(user, perm, b.practiceId, tree)) return bad(res, `Missing permission ${perm} in that practice`, 403);

    const userIds = [...new Set((Array.isArray(b.userIds) ? b.userIds : []).map(String))];
    if (!userIds.length) return bad(res, "Pick at least one person");
    if (userIds.length > 100) return bad(res, "Pick at most 100 people at a time");
    const members = new Map((await certMembers(b.practiceId, tree.practices)).map((m) => [m.id, m]));
    const outsiders = userIds.filter((id) => !members.has(id));
    if (outsiders.length) return bad(res, "Only members of this practice can be picked");
    // A Lead reaches only their group's members (rbac.md §4 "Practices and groups").
    const outOfReach = userIds.filter((id) => !access.canForMember(user, perm, b.practiceId, id, tree));
    if (outOfReach.length) return bad(res, `You can only ${mode === "assign" ? "assign" : "recommend"} certifications to people in your group — not ${outOfReach.map((id) => members.get(id).displayName).join(", ")}`, 403);

    const { startDate, dueDate } = requireDates(b.startDate, b.dueDate, { startRequired: false });
    if (mode === "assign" && !dueDate) return bad(res, "An assignment needs a due date");
    const today = new Date(new Date().toISOString().slice(0, 10));
    if (dueDate && dueDate < today) return bad(res, "The due date can't be in the past");
    const note = str(b.note, 5000, "Note");
    const { catalogId, cert } = await resolveCert(b, user, { addToCatalog: true });

    const created = [];
    const skipped = [];
    for (const id of userIds) {
      if (sameId(id, user.id)) {
        skipped.push({ user: members.get(id), reason: "That's you — add it as your own plan" });
        continue;
      }
      if (await openPlanFor(id, catalogId)) {
        skipped.push({ user: members.get(id), reason: "Already has an open plan for it" });
        continue;
      }
      created.push(
        await CertPlan.create({
          practiceId: b.practiceId,
          ownerId: id,
          catalogId,
          cert,
          source: mode === "assign" ? "assigned" : "suggested",
          createdBy: user.id,
          // An assignment starts now unless the assigner picked a date; a recommendation gets its dates when accepted.
          startDate: mode === "assign" ? (startDate ?? today) : startDate,
          dueDate,
          status: mode === "assign" ? "planned" : "suggested",
          events: [{ kind: mode === "assign" ? "assigned" : "suggested", authorId: user.id, body: note }],
        }),
      );
    }
    const people = await usersById([user.id, ...created.map((p) => p.ownerId)]);
    res.status(created.length ? 201 : 200).json({ created: created.map((p) => summary(p.toObject(), people, tree, user)), skipped });
  }),
);

/** Members of a practice who can be recommended or assigned a cert (for the picker). */
router.get(
  "/people/:practiceId",
  wrap(async (req, res) => {
    const { practiceId } = req.params;
    const { user, tree } = req;
    const reach = (perm) => access.canInPractice(user, perm, practiceId, tree);
    if (!reach(PERM.SUGGEST) && !reach(PERM.ASSIGN)) {
      return bad(res, `Missing permission ${PERM.SUGGEST} or ${PERM.ASSIGN}`, 403);
    }
    // Only people the caller reaches: everyone for a Manager, their group's members for a Lead.
    const members = await certMembers(practiceId, tree.practices);
    res.json(members.filter((m) => [PERM.SUGGEST, PERM.ASSIGN].some((perm) => access.canForMember(user, perm, practiceId, m.id, tree))));
  }),
);

// ---------- one plan ----------

router.get("/plans/:id", load, wrap((req, res) => respond(req, res)));

router.patch(
  "/plans/:id",
  load,
  wrap(async (req, res) => {
    const p = req.plan;
    const b = req.body || {};
    const { actions } = req;
    if (!actions.edit && !actions.editDueDate) return bad(res, "You can't change this plan now", 403);
    if ((b.startDate !== undefined || b.notes !== undefined) && !actions.edit) return bad(res, "Only the owner can change the start date and notes", 403);
    if (b.dueDate !== undefined && !actions.editDueDate) return bad(res, p.source === "assigned" ? "The due date of an assignment is set by whoever assigned it" : "You can't change the due date", 403);

    const changes = [];
    for (const key of ["startDate", "dueDate"]) {
      if (b[key] === undefined) continue;
      const d = parseDate(b[key]);
      if (!d) return bad(res, `${key} must be YYYY-MM-DD`);
      if (dateOnly(p[key]) !== dateOnly(d)) changes.push(`${key === "startDate" ? "Start" : "Due"} date: ${dateOnly(p[key])} → ${dateOnly(d)}`);
      p[key] = d;
    }
    if (p.startDate && p.dueDate && p.dueDate < p.startDate) return bad(res, "Due date can't be before the start date");
    if (b.notes !== undefined) {
      const notes = str(b.notes, 5000, "Notes");
      if (notes !== p.notes) changes.push("Notes updated");
      p.notes = notes;
    }
    if (changes.length) p.events.push(event(req, { kind: "updated", body: changes.join("\n\n") }));
    await p.save();
    await respond(req, res);
  }),
);

router.post(
  "/plans/:id/accept",
  load,
  allow("accept", "Only the person it was recommended to can accept it"),
  wrap(async (req, res) => {
    const p = req.plan;
    const { startDate, dueDate } = requireDates(req.body?.startDate, req.body?.dueDate);
    Object.assign(p, { startDate, dueDate, status: "planned" });
    p.events.push(event(req, { kind: "accepted", body: `Planned ${dateOnly(startDate)} → ${dateOnly(dueDate)}` }));
    await p.save();
    await respond(req, res);
  }),
);

/** Closing transitions that only differ in who may do them and how they're logged. */
const close = (route, action, message, status, kind) =>
  router.post(
    `/plans/:id/${route}`,
    load,
    allow(action, message),
    wrap(async (req, res) => {
      const p = req.plan;
      p.status = status;
      p.clarificationStage = undefined;
      p.events.push(event(req, { kind, body: str(req.body?.reason, 2000, "Reason") }));
      await p.save();
      await respond(req, res);
    }),
  );
close("decline", "decline", "Only the person it was recommended to can decline it", "declined", "declined");
close("drop", "drop", "Only the owner can drop their own plan, and assigned certifications can't be dropped", "dropped", "dropped");
close("withdraw", "withdraw", "Only someone who can recommend or assign here can withdraw it", "dropped", "withdrawn");

// ---------- files ----------

router.post(
  "/plans/:id/files",
  load,
  allow("upload", "Only the owner can add files, while the plan is open"),
  rawBody,
  wrap(async (req, res) => {
    const data = req.body;
    if (!Buffer.isBuffer(data) || data.length === 0) return bad(res, "Send the file as the request body");
    const kind = req.query.kind === "receipt" ? "receipt" : "certificate";
    const contentType = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!CERT_FILE_TYPES.test(contentType)) return bad(res, "Upload a PDF or an image (PNG, JPEG or WebP)");
    const file = await CertFile.create({ planId: req.plan._id, kind, uploadedBy: req.user.id, fileName: safeFileName(req.query.fileName, kind), contentType, size: data.length, data });
    res.status(201).json(presentFile(file));
  }),
);

router.get(
  "/plans/:id/files/:fileId",
  load,
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.fileId)) return bad(res, "File not found", 404);
    const file = await CertFile.findOne({ _id: req.params.fileId, planId: req.plan._id }).select("+data").lean();
    if (!file) return bad(res, "File not found", 404);
    sendStoredFile(res, file);
  }),
);

router.delete(
  "/plans/:id/files/:fileId",
  load,
  allow("upload", "Files can only be removed by the owner while the plan is open"),
  wrap(async (req, res) => {
    const p = req.plan;
    if (!mongoose.isValidObjectId(req.params.fileId)) return bad(res, "File not found", 404);
    const file = await CertFile.findOne({ _id: req.params.fileId, planId: p._id }).lean();
    if (!file) return bad(res, "File not found", 404);
    // Anything that was part of a submission is evidence a reviewer saw — keep it.
    if (p.events.some((e) => e.fileIds.some((id) => sameId(id, file._id)))) return bad(res, "This file was part of a submission and can't be removed", 409);
    await CertFile.deleteOne({ _id: file._id });
    if (p.completion?.certificateFileIds) p.completion.certificateFileIds = p.completion.certificateFileIds.filter((id) => !sameId(id, file._id));
    if (p.completion?.reimbursement?.receiptFileIds) p.completion.reimbursement.receiptFileIds = p.completion.reimbursement.receiptFileIds.filter((id) => !sameId(id, file._id));
    await p.save();
    res.status(204).end();
  }),
);

// ---------- completion + review ----------

router.post(
  "/plans/:id/submit",
  load,
  allow("submit", "Only the owner can submit a completion, while the plan is planned or awaiting clarification"),
  wrap(async (req, res) => {
    const p = req.plan;
    const b = req.body || {};
    const parseOptionalDate = (v, label) => {
      if (!v) return null;
      const d = parseDate(v);
      if (!d) throw new InputError(`${label} must be YYYY-MM-DD`);
      return d;
    };
    const r = b.reimbursement;
    const sub = {
      completedOn: b.completedOn ? parseOptionalDate(b.completedOn, "The completion date") : null,
      verificationUrl: str(b.verificationUrl, 500, "Verification link"),
      credentialId: str(b.credentialId, 120, "Credential ID"),
      expiresOn: parseOptionalDate(b.expiresOn, "The expiry date"),
      certificateFileIds: await ownFileIds(p, b.certificateFileIds, "certificate"),
      reimbursement: r ? { amount: typeof r.amount === "string" ? Number(r.amount) : r.amount, currency: r.currency, receiptFileIds: await ownFileIds(p, r.receiptFileIds, "receipt") } : null,
    };
    const problems = completionProblems(sub);
    if (problems.length) return res.status(400).json({ error: problems[0], problems });

    const resubmit = p.status === "clarification";
    const returnTo = resubmit ? p.clarificationStage : "lead";
    p.completion = { ...sub, reimbursement: sub.reimbursement ?? undefined, submittedAt: new Date() };
    p.status = returnTo === "manager" ? "manager_review" : "lead_review";
    p.clarificationStage = undefined;
    const note = str(b.note, 10000, "Note");
    const fileIds = [...sub.certificateFileIds, ...(sub.reimbursement?.receiptFileIds ?? [])];
    p.events.push(event(req, { kind: "submitted", stage: returnTo, body: note || (resubmit ? "Resubmitted with clarifications" : "Submitted the completion for review"), fileIds }));
    await p.save();
    await respond(req, res);
  }),
);

router.post(
  "/plans/:id/review",
  load,
  wrap(async (req, res) => {
    const p = req.plan;
    const stage = p.status === "lead_review" ? "lead" : p.status === "manager_review" ? "manager" : null;
    if (!stage) return bad(res, "This plan isn't waiting for a review", 409);
    if (!req.actions[stage === "lead" ? "review" : "approve"]) {
      return bad(res, stage === "lead" ? `Needs ${PERM.REVIEW} in this practice, and you can't review your own plan` : `Needs ${PERM.VERIFY}; the owner and the Lead-step reviewer can't give final approval`, 403);
    }
    const { decision } = req.body || {};
    if (!["approve", "reject", "clarify"].includes(decision)) return bad(res, "decision must be approve, reject or clarify");
    const comment = str(req.body?.comment, 10000, "Comment");
    if (decision !== "approve" && !comment) return bad(res, "Add a comment explaining the decision");

    const now = new Date();
    p.status = nextStatus(stage, decision);
    if (decision === "clarify") p.clarificationStage = stage;
    if (decision === "approve") p[stage === "lead" ? "leadReview" : "managerReview"] = { by: req.user.id, at: now };
    // A rejection restarts the approval from the Lead step, so an earlier Lead approval no longer counts.
    if (decision === "reject") p.leadReview = undefined;
    p.events.push(event(req, { kind: "review", stage, decision, body: comment, at: now }));
    if (p.status === "completed") {
      p.completedAt = now;
      p.events.push(event(req, { kind: "completed", at: new Date(now.getTime() + 1) }));
    }
    await p.save();
    await respond(req, res);
  }),
);

module.exports = router;
