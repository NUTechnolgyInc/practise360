"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Everything the Access control portal needs, reloaded together after each mutation so counts and guards stay in sync. */
export function useRbacData() {
  const [data, setData] = useState({ users: [], roles: [], catalog: null, assignable: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const [users, roles, catalog, assignable] = await Promise.all([
        api("/rbac/users"),
        api("/rbac/roles"),
        api("/rbac/catalog"),
        api("/rbac/assignable"),
      ]);
      setData({ users, roles, catalog, assignable });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...data, loading, error, reload };
}
