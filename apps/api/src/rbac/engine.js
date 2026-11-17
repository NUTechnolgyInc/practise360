// Pure RBAC logic (no DB) — the single implementation of docs/rbac.md §5–§6.
// A "grant" is a resolved assignment: { scopeType, scopeId, permissions: [..] } (+ role info).
// `tree` is req.tree: { apps, practices, groups, memberships }. A bare practices array is still accepted (unit tests,
// and call sites that only ever check practice/app/platform scopes, which don't need groups).

const DEPTH = { platform: 0, app: 1, practice: 2, group: 3 };

const treeOf = (t) => (Array.isArray(t) ? { practices: t, groups: [], memberships: [] } : { practices: [], groups: [], memberships: [], ...t });

const sameScope = (a, b) => a.type === b.type && (a.id ?? null) === (b.id ?? null);
const PLATFORM = { type: "platform", id: null };

/**
 * practice:qa            -> [practice:qa, app:practices, platform]
 * group:qa-automation    -> [group:qa-automation, practice:qa, app:practices, platform]
 * An unknown group only chains to platform, so nothing below Super Admin reaches it (fails closed).
 */
function scopeChain(scope, tree) {
  const { practices, groups } = treeOf(tree);
  if (scope.type === "platform") return [PLATFORM];
  if (scope.type === "app") return [{ type: "app", id: scope.id }, PLATFORM];
  if (scope.type === "group") {
    const group = groups.find((g) => g._id === scope.id);
    if (!group) return [{ type: "group", id: scope.id }, PLATFORM];
    return [{ type: "group", id: scope.id }, ...scopeChain({ type: "practice", id: group.practiceId }, tree)];
  }
  const practice = practices.find((p) => p._id === scope.id);
  return [{ type: "practice", id: scope.id }, { type: "app", id: practice?.appId ?? "practices" }, PLATFORM];
}

const grantScope = (g) => ({ type: g.scopeType, id: g.scopeId ?? null });
const inChain = (g, chain) => chain.some((s) => sameScope(s, grantScope(g)));

/** A resource is "own" if the caller is its owner, or one of `ownerIds` (e.g. a contribution's owner + contributors). */
function ownsResource(resource, userId) {
  if (!resource) return false;
  if (resource.ownerIds) return resource.ownerIds.some((id) => String(id) === String(userId));
  return String(resource.ownerId) === String(userId);
}

/** Does this single grant carry `permission`? `:own` is satisfied only when the caller owns the resource. */
function grantHas(grant, permission, { userId, resource } = {}) {
  const perms = grant.permissions;
  if (perms.includes("*") || perms.includes(permission)) return true;
  if (!permission.endsWith(":own") && perms.includes(`${permission}:own`)) return ownsResource(resource, userId);
  return false;
}

/** can(user, permission, scope, resource?, tree) — user = { id, grants }. */
function can(user, permission, scope, resource, tree) {
  const chain = scopeChain(scope, tree);
  return user.grants.some((g) => inChain(g, chain) && grantHas(g, permission, { userId: user.id, resource }));
}

/** Holds `permission` at the practice itself or at any group inside it — e.g. a Lead "reaches" part of the practice. */
function canWithin(user, permission, practiceId, tree, resource) {
  const { groups } = treeOf(tree);
  if (can(user, permission, { type: "practice", id: practiceId }, resource, tree)) return true;
  return groups.some((g) => g.practiceId === practiceId && can(user, permission, { type: "group", id: g._id }, resource, tree));
}

/** The group a person sits in within a practice, or null. */
function groupOf(tree, practiceId, userId) {
  const m = treeOf(tree).memberships.find((x) => x.practiceId === practiceId && String(x.userId) === String(userId));
  return m ? m.groupId : null;
}

/**
 * The scope a member's work (contribution, cert plan) is checked at: their group in that practice, else the practice.
 * Resolved from current membership rather than stored, so moving someone hands their open work to the new Lead.
 */
function memberScope(tree, practiceId, userId) {
  const groupId = groupOf(tree, practiceId, userId);
  return groupId ? { type: "group", id: groupId } : { type: "practice", id: practiceId };
}

/** Holding exactly the permission (or `*`) at the scope — used by the escalation guard, where `:own` must match `:own`. */
function holdsExactly(user, permission, scope, tree) {
  const chain = scopeChain(scope, tree);
  return user.grants.some((g) => inChain(g, chain) && (g.permissions.includes("*") || g.permissions.includes(permission)));
}

const assignPermissionFor = (role) => (["practice", "group"].includes(role.scopeType) ? "practices.roles.assign" : "platform.apps.assign");

/** Escalation guard (rbac.md §5). Returns { ok, reason }. Used for both granting and revoking. */
function checkGrant(user, role, scope, tree) {
  const { practices, groups } = treeOf(tree);
  if (role.scopeType !== scope.type) return { ok: false, reason: `${role.name} can only be granted at ${role.scopeType} scope` };
  if (role.scopeId && role.scopeId !== scope.id) return { ok: false, reason: `${role.name} belongs to another scope` };
  if (scope.type === "practice" && !practices.some((p) => p._id === scope.id)) return { ok: false, reason: "Unknown practice" };
  if (scope.type === "group" && !groups.some((g) => g._id === scope.id)) return { ok: false, reason: "Unknown group" };

  const assignPerm = assignPermissionFor(role);
  const chain = scopeChain(scope, tree);
  const maxDepth = DEPTH[role.assignableFrom ?? role.scopeType];
  const hasAssign = user.grants.some(
    (g) => inChain(g, chain) && DEPTH[g.scopeType] <= maxDepth && (g.permissions.includes("*") || g.permissions.includes(assignPerm)),
  );
  if (!hasAssign) {
    return { ok: false, reason: `Needs ${assignPerm} here, granted at ${role.assignableFrom ?? role.scopeType} level or above` };
  }

  const missing = role.permissions.filter((p) => !holdsExactly(user, p, scope, tree));
  if (missing.length) return { ok: false, reason: `You don't hold: ${missing.join(", ")}` };
  return { ok: true };
}

/** "Digital Engineering · Fullstack" — groups are always shown with their practice. */
function groupLabel(group, practices) {
  const practice = practices.find((p) => p._id === group.practiceId);
  return `${practice?.name ?? group.practiceId} · ${group.name}`;
}

/** Every concrete scope in the tree. */
function allScopes(apps, practices, groups = []) {
  return [
    { type: "platform", id: null, label: "Platform" },
    ...apps.map((a) => ({ type: "app", id: a._id, label: a.name })),
    ...practices.map((p) => ({ type: "practice", id: p._id, label: p.name })),
    ...groups.filter((g) => practices.some((p) => p._id === g.practiceId)).map((g) => ({ type: "group", id: g._id, label: groupLabel(g, practices) })),
  ];
}

/** Scopes where the user holds `permission`, expanded down the tree. */
function scopesWith(user, permission, tree) {
  const { apps = [], practices, groups } = treeOf(tree);
  return allScopes(apps, practices, groups).filter((s) => can(user, permission, s, undefined, tree));
}

/** App visibility is derived: any permission in the app's namespace (rbac.md §1). */
function visibleApps(user, apps) {
  return apps.filter((app) => user.grants.some((g) => g.permissions.some((p) => p === "*" || p.startsWith(app.permPrefix))));
}

module.exports = {
  treeOf,
  scopeChain,
  can,
  canWithin,
  groupOf,
  memberScope,
  holdsExactly,
  checkGrant,
  groupLabel,
  allScopes,
  scopesWith,
  visibleApps,
  assignPermissionFor,
};
