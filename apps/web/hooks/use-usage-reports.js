"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Loads `path` (null = skip) and exposes reload — shared by the my-reports and team-reports views. */
function useResource(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api(path));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export const useMyReports = () => useResource("/ai/usage-reports/mine");
export const useTeamReports = (period) => useResource(period ? `/ai/usage-reports?period=${period}` : null);
