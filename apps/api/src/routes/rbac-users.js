const express = require("express");
const mongoose = require("mongoose");
const { Role, RoleAssignment, User } = require("../models");
const { can, checkGrant, allScopes } = require("../rbac/engine");
const { describeScope } = require("../rbac/present");
const { requireAnyScope } = require("../middleware/auth");
const structure = require("../lib/practice-structure");
const { cancelPending, normalizeEmail } = require("../lib/invites");
const { addByEmailRefusal, notifyAccess } = require("../lib/add-by-email");
const { findOrCreateByEmail } = require("../lib/accounts");
const { isGoogleEnabled } = require("../lib/google-auth");
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

/**
 * Grants `role` at `scope` to `target` after the escalation guard and the Manager/Lead slot rules (rbac.md §5).
 * Shared by "Grant a role" and "Add by email" so both enforce exactly the same thing.
 * Returns { id } or { status, error }.
 */
async function grantRole(req, target, role, scope) {
  const verdict = checkGrant(req.user, role, scope, req.tree);
  if (!verdict.ok) return { status: 403, error: verdict.reason };
  // One Manager per practice, one Lead per group, Leads come from the practice (rbac.md §5).
  const clash = await structure.grantConflict(role, scope, target._id, req.tree);
  if (clash) return clash;
  try {
    const a = await RoleAssignment.create({ userId: target._id, roleId: role._id, scopeType: scope.type, scopeId: scope.id, grantedBy: req.user.id });
    await structure.afterGrant(role, scope, target._id, req.user.id, req.tree);
    // Filling a Manager or Lead slot here voids an open invitation for it, which would otherwise replace them on accept.
    if (role._id === "practice_manager") await cancelPending({ practiceId: scope.id, kind: "manager" }, req.user.id, "Another Manager was chosen");
    if (role._id === "practice_lead") await cancelPending({ kind: "lead", groupId: scope.id }, req.user.id, "Another Lead was chosen");
    return { id: String(a._id) };
  } catch (err) {
    if (err.code === 11000) return { status: 409, error: `${target.displayName} already has ${role.name} there` };
    throw err;
  }
}

router.post(
  "/assignments",
  wrap(async (req, res) => {
    const { userId, roleId, scopeType, scopeId = null } = req.body || {};
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ error: "Invalid user" });
    const [target, role] = await Promise.all([User.findById(userId).lean(), Role.findById(roleId).lean()]);
    if (!target || !target.isActive) return res.status(404).json({ error: "User not found" });
    if (!role) return res.status(404).json({ error: "Role not found" });

    const scope = { type: scopeType, id: scopeType === "platform" ? null : scopeId };
    const result = await grantRole(req, target, role, scope);
    if (result.error) return res.status(result.status).json({ error: result.error });
    res.status(201).json({ id: result.id });
  }),
);

/**
 * Add someone by email with a role (rbac.md §4 "Adding someone by email"). Every check runs before the account
 * exists, so a refused request never leaves an empty account behind. An email that already has an account just gets
 * the role, as if they'd been picked from the list.
 */
router.post(
  "/users",
  wrap(async (req, res) => {
    const b = req.body || {};
    const email = normalizeEmail(b.email);
    const scope = { type: b.scopeType, id: b.scopeType === "platform" ? null : b.scopeId ?? null };
    const role = typeof b.roleId === "string" ? await Role.findById(b.roleId).lean() : null;
    const refusal = addByEmailRefusal({ actor: req.user, email, role, scope, tree: req.tree });
    if (refusal) return res.status(refusal.status).json({ error: refusal.error });

    const existing = await User.findOne({ email }).lean();
    if (existing && !existing.isActive) return res.status(409).json({ error: `${email} belongs to a deactivated account` });
    if (!existing) {
      // A brand-new account has no assignments, so the slot and practice-membership checks can run against it now.
      const clash = await structure.grantConflict(role, scope, null, req.tree);
      if (clash) return res.status(clash.status).json({ error: clash.error });
    }

    const displayName = typeof b.displayName === "string" ? b.displayName.trim().slice(0, 80) : "";
    // Google-only when Google sign-in is on, so the shared demo password can't claim the address (as for contribution owners).
    const { user, created } = existing ? { user: existing, created: false } : await findOrCreateByEmail(email, displayName, { googleOnly: isGoogleEnabled() });
    const result = await grantRole(req, user, role, scope);
    if (result.error) return res.status(result.status).json({ error: result.error });
    const delivery = created ? await notifyAccess({ email, inviterName: req.user.displayName, role, scope, tree: req.tree }) : null;
    res.status(201).json({ userId: String(user._id), assignmentId: result.id, created, displayName: user.displayName, delivery });
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
