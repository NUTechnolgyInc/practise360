// Client mirror of the API's can() (docs/rbac.md §6). Used ONLY to hide/show UI — the API is the security boundary.

function scopeChain(scope, practices) {
  if (scope.type === "platform") return [{ type: "platform", id: null }];
  if (scope.type === "app") return [{ type: "app", id: scope.id }, { type: "platform", id: null }];
  const appId = practices.find((p) => p.id === scope.id)?.appId ?? "practices";
  return [{ type: "practice", id: scope.id }, { type: "app", id: appId }, { type: "platform", id: null }];
}

export function can(me, permission, scope, resource) {
  if (!me) return false;
  const chain = scopeChain(scope, me.practices);
  return me.grants.some((g) => {
    if (!chain.some((s) => s.type === g.scopeType && (s.id ?? null) === (g.scopeId ?? null))) return false;
    const perms = g.permissions;
    if (perms.includes("*") || perms.includes(permission)) return true;
    return perms.includes(`${permission}:own`) && !!resource && String(resource.ownerId) === String(me.id);
  });
}

/** Holds `permission` at any scope — for deciding whether to show a whole section (e.g. Access control). */
export function canAnywhere(me, ...permissions) {
  return !!me?.grants.some((g) => g.permissions.includes("*") || permissions.some((p) => g.permissions.includes(p)));
}

export const RBAC_PORTAL_PERMS = ["practices.roles.view", "practices.roles.assign", "platform.apps.assign"];
