"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { BrandBar } from "@/components/brand/brand-bar";
import { Logo } from "@/components/brand/logo";
import { NavList, Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { UserMenu } from "./user-menu";

/**
 * Authenticated page frame: brand bar, collapsible sidebar, mobile drawer, top bar with breadcrumbs
 * and user menu. Pass `navItems` already filtered by the user's visible apps.
 */
export function AppShell({ navItems, user, breadcrumbs, onSignOut, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const roleSummary = user?.assignments?.map((a) => a.role).join(", ");

  return (
    <div className="flex min-h-screen flex-col">
      <BrandBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar items={navItems} roleSummary={roleSummary} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
            <div className="flex h-full w-64 flex-col bg-nu-navy text-white" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-white/10 p-4">
                <Logo onDark className="h-6" />
                <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-lg p-1 hover:bg-white/10">
                  <X className="size-5" />
                </button>
              </div>
              <NavList items={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <Topbar breadcrumbs={breadcrumbs} onOpenMobileNav={() => setMobileOpen(true)} right={user && <UserMenu user={user} onSignOut={onSignOut} />} />
          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
