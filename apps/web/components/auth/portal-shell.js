"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Award, Bot, Home, Lightbulb, Loader2, Settings, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout";
import { NoAccess } from "@/components/ui";
import { practicesHome } from "@/components/practices/practices-nav";
import { canAnywhere, RBAC_PORTAL_PERMS } from "@/lib/can";
import { profilePath } from "@/lib/people";
import { useSession } from "./session-provider";

/** Authenticated frame: redirects to /login when signed out and builds nav from the user's grants. */
export function PortalShell({ breadcrumbs, requires, children }) {
  const router = useRouter();
  const { me, loading, signOut } = useSession();

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading…
      </div>
    );
  }

  const showAccess = canAnywhere(me, ...RBAC_PORTAL_PERMS);
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    ...(canAnywhere(me, "practices.practice.view", "practices.contribution.view") ? [{ href: practicesHome(me), label: "Practices", icon: Lightbulb }] : []),
    ...(me.apps.some((a) => a.id === "cert-tracker") ? [{ href: "/certifications", label: "Certifications", icon: Award }] : []),
    ...(me.apps.some((a) => a.id === "ai-tracker") ? [{ href: "/ai-tracker", label: "AI Tracker", icon: Bot }] : []),
    ...(showAccess ? [{ href: "/access-control", label: "Access control", icon: ShieldCheck }] : []),
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const user = {
    name: me.displayName,
    username: me.username,
    profileHref: profilePath(me.id),
    assignments: me.grants.map((g) => ({ role: g.roleName, scope: g.scopeLabel })),
  };
  const allowed = !requires || canAnywhere(me, ...requires);

  return (
    <AppShell navItems={navItems} user={user} breadcrumbs={breadcrumbs} onSignOut={signOut}>
      {allowed ? children : <NoAccess />}
    </AppShell>
  );
}
