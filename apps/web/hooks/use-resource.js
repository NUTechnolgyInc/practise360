"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Loads `path` (null = skip) and exposes reload/setData — the shared data-loading hook for list and detail screens. */
export function useResource(path) {
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

  return { data, setData, loading, error, reload };
}
