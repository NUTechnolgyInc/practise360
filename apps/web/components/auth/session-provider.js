"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, SESSION_EXPIRED_EVENT, tokenStore } from "@/lib/api";
import { can as canCheck } from "@/lib/can";

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
    if (!tokenStore.get()) {
      setMe(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api("/me");
      setMe(data);
      return data;
    } catch {
      // A 401 already cleared the token and flagged the session as expired (lib/api.js).
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
      setMe(null);
      setExpired(true);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const signIn = useCallback(
    async (token) => {
      tokenStore.set(token);
      setExpired(false);
      setLoading(true);
      return refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
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
