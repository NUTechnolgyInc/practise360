"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

export function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `items` must already be filtered to the apps the user can see (derived from their assignments).
 * The sidebar never decides access itself.
 */
export function NavList({ items, collapsed = false, onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Apps" className="flex-1 space-y-1.5 overflow-y-auto p-3">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active ? "bg-nu-purple font-semibold text-white shadow-md" : "text-gray-300 hover:bg-white/10 hover:text-white",
              collapsed && "justify-center",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ items, roleSummary, collapsed, onToggle }) {
  return (
    <aside className={cn("relative z-20 hidden flex-col bg-nu-navy text-white transition-all duration-300 md:flex", collapsed ? "w-20" : "w-64")}>
      <div className="flex h-16 items-center justify-between border-b border-white/10 p-4">
        {collapsed ? (
          <Logo variant="icon" className="mx-auto" />
        ) : (
          <div className="flex items-center gap-2">
            <Logo onDark className="h-7" />
            <span className="border-l border-white/20 pl-2 font-heading text-sm font-extrabold tracking-wide">Practise360</span>
          </div>
        )}
        <button type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="rounded-lg p-1 text-gray-300 hover:bg-white/10">
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
      <NavList items={items} collapsed={collapsed} />
      {!collapsed && roleSummary && (
        <div className="border-t border-white/10 bg-black/10 p-4">
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">Your roles</div>
          <div className="truncate text-xs font-medium">{roleSummary}</div>
        </div>
      )}
    </aside>
  );
}
