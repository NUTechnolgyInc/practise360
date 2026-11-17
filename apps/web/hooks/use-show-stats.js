"use client";

import { useCallback, useSyncExternalStore } from "react";

// One preference for every page: count tiles start hidden, and showing them on one page shows them everywhere.
// localStorage can be unavailable (private mode, blocked storage), so memory is the source of truth and
// storage only remembers it between visits.
const KEY = "p360.showStats";
const listeners = new Set();
let memory = null; // null = not read from storage yet

function read() {
  if (memory === null) {
    try {
      memory = window.localStorage.getItem(KEY) === "1";
    } catch {
      memory = false;
    }
  }
  return memory;
}

function write(value) {
  memory = value;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Not remembered between visits, but still applies for this one.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  // Another tab changed it.
  const onStorage = (e) => {
    if (e.key !== KEY) return;
    memory = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** `[shown, toggle]` for the count tiles at the top of a page. Hidden on the server render and by default. */
export function useShowStats() {
  const shown = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => write(!read()), []);
  return [shown, toggle];
}
