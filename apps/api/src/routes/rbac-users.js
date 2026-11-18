const express = require("express");
const mongoose = require("mongoose");
const { Role, RoleAssignment, User } = require("../models");
const { can, checkGrant, allScopes } = require("../rbac/engine");
const { describeScope } = require("../rbac/present");
const { requireAnyScope } = require("../middleware/auth");
const structure = require("../lib/practice-structure");
const { cancelPending } = require("../lib/invites");
const { noteDetails } = require("../lib/audit");

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);
const scopeOf = (a) => ({ type: a.scopeType, id: a.scopeId ?? null });

/** Which of another user's assignments the viewer may see: members of scopes they can view, or everything for user admins. */
const VIEW_PERMS = ["practices.members.view", "platform.users.manage", "platform.apps.assign"];
const canSeeAssignment = (req, a) => VIEW_PERMS.some((p) => can(req.user, p, scopeOf(a), undefined, req.tree));

router.use(requireAnyScope("practices.members.view", "practices.roles.assign", "platform.users.manage", "platform.apps.assign"));

// The directory (names/usernames) is visible to every role manager so they can add people to their practice;
// assignments are filtered to the scopes the viewer can see.
router.get(
  "/users",
  wrap(async (req, res) => {
    const [users, assignments, roles] = await Promise.all([
      User.find({ isActive: true }).sort({ displayName: 1 }).lean(),
      RoleAssignment.find().lean(),
      Role.find().lean(),
    ]);
    const roleById = new Map(roles.map((r) => [r._id, r]));

    res.json(
      users.map((u) => ({
        id: String(u._id),
        username: u.username,
        displayName: u.displayName,
        email: u.email ?? "",
        assignments: assignments
          .filter((a) => String(a.userId) === String(u._id) && roleById.has(a.roleId) && canSeeAssignment(req, a))
          .map((a) => {
            const role = roleById.get(a.roleId);
            return {
              id: String(a._id),
              roleId: role._id,
              roleName: role.name,
              scopeType: a.scopeType,
              scopeId: a.scopeId,
              scopeLabel: describeScope(a, req.tree),
              canRevoke: checkGrant(req.user, role, scopeOf(a), req.tree).ok,
            };
          }),
      })),
    );
  }),
);

/** Roles × scopes the actor may grant — drives the role picker so it never offers something the API would reject. */
router.get(
  "/assignable",
  wrap(async (req, res) => {
    const roles = await Role.find().sort({ isSystem: -1, name: 1 }).lean();
    const scopes = allScopes(req.tree.apps, req.tree.practices, req.tree.groups);
    const options = roles
      .map((role) => ({
        roleId: role._id,
        roleName: role.name,
        scopes: scopes.filter((s) => checkGrant(req.user, role, s, req.tree).ok),
      }))
      .filter((o) => o.scopes.length);
    res.json(options);
  }),
);

router.post(
  "/assignments",
  wrap(async (req, res) => {
    const { userId, roleId, scopeType, scopeId = null } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: "Invalid user" });
    const [target, role] = await Promise.all([User.findById(userId).lean(), Role.findById(roleId).lean()]);
    if (!target || !target.isActive) return res.status(404).json({ error: "User not found" });
    if (!role) return res.status(404).json({ error: "Role not found" });

    const scope = { type: scopeType, id: scopeType === "platform" ? null : scopeId };
    const verdict = checkGrant(req.user, role, scope, req.tree);
    if (!verdict.ok) return res.status(403).json({ error: verdict.reason });
    // One Manager per practice, one Lead per group, Leads come from the practice (rbac.md §5).
    const clash = await structure.grantConflict(role, scope, userId, req.tree);
    if (clash) return res.status(clash.status).json({ error: clash.error });

    try {
      const a = await RoleAssignment.create({ userId, roleId, scopeType, scopeId: scope.id, grantedBy: req.user.id });
      await structure.afterGrant(role, scope, userId, req.user.id, req.tree);
      // Filling a Manager or Lead slot here voids an open invitation for it, which would otherwise replace them on accept.
      if (role._id === "practice_manager") await cancelPending({ practiceId: scope.id, kind: "manager" }, req.user.id, "Another Manager was chosen");
      if (role._id === "practice_lead") await cancelPending({ kind: "lead", groupId: scope.id }, req.user.id, "Another Lead was chosen");
      res.status(201).json({ id: String(a._id) });
    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: `${target.displayName} already has ${role.name} there` });
      throw err;
    }
  }),
);

router.delete(
  "/assignments/:id",
  wrap(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: "Assignment not found" });
    const a = await RoleAssignment.findById(req.params.id).lean();
    if (!a) return res.status(404).json({ error: "Assignment not found" });
    noteDetails(res, { userId: String(a.userId), roleId: a.roleId, scopeType: a.scopeType, scopeId: a.scopeId });
    const role = await Role.findById(a.roleId).lean();

    // Revoking is guarded like granting: a Manager can't remove another Manager.
    const verdict = role ? checkGrant(req.user, role, scopeOf(a), req.tree) : { ok: false, reason: "Unknown role" };
    if (!verdict.ok) return res.status(403).json({ error: verdict.reason });
    if (role.permissions.includes("*") && (await RoleAssignment.countDocuments({ roleId: role._id })) <= 1) {
      return res.status(409).json({ error: "Can't remove the last Super Admin" });
    }
    const clash = await structure.revokeConflict(a, req.tree);
    if (clash) return res.status(clash.status).json({ error: clash.error });
    await RoleAssignment.deleteOne({ _id: a._id });
    await structure.afterRevoke(a);
    res.status(204).end();
  }),
);

module.exports = router;
