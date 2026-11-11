"use client";

import { cn } from "@/lib/cn";

/**
 * Pill-style segmented tabs. Controlled: the parent owns `value` so tabs can be synced to the URL.
 * `tabs` = [{ value, label }]
 */
export function Tabs({ tabs, value, onChange, className, "aria-label": ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex flex-wrap rounded-2xl bg-gray-100 p-1", className)}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              "rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple",
              active ? "bg-white text-nu-lapis shadow-sm" : "text-gray-500 hover:text-gray-700",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
