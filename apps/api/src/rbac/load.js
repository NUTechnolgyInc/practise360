const { App, CacheVersion, Group, GroupMembership, Practice, Role, RoleAssignment, TREE_VERSION_ID, User, treeChangeListeners } = require("../models");
const { createVersionedCache } = require("../lib/versioned-cache");
const mongoose = require("mongoose");

/**
 * Apps, practices, groups and group memberships — small collections. Memberships are here because they decide whose
 * Lead reaches someone's work. Read fresh by readTree; callers go through the cached loadTree below.
 */
async function readTree() {
  const [apps, practices, groups, memberships] = await Promise.all([
    App.find().lean(),
    Practice.find({ isArchived: false }).lean(),
    Group.find().sort({ name: 1 }).lean(),
    GroupMembership.find({}, "practiceId groupId userId").lean(),
  ]);
  const active = new Set(practices.map((p) => p._id));
  return {
    apps,
    practices,
    groups: groups.filter((g) => active.has(g.practiceId)),
    memberships: memberships.filter((m) => active.has(m.practiceId)).map((m) => ({ practiceId: m.practiceId, groupId: m.groupId, userId: String(m.userId) })),
  };
}

/** The tree's change stamp (models/index.js bumps it on every write). A fresh DB gets one on first read. */
async function readTreeToken() {
  const doc = await CacheVersion.findById(TREE_VERSION_ID).lean();
  if (doc) return doc.token;
  const created = await CacheVersion.findOneAndUpdate(
    { _id: TREE_VERSION_ID },
    { $setOnInsert: { token: new mongoose.Types.ObjectId().toString() } },
    { upsert: true, returnDocument: "after", lean: true },
  );
  return created.token;
}

// One copy per API instance, reused until the stamp changes — every request still reads the stamp, so archives, new
// groups and moves between groups apply at once on every instance. Costs 1 query per request instead of 4.
// The tree is shared between requests: treat it as read-only.
const treeCache = createVersionedCache({ readToken: readTreeToken, load: readTree });
treeChangeListeners.add(treeCache.invalidate);
const loadTree = () => treeCache.get();

/**
 * Resolve a user's assignments into grants. Read from the DB on every request (not baked into the
 * JWT) so a revoked role stops working at once. An assignment whose scope type no longer matches its role's
 * (e.g. a practice-wide Lead from before Leads moved to groups) grants nothing.
 */
async function loadGrants(userId) {
  const assignments = await RoleAssignment.find({ userId }).lean();
  const roles = await Role.find({ _id: { $in: assignments.map((a) => a.roleId) } }).lean();
  const byId = new Map(roles.map((r) => [r._id, r]));
  return assignments
    .filter((a) => byId.has(a.roleId) && byId.get(a.roleId).scopeType === a.scopeType)
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

module.exports = { loadTree, readTree, loadGrants, loadUser };
