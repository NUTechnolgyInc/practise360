const { App, Practice, Role, RoleAssignment, User } = require("../models");

/** Apps + practices — tiny collections, read per request so archives/additions apply immediately. */
async function loadTree() {
  const [apps, practices] = await Promise.all([App.find().lean(), Practice.find({ isArchived: false }).lean()]);
  return { apps, practices };
}

/**
 * Resolve a user's assignments into grants. Read from the DB on every request (not baked into the
 * JWT) so a revoked role stops working at once.
 */
async function loadGrants(userId) {
  const assignments = await RoleAssignment.find({ userId }).lean();
  const roles = await Role.find({ _id: { $in: assignments.map((a) => a.roleId) } }).lean();
  const byId = new Map(roles.map((r) => [r._id, r]));
  return assignments
    .filter((a) => byId.has(a.roleId))
    .map((a) => {
      const role = byId.get(a.roleId);
      return { _id: a._id, roleId: role._id, roleName: role.name, scopeType: a.scopeType, scopeId: a.scopeId, permissions: role.permissions };
    });
}

async function loadUser(userId) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  return { id: String(user._id), username: user.username, displayName: user.displayName, isActive: user.isActive, grants: await loadGrants(user._id) };
}

module.exports = { loadTree, loadGrants, loadUser };
