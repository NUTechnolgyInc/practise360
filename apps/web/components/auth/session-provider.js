"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, tokenStore } from "@/lib/api";
import { can as canCheck } from "@/lib/can";

const SessionContext = createContext(null);

/** Loads /me once a token exists. `me` is null while signed out; `loading` until the first check finishes. */
export function SessionProvider({ children }) {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      if (err.status === 401) tokenStore.clear();
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (token) => {
      tokenStore.set(token);
      setLoading(true);
      return refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    tokenStore.clear();
    setMe(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ me, loading, refresh, signIn, signOut, can: (permission, scope, resource) => canCheck(me, permission, scope, resource) }),
    [me, loading, refresh, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
