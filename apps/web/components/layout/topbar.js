"use client";

import Link from "next/link";
import { Fragment } from "react";
import { Menu } from "lucide-react";

/** `breadcrumbs` = [{ label, href? }] — the last crumb is the current page and isn't a link. */
export function Topbar({ breadcrumbs = [], onOpenMobileNav, right }) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm md:px-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpenMobileNav} aria-label="Open navigation" className="rounded-lg p-2 text-nu-navy hover:bg-gray-100 md:hidden">
          <Menu className="size-5" />
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-nu-muted-teal md:text-sm">
          {breadcrumbs.map((crumb, i) => {
            const last = i === breadcrumbs.length - 1;
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                {last || !crumb.href ? (
                  <span aria-current={last ? "page" : undefined} className="font-semibold text-nu-navy">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="font-medium transition-colors hover:text-nu-lapis">{crumb.label}</Link>
                )}
                {!last && <span className="text-gray-300">/</span>}
              </Fragment>
            );
          })}
        </nav>
      </div>
      {right}
    </header>
  );
}
