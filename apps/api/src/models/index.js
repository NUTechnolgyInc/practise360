const mongoose = require("mongoose");

const { Schema, model } = mongoose;
const SCOPE_TYPES = ["platform", "app", "practice"];

// Users carry no password: auth (dev login today, SSO later) only resolves a userId.
const User = model(
  "User",
  new Schema(
    {
      username: { type: String, required: true, unique: true, lowercase: true, trim: true },
      displayName: { type: String, required: true },
      email: String,
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true },
  ),
);

const App = model("App", new Schema({ _id: String, name: String, permPrefix: String }));

const Practice = model(
  "Practice",
  new Schema({ _id: String, appId: { type: String, default: "practices" }, name: String, isArchived: { type: Boolean, default: false } }),
);

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

module.exports = { User, App, Practice, Permission, Role, RoleAssignment, UsageReport, SCOPE_TYPES };
