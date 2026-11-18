"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { EMPTY_SNAPSHOT, getSnapshot, mutate, revalidate, subscribe } from "@/lib/resource-cache";

/**
 * Loads `path` (null = skip) and exposes reload/setData — the shared data-loading hook for list and detail screens.
 * Backed by lib/resource-cache: a path seen before renders its last response at once and refreshes in the
 * background, so `loading` is only true when there is nothing to show yet.
 */
export function useResource(path) {
  const subscribeToPath = useCallback((fn) => subscribe(path, fn), [path]);
  // Server render and hydration see the empty snapshot, so cached data can't cause a hydration mismatch.
  const snap = useSyncExternalStore(subscribeToPath, () => getSnapshot(path), () => EMPTY_SNAPSHOT);

  useEffect(() => {
    if (path) revalidate(path);
  }, [path]);

  const reload = useCallback(() => (path ? revalidate(path, { force: true }) : Promise.resolve()), [path]);
  const setData = useCallback((next) => path && mutate(path, next), [path]);

  // While a new path loads, keep showing the previous path's data (filters, paging) — as before the cache.
  const last = useRef(null);
  if (snap.data !== undefined) last.current = snap.data;
  const hasData = snap.data !== undefined;

  return {
    data: hasData ? snap.data : last.current,
    setData,
    loading: !!path && !hasData && (snap.fetching || !snap.settled),
    error: snap.error ?? "",
    reload,
  };
}
