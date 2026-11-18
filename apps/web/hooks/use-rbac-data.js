"use client";

import { useCallback } from "react";
import { useResource } from "./use-resource";

/** Everything the Access control portal needs, reloaded together after each mutation so counts and guards stay in sync. */
export function useRbacData() {
  const users = useResource("/rbac/users");
  const roles = useResource("/rbac/roles");
  const catalog = useResource("/rbac/catalog");
  const assignable = useResource("/rbac/assignable");
  const parts = [users, roles, catalog, assignable];

  const reloadUsers = users.reload;
  const reloadRoles = roles.reload;
  const reloadCatalog = catalog.reload;
  const reloadAssignable = assignable.reload;
  const reload = useCallback(
    () => Promise.all([reloadUsers(), reloadRoles(), reloadCatalog(), reloadAssignable()]),
    [reloadUsers, reloadRoles, reloadCatalog, reloadAssignable],
  );

  return {
    users: users.data ?? [],
    roles: roles.data ?? [],
    catalog: catalog.data,
    assignable: assignable.data ?? [],
    loading: parts.some((p) => p.loading),
    error: parts.find((p) => p.error)?.error ?? "",
    reload,
  };
}
