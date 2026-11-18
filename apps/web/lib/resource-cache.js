import { api } from "@/lib/api";

// In-memory GET cache shared by every screen (stale-while-revalidate): a screen opened again shows the last response
// at once and refreshes it in the background. UI only — the API still checks every request. Cleared on sign-in,
// sign-out and session expiry so one person's data never shows for another.

const MAX_ENTRIES = 100;
// The person can no longer see this (or the session ended): don't keep showing it to the next screen that asks.
const DROP_ON = new Set([401, 403, 404]);
const EMPTY = Object.freeze({});

/** path → { snapshot: { data?, error?, fetching?, settled? }, listeners, seq, inflight } */
const entries = new Map();

function entryFor(path) {
  let e = entries.get(path);
  if (!e) {
    e = { snapshot: EMPTY, listeners: new Set(), seq: 0, inflight: null };
    entries.set(path, e);
    prune();
  }
  return e;
}

// Oldest first (Map keeps insertion order); never drop what a mounted screen is showing or fetching.
function prune() {
  for (const [path, e] of entries) {
    if (entries.size <= MAX_ENTRIES) return;
    if (!e.listeners.size && !e.inflight) entries.delete(path);
  }
}

function update(e, patch) {
  e.snapshot = { ...e.snapshot, ...patch };
  e.listeners.forEach((fn) => fn());
}

export const EMPTY_SNAPSHOT = EMPTY;
export const getSnapshot = (path) => (path ? (entries.get(path)?.snapshot ?? EMPTY) : EMPTY);

export function subscribe(path, fn) {
  if (!path) return () => {};
  const e = entryFor(path);
  e.listeners.add(fn);
  return () => e.listeners.delete(fn);
}

/**
 * Fetch `path` into the cache. Without `force`, joins a request already in flight (several components mounting on
 * the same path send one request). `force` always asks again — used after a change, when an older request may
 * predate it. Only the newest request's answer is kept. Never throws: errors land in the snapshot.
 */
export function revalidate(path, { force = false } = {}) {
  const e = entryFor(path);
  if (e.inflight && !force) return e.inflight;
  const seq = ++e.seq;
  update(e, { fetching: true });
  const run = api(path)
    .then(
      (data) => {
        if (seq === e.seq) update(e, { data, error: undefined, fetching: false, settled: true });
      },
      (err) => {
        if (seq === e.seq) update(e, { ...(DROP_ON.has(err.status) && { data: undefined }), error: err.message, fetching: false, settled: true });
      },
    )
    .finally(() => {
      if (e.inflight === run) e.inflight = null;
    });
  e.inflight = run;
  return run;
}

/** Replace the cached value (e.g. with a mutation's response). Like React's setState, `next` may be an updater. */
export function mutate(path, next) {
  const e = entryFor(path);
  const data = typeof next === "function" ? next(e.snapshot.data ?? null) : next;
  e.seq += 1; // a response still in flight was asked before this change — don't let it overwrite it
  update(e, { data, error: undefined, fetching: false, settled: true });
}

/** Forget everything (sign-in/out). Mounted screens fall back to empty and refetch on their next mount. */
export function clearResourceCache() {
  for (const [path, e] of entries) {
    e.seq += 1;
    e.inflight = null;
    if (!e.listeners.size) entries.delete(path);
    else update(e, { data: undefined, error: undefined, fetching: false, settled: false });
  }
}
