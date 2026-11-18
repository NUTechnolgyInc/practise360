const crypto = require("crypto");
const express = require("express");
const { Permission, Role, RoleAssignment } = require("../models");
const { can, canWithin, holdsExactly } = require("../rbac/engine");
const { CUSTOM_ROLE_PERMISSIONS } = require("../rbac/catalog");
const { requireAnyScope } = require("../middleware/auth");
const { noteDetails } = require("../lib/audit");

const router = express.Router();
const practiceScope = (id) => ({ type: "practice", id });
const PLATFORM = { type: "platform", id: null };
// A role holding `*` (Super Admin) stays read-only: editing it could lock everyone out of the portal.
const isLockedSystemRole = (role) => role.permissions.includes("*");
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

router.get(
  "/catalog",
  requireAnyScope("practices.roles.view", "practices.roles.assign", "platform.apps.assign"),
  wrap(async (req, res) => {
    const permissions = await Permission.find().sort({ _id: 1 }).lean();
    res.json({
      permissions: permissions.map((p) => ({ key: p._id, appId: p.appId, description: p.description })),
      customRolePermissions: CUSTOM_ROLE_PERMISSIONS,
      apps: req.tree.apps.map((a) => ({ id: a._id, name: a.name })),
      practices: req.tree.practices.map((p) => ({ id: p._id, name: p.name })),
    });
  }),
);

/** System roles are visible to anyone who can view roles; custom roles only inside practices the viewer can see. */
router.get(
  "/roles",
  requireAnyScope("practices.roles.view", "practices.roles.assign", "platform.apps.assign"),
  wrap(async (req, res) => {
    const { user, tree } = req;
    const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();
    const counts = await RoleAssignment.aggregate([{ $group: { _id: "$roleId", n: { $sum: 1 } } }]);
    const countOf = new Map(counts.map((c) => [c._id, c.n]));

    const manageSystem = can(user, "platform.roles.manage", PLATFORM, undefined, tree.practices);
    // canWithin: a group Lead holds roles.view on their group, and reads the roles of the practice it belongs to.
    const visible = roles.filter((r) => r.isSystem || canWithin(user, "practices.roles.view", r.scopeId, tree));
    res.json(
      visible.map((r) => ({
        id: r._id,
        name: r.name,
        description: r.description,
        scopeType: r.scopeType,
        scopeId: r.scopeId,
        isSystem: r.isSystem,
        assignableFrom: r.assignableFrom,
        permissions: r.permissions,
        assignmentCount: countOf.get(r._id) ?? 0,
        canManage: r.isSystem
          ? manageSystem && !isLockedSystemRole(r)
          : can(user, "practices.roles.manage", practiceScope(r.scopeId), undefined, tree.practices),
      })),
    );
  }),
);

/** Validates a custom-role body; returns an error string or null. The actor can't put permissions in a role they don't hold. */
function validateCustomRole(req, { name, practiceId, permissions }) {
  const { user, tree } = req;
  if (!name || !String(name).trim()) return "Name is required";
  if (!tree.practices.some((p) => p._id === practiceId)) return "Pick a practice";
  if (!can(user, "practices.roles.manage", practiceScope(practiceId), undefined, tree.practices)) return "FORBIDDEN";
  if (!Array.isArray(permissions) || permissions.length === 0) return "Pick at least one permission";
  const outside = permissions.filter((p) => !CUSTOM_ROLE_PERMISSIONS.includes(p));
  if (outside.length) return `Not allowed in a custom role: ${outside.join(", ")}`;
  const notHeld = permissions.filter((p) => !holdsExactly(user, p, practiceScope(practiceId), tree.practices));
  if (notHeld.length) return `You don't hold: ${notHeld.join(", ")}`;
  return null;
}

const sendValidation = (res, error) => res.status(error === "FORBIDDEN" ? 403 : 400).json({ error: error === "FORBIDDEN" ? "Missing permission practices.roles.manage" : error });

router.post(
  "/roles",
  wrap(async (req, res) => {
    const { name, description = "", practiceId, permissions } = req.body || {};
    const error = validateCustomRole(req, { name, practiceId, permissions });
    if (error) return sendValidation(res, error);
    const role = await Role.create({
      _id: `custom_${crypto.randomUUID().slice(0, 8)}`,
      name: String(name).trim(),
      description,
      scopeType: "practice",
      scopeId: practiceId,
      isSystem: false,
      assignableFrom: "practice",
      permissions: [...new Set(permissions)],
      createdBy: req.user.id,
    });
    res.status(201).json({ id: role._id });
  }),
);

/** Validates a system-role edit; returns an error string or null. Scope and assignableFrom stay fixed. */
async function validateSystemRole(req, role, { name, permissions }) {
  if (!can(req.user, "platform.roles.manage", PLATFORM, undefined, req.tree.practices)) return "FORBIDDEN_SYSTEM";
  if (isLockedSystemRole(role)) return `${role.name} can't be edited`;
  if (!name || !String(name).trim()) return "Name is required";
  if (!Array.isArray(permissions) || permissions.length === 0) return "Pick at least one permission";
  const known = new Set((await Permission.find().select("_id").lean()).map((p) => p._id));
  const unknown = permissions.filter((p) => !known.has(p));
  if (unknown.length) return `Unknown permission: ${unknown.join(", ")}`;
  // platform.* only means something at platform scope; on an app/practice role it would be dead weight.
  if (role.scopeType !== "platform") {
    const platformOnly = permissions.filter((p) => p.startsWith("platform."));
    if (platformOnly.length) return `Only platform roles can hold: ${platformOnly.join(", ")}`;
  }
  return null;
}

router.patch(
  "/roles/:id",
  wrap(async (req, res) => {
    const role = await Role.findById(req.params.id).lean();
    if (!role) return res.status(404).json({ error: "Role not found" });
    const body = { name: req.body?.name ?? role.name, practiceId: role.scopeId, permissions: req.body?.permissions ?? role.permissions };
    if (role.isSystem) {
      const error = await validateSystemRole(req, role, body);
      if (error === "FORBIDDEN_SYSTEM") return res.status(403).json({ error: "Missing permission platform.roles.manage" });
      if (error) return res.status(400).json({ error });
    } else {
      const error = validateCustomRole(req, body);
      if (error) return sendValidation(res, error);
    }
    await Role.updateOne(
      { _id: role._id },
      { name: String(body.name).trim(), description: req.body?.description ?? role.description, permissions: [...new Set(body.permissions)] },
    );
    res.json({ id: role._id });
  }),
);

router.delete(
  "/roles/:id",
  wrap(async (req, res) => {
    const role = await Role.findById(req.params.id).lean();
    if (!role) return res.status(404).json({ error: "Role not found" });
    noteDetails(res, { name: role.name, practiceId: role.scopeId });
    if (role.isSystem) return res.status(400).json({ error: "System roles can't be deleted" });
    if (!can(req.user, "practices.roles.manage", practiceScope(role.scopeId), undefined, req.tree.practices)) {
      return res.status(403).json({ error: "Missing permission practices.roles.manage" });
    }
    const inUse = await RoleAssignment.countDocuments({ roleId: role._id });
    if (inUse) return res.status(409).json({ error: `Role is assigned to ${inUse} user(s) — revoke those first` });
    await Role.deleteOne({ _id: role._id });
    res.status(204).end();
  }),
);

module.exports = router;
