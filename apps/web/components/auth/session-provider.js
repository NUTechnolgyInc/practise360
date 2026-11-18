"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SESSION_EXPIRED_EVENT, tokenStore } from "@/lib/api";
import { can as canCheck } from "@/lib/can";
import { clearResourceCache } from "@/lib/resource-cache";

// The last /me per browser tab, so a reload draws the shell at once while /me is re-checked. Keyed by the token's
// subject + issue time rather than the token itself, so no second copy of the credential is stored.
const ME_KEY = "p360.me";

function tokenId(token) {
  try {
    const { sub, iat } = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return `${sub}:${iat}`;
  } catch {
    return null;
  }
}

const meCache = {
  read(token) {
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(ME_KEY));
      return saved && saved.id === tokenId(token) ? saved.me : null;
    } catch {
      return null;
    }
  },
  write(token, me) {
    try {
      window.sessionStorage.setItem(ME_KEY, JSON.stringify({ id: tokenId(token), me }));
    } catch {
      // Storage full or blocked: the next load just waits for /me.
    }
  },
  clear() {
    try {
      window.sessionStorage.removeItem(ME_KEY);
    } catch {
      // ignore
    }
  },
};

/** Drop everything cached for the previous person. */
function forgetSession() {
  meCache.clear();
  clearResourceCache();
}

const SessionContext = createContext(null);

/**
 * Loads /me once a token exists. `me` is null while signed out; `loading` until the first check finishes.
 * `expired` is true after the API rejected the token mid-session, so the login page can say why they're there.
 */
export function SessionProvider({ children }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);

  const refresh = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) {
      setMe(null);
      setLoading(false);
      return null;
    }
    // Show the saved copy straight away; the /me below still decides (a revoked role or expired token wins).
    const saved = meCache.read(token);
    if (saved) {
      setMe(saved);
      setLoading(false);
    }
    try {
      const data = await api("/me");
      setMe(data);
      meCache.write(token, data);
      return data;
    } catch {
      // A 401 already cleared the token and flagged the session as expired (lib/api.js).
      meCache.clear();
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Any request rejected with 401 ends the session; PortalShell then sends the person to /login.
  useEffect(() => {
    const onExpired = () => {
      forgetSession();
      setMe(null);
      setExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const signIn = useCallback(
    async (token) => {
      forgetSession();
      tokenStore.set(token);
      setExpired(false);
      setLoading(true);
      return refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
    forgetSession();
    setMe(null);
    setExpired(false);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ me, loading, expired, refresh, signIn, signOut, can: (permission, scope, resource) => canCheck(me, permission, scope, resource) }),
    [me, loading, expired, refresh, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
