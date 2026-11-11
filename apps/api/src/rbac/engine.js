// Pure RBAC logic (no DB) — the single implementation of docs/rbac.md §5–§6.
// A "grant" is a resolved assignment: { scopeType, scopeId, permissions: [..] } (+ role info).

const DEPTH = { platform: 0, app: 1, practice: 2 };

const sameScope = (a, b) => a.type === b.type && (a.id ?? null) === (b.id ?? null);

/** practice:qa -> [practice:qa, app:practices, platform] */
function scopeChain(scope, practices = []) {
  if (scope.type === "platform") return [{ type: "platform", id: null }];
  if (scope.type === "app") return [{ type: "app", id: scope.id }, { type: "platform", id: null }];
  const practice = practices.find((p) => p._id === scope.id);
  return [{ type: "practice", id: scope.id }, { type: "app", id: practice?.appId ?? "practices" }, { type: "platform", id: null }];
}

const grantScope = (g) => ({ type: g.scopeType, id: g.scopeId ?? null });
const inChain = (g, chain) => chain.some((s) => sameScope(s, grantScope(g)));

/** Does this single grant carry `permission`? `:own` is satisfied only when the caller owns the resource. */
function grantHas(grant, permission, { userId, resource } = {}) {
  const perms = grant.permissions;
  if (perms.includes("*") || perms.includes(permission)) return true;
  if (!permission.endsWith(":own") && perms.includes(`${permission}:own`)) {
    return !!resource && String(resource.ownerId) === String(userId);
  }
  return false;
}

/** can(user, permission, scope, resource?) — user = { id, grants }. */
function can(user, permission, scope, resource, practices) {
  const chain = scopeChain(scope, practices);
  return user.grants.some((g) => inChain(g, chain) && grantHas(g, permission, { userId: user.id, resource }));
}

/** Holding exactly the permission (or `*`) at the scope — used by the escalation guard, where `:own` must match `:own`. */
function holdsExactly(user, permission, scope, practices) {
  const chain = scopeChain(scope, practices);
  return user.grants.some((g) => inChain(g, chain) && (g.permissions.includes("*") || g.permissions.includes(permission)));
}

const assignPermissionFor = (role) => (role.scopeType === "practice" ? "practices.roles.assign" : "platform.apps.assign");

/** Escalation guard (rbac.md §5). Returns { ok, reason }. Used for both granting and revoking. */
function checkGrant(user, role, scope, practices) {
  if (role.scopeType !== scope.type) return { ok: false, reason: `${role.name} can only be granted at ${role.scopeType} scope` };
  if (role.scopeId && role.scopeId !== scope.id) return { ok: false, reason: `${role.name} belongs to another scope` };
  if (scope.type === "practice" && !practices.some((p) => p._id === scope.id)) return { ok: false, reason: "Unknown practice" };

  const assignPerm = assignPermissionFor(role);
  const chain = scopeChain(scope, practices);
  const maxDepth = DEPTH[role.assignableFrom ?? role.scopeType];
  const hasAssign = user.grants.some(
    (g) => inChain(g, chain) && DEPTH[g.scopeType] <= maxDepth && (g.permissions.includes("*") || g.permissions.includes(assignPerm)),
  );
  if (!hasAssign) {
    return { ok: false, reason: `Needs ${assignPerm} here, granted at ${role.assignableFrom ?? role.scopeType} level or above` };
  }

  const missing = role.permissions.filter((p) => !holdsExactly(user, p, scope, practices));
  if (missing.length) return { ok: false, reason: `You don't hold: ${missing.join(", ")}` };
  return { ok: true };
}

/** Every concrete scope in the tree. */
function allScopes(apps, practices) {
  return [
    { type: "platform", id: null, label: "Platform" },
    ...apps.map((a) => ({ type: "app", id: a._id, label: a.name })),
    ...practices.map((p) => ({ type: "practice", id: p._id, label: p.name })),
  ];
}

/** Scopes where the user holds `permission`, expanded down the tree. */
function scopesWith(user, permission, apps, practices) {
  return allScopes(apps, practices).filter((s) => can(user, permission, s, undefined, practices));
}

/** App visibility is derived: any permission in the app's namespace (rbac.md §1). */
function visibleApps(user, apps) {
  return apps.filter((app) => user.grants.some((g) => g.permissions.some((p) => p === "*" || p.startsWith(app.permPrefix))));
}

module.exports = { scopeChain, can, holdsExactly, checkGrant, allScopes, scopesWith, visibleApps, assignPermissionFor };
