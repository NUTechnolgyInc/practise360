const mongoose = require("mongoose");

const { Schema, model } = mongoose;
const SCOPE_TYPES = ["platform", "app", "practice", "group"];

// Users carry no password: auth (dev login today, SSO later) only resolves a userId.
const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    displayName: { type: String, required: true },
    email: { type: String, lowercase: true, trim: true },
    isActive: { type: Boolean, default: true },
    // Real people on the demo deployment: Google sign-in only, so the shared demo password can't open their account.
    googleOnly: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// Email is a login name (dev login) and how invitations recognise people who already have an account, so it must be
// unique — but only when set: older seeded users have none.
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
const User = model("User", userSchema);

// Someone invited into a practice by email before they have an account (docs/rbac.md §4 "Invitations"). Accepting
// creates the account and applies what `kind` says. Only a SHA-256 of the link's token is stored, so reading the DB
// doesn't give anyone a working link.
const INVITE_KINDS = ["member", "manager", "lead"];
const INVITE_STATUSES = ["pending", "accepted", "cancelled"];
const invitationSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    kind: { type: String, enum: INVITE_KINDS, required: true },
    practiceId: { type: String, required: true, index: true },
    groupId: { type: String, default: null }, // lead: the group they'll lead; member: optional group to join
    keepPrevious: { type: Boolean, default: true }, // manager: the replaced Manager stays on as a Practitioner
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: INVITE_STATUSES, default: "pending" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    delivery: {
      status: { type: String, enum: ["sent", "logged", "failed"] },
      error: String,
      at: Date,
    },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
    acceptedAt: Date,
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: Date,
    cancelReason: String,
  },
  { timestamps: true },
);
invitationSchema.index({ email: 1, status: 1 });
const Invitation = model("Invitation", invitationSchema, "invitations");

const App = model("App", new Schema({ _id: String, name: String, permPrefix: String }));

const Practice = model(
  "Practice",
  new Schema(
    {
      _id: String,
      appId: { type: String, default: "practices" },
      name: { type: String, required: true, trim: true, maxlength: 80 },
      description: { type: String, trim: true, maxlength: 500, default: "" },
      isArchived: { type: Boolean, default: false },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
);

// Groups inside a practice (docs/rbac.md §4 "Practices and groups"). The id is a slug fixed at creation, because
// it's the scopeId of the Lead's role assignment — renaming only changes `name`.
const Group = model(
  "Group",
  new Schema(
    {
      _id: String,
      practiceId: { type: String, required: true, index: true },
      name: { type: String, required: true, trim: true, maxlength: 80 },
      description: { type: String, trim: true, maxlength: 500, default: "" },
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
  "practice_groups",
);

// Which group a practice member sits in — at most one per practice, hence the unique (practiceId, userId).
// Kept apart from role assignments: membership decides whose Lead reviews someone's work, it grants nothing itself.
const groupMembershipSchema = new Schema({
  practiceId: { type: String, required: true },
  groupId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  addedBy: { type: Schema.Types.ObjectId, ref: "User" },
  addedAt: { type: Date, default: Date.now },
});
groupMembershipSchema.index({ practiceId: 1, userId: 1 }, { unique: true });
const GroupMembership = model("GroupMembership", groupMembershipSchema, "group_memberships");

// A practice's Overview page: key information (Markdown) its Manager or Practices Admin keeps up to date.
// Kept off the Practice document because the practice list is loaded on every request (rbac/load.js).
const PracticeOverview = model(
  "PracticeOverview",
  new Schema(
    {
      _id: String, // practice id
      body: { type: String, default: "", maxlength: 50000 }, // Markdown
      updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
  "practice_overviews",
);

// A group's Overview — same shape as the practice's, kept up to date by the group's Lead (or Manager, Practices Admin).
const GroupOverview = model(
  "GroupOverview",
  new Schema(
    {
      _id: String, // group id
      body: { type: String, default: "", maxlength: 50000 }, // Markdown
      updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
  "group_overviews",
);

// Files on a practice's or a group's Overview (≤ 4 MB, Vercel's body cap) — bytes are select:false so listings stay
// light. `groupId` is set for a group's files; a practice's own files have none (null and missing both match null).
const practiceFileSchema = new Schema(
  {
    practiceId: { type: String, required: true },
    groupId: { type: String, default: null },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fileName: { type: String, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
  },
  { timestamps: true },
);
practiceFileSchema.index({ practiceId: 1, groupId: 1 });
const PracticeFile = model("PracticeFile", practiceFileSchema, "practice_files");

const Permission = model("Permission", new Schema({ _id: String, appId: String, description: String }));

// Permissions are embedded (no role_permissions join collection) — a role is always read with its permissions.
const Role = model(
  "Role",
  new Schema(
    {
      _id: String,
      name: { type: String, required: true },
      description: String,
      scopeType: { type: String, enum: SCOPE_TYPES, required: true },
      scopeId: { type: String, default: null }, // set on app roles and on custom roles (owning practice)
      isSystem: { type: Boolean, default: false },
      assignableFrom: { type: String, enum: SCOPE_TYPES, default: "practice" },
      permissions: [String],
      createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true },
  ),
);

const assignmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  roleId: { type: String, ref: "Role", required: true },
  scopeType: { type: String, enum: SCOPE_TYPES, required: true },
  scopeId: { type: String, default: null },
  grantedBy: { type: Schema.Types.ObjectId, ref: "User" },
  grantedAt: { type: Date, default: Date.now },
});
assignmentSchema.index({ userId: 1, roleId: 1, scopeType: 1, scopeId: 1 }, { unique: true });
const RoleAssignment = model("RoleAssignment", assignmentSchema, "role_assignments");

// AI Tracker — one Claude usage report (PDF) per user per month. The PDF bytes live on the document
// (≤ 4 MB, well under Mongo's 16 MB cap) with select:false so listings never load them.
const usageReportSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // YYYY-MM
    fileName: { type: String, required: true },
    size: { type: Number, required: true },
    pdf: { type: Buffer, required: true, select: false },
  },
  { timestamps: true },
);
usageReportSchema.index({ userId: 1, period: 1 }, { unique: true });
const UsageReport = model("UsageReport", usageReportSchema, "usage_reports");

// Practices → Contributions: work a practitioner starts inside a practice (framework, tool, case study, blog…),
// reviewed by a Lead then a Manager before it's published. The timeline is embedded — it's read with the
// contribution every time and stays small (tens of entries).
const CONTRIBUTION_TYPES = ["framework", "automation", "client_win", "case_study", "blog", "other"];
const CONTRIBUTION_STATUSES = ["in_progress", "lead_review", "manager_review", "clarification", "published", "declined"];
const EVENT_KINDS = ["created", "progress", "member", "submitted", "review", "published"];
const { ObjectId } = Schema.Types;

const contributionEventSchema = new Schema(
  {
    kind: { type: String, enum: EVENT_KINDS, required: true },
    authorId: { type: ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now },
    body: { type: String, default: "" }, // Markdown
    fileIds: [{ type: ObjectId, ref: "ContributionFile" }],
    // review: stage + decision; member: action + subject user
    stage: { type: String, enum: ["lead", "manager"] },
    decision: { type: String, enum: ["approve", "decline", "clarify"] },
    action: { type: String, enum: ["invited", "requested", "joined", "declined_invite", "rejected_request", "removed", "left"] },
    subjectId: { type: ObjectId, ref: "User" },
  },
  { _id: true },
);

const linkSchema = new Schema({ label: String, url: String }, { _id: false });

const contributionSchema = new Schema(
  {
    practiceId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: CONTRIBUTION_TYPES, required: true },
    customType: { type: String, trim: true, maxlength: 60 }, // only for type "other"
    description: { type: String, default: "", maxlength: 200000 }, // Markdown
    ownerId: { type: ObjectId, ref: "User", required: true },
    // Who created it. Differs from ownerId when a Lead/Manager/Practices Admin added it on a member's behalf;
    // missing on older records, which were always created by their owner.
    createdBy: { type: ObjectId, ref: "User" },
    contributorIds: [{ type: ObjectId, ref: "User" }],
    invites: [{ userId: { type: ObjectId, ref: "User" }, by: { type: ObjectId, ref: "User" }, at: { type: Date, default: Date.now }, _id: false }],
    joinRequests: [{ userId: { type: ObjectId, ref: "User" }, message: String, at: { type: Date, default: Date.now }, _id: false }],
    startDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: CONTRIBUTION_STATUSES, default: "in_progress", index: true },
    clarificationStage: { type: String, enum: ["lead", "manager"] }, // which reviewer asked; resubmitting returns there
    submission: {
      summary: String,
      impact: String,
      repoUrl: String,
      demoUrl: String,
      links: [linkSchema],
      fileIds: [{ type: ObjectId, ref: "ContributionFile" }],
      submittedAt: Date,
    },
    leadReview: { by: { type: ObjectId, ref: "User" }, at: Date },
    managerReview: { by: { type: ObjectId, ref: "User" }, at: Date },
    publishedAt: Date,
    events: [contributionEventSchema],
  },
  { timestamps: true },
);
const Contribution = model("Contribution", contributionSchema, "contributions");

// Attachments (≤ 4 MB, Vercel's body cap) — bytes are select:false so metadata lists stay light.
const ContributionFile = model(
  "ContributionFile",
  new Schema(
    {
      contributionId: { type: ObjectId, ref: "Contribution", required: true, index: true },
      uploadedBy: { type: ObjectId, ref: "User", required: true },
      fileName: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true },
      data: { type: Buffer, required: true, select: false },
    },
    { timestamps: true },
  ),
  "contribution_files",
);

// Certification Tracker — a shared catalog, per-member plans and their files (docs/rbac.md §4 "Certification Tracker").
const CERT_TYPES = ["certification", "course"];
const CERT_SOURCES = ["self", "suggested", "assigned"];
const CERT_STATUSES = ["suggested", "planned", "lead_review", "manager_review", "clarification", "completed", "declined", "dropped"];
const CERT_EVENT_KINDS = ["created", "suggested", "assigned", "accepted", "declined", "updated", "submitted", "review", "completed", "dropped", "withdrawn"];
const CURRENCIES = ["INR", "USD"];

const certCatalogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    // Lower-cased "title|provider" — the unique key that stops the same cert being listed twice.
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: CERT_TYPES, required: true },
    provider: { type: String, trim: true, maxlength: 80, default: "" },
    url: { type: String, trim: true, maxlength: 500, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: ObjectId, ref: "User" },
  },
  { timestamps: true },
);
const CertCatalogItem = model("CertCatalogItem", certCatalogSchema, "cert_catalog");

const certEventSchema = new Schema(
  {
    kind: { type: String, enum: CERT_EVENT_KINDS, required: true },
    authorId: { type: ObjectId, ref: "User", required: true },
    at: { type: Date, default: Date.now },
    body: { type: String, default: "" }, // Markdown
    fileIds: [{ type: ObjectId, ref: "CertFile" }],
    stage: { type: String, enum: ["lead", "manager"] },
    decision: { type: String, enum: ["approve", "reject", "clarify"] },
  },
  { _id: true },
);

const certPlanSchema = new Schema(
  {
    practiceId: { type: String, required: true, index: true },
    ownerId: { type: ObjectId, ref: "User", required: true, index: true },
    catalogId: { type: ObjectId, ref: "CertCatalogItem", default: null }, // null = one-off cert the owner typed in
    // Snapshot of the cert when the plan was made, so editing or retiring the catalog entry doesn't rewrite history.
    cert: {
      title: { type: String, required: true },
      type: { type: String, enum: CERT_TYPES, required: true },
      provider: { type: String, default: "" },
      url: { type: String, default: "" },
    },
    source: { type: String, enum: CERT_SOURCES, required: true },
    createdBy: { type: ObjectId, ref: "User", required: true },
    startDate: Date, // optional only while suggested
    dueDate: Date,
    notes: { type: String, default: "", maxlength: 5000 },
    status: { type: String, enum: CERT_STATUSES, required: true, index: true },
    clarificationStage: { type: String, enum: ["lead", "manager"] },
    completion: {
      completedOn: Date,
      verificationUrl: String,
      credentialId: String,
      expiresOn: Date,
      certificateFileIds: [{ type: ObjectId, ref: "CertFile" }],
      reimbursement: {
        amount: Number,
        currency: { type: String, enum: CURRENCIES },
        receiptFileIds: [{ type: ObjectId, ref: "CertFile" }],
      },
      submittedAt: Date,
    },
    leadReview: { by: { type: ObjectId, ref: "User" }, at: Date },
    managerReview: { by: { type: ObjectId, ref: "User" }, at: Date },
    completedAt: Date,
    events: [certEventSchema],
  },
  { timestamps: true },
);
const CertPlan = model("CertPlan", certPlanSchema, "cert_plans");

// Certificates and receipts (PDF or image, ≤ 4 MB) — bytes are select:false so metadata lists stay light.
const CertFile = model(
  "CertFile",
  new Schema(
    {
      planId: { type: ObjectId, ref: "CertPlan", required: true, index: true },
      kind: { type: String, enum: ["certificate", "receipt"], required: true },
      uploadedBy: { type: ObjectId, ref: "User", required: true },
      fileName: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true },
      data: { type: Buffer, required: true, select: false },
    },
    { timestamps: true },
  ),
  "cert_files",
);

// Audit log (docs/rbac.md §4 "Audit log"): one append-only entry per write request and sign-in, recorded by
// lib/audit.js. Actor names are copied in so an entry still reads right after the person is renamed or removed.
// Nothing in the API updates or deletes entries.
const AUDIT_OUTCOMES = ["success", "denied", "failed"];
const auditLogSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: ObjectId, ref: "User", default: null },
    actorName: { type: String, default: null },
    actorUsername: { type: String, default: null },
    action: { type: String, required: true }, // e.g. "practices.member.add"
    label: { type: String, required: true },
    category: { type: String, required: true },
    method: { type: String, required: true },
    route: { type: String, required: true }, // the route pattern, never the raw URL (invite links carry a token)
    params: { type: Schema.Types.Mixed, default: {} },
    details: { type: Schema.Types.Mixed, default: {} }, // request body with secrets and file bytes removed
    resultId: { type: String, default: null }, // id of what a create returned
    status: { type: Number, required: true },
    outcome: { type: String, enum: AUDIT_OUTCOMES, required: true },
    error: { type: String, default: null },
    ip: String,
    userAgent: String,
  },
  { versionKey: false },
);
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ category: 1, at: -1 });
const AuditLog = model("AuditLog", auditLogSchema, "audit_logs");

module.exports = {
  AuditLog,
  AUDIT_OUTCOMES,
  CertCatalogItem,
  CertPlan,
  CertFile,
  CERT_TYPES,
  CERT_SOURCES,
  CERT_STATUSES,
  CURRENCIES,
  User,
  Invitation,
  INVITE_KINDS,
  App,
  Practice,
  Group,
  GroupMembership,
  PracticeOverview,
  GroupOverview,
  PracticeFile,
  Permission,
  Role,
  RoleAssignment,
  UsageReport,
  Contribution,
  ContributionFile,
  SCOPE_TYPES,
  CONTRIBUTION_TYPES,
  CONTRIBUTION_STATUSES,
};
