"use client";

import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CONTRIBUTION_STATUSES, CONTRIBUTION_TYPES } from "@/lib/contributions";

export const EMPTY_FILTERS = { q: "", practiceId: "", status: "", type: "", ownerId: "", overdue: false };

/** Applies the filter bar to rows already loaded from the API (the API only returns what the caller may see). */
export function applyFilters(rows, f) {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (c) =>
      (!q || c.title.toLowerCase().includes(q) || c.owner.displayName.toLowerCase().includes(q)) &&
      (!f.practiceId || c.practice.id === f.practiceId) &&
      (!f.status || c.status === f.status) &&
      (!f.type || c.type === f.type) &&
      (!f.ownerId || c.owner.id === f.ownerId) &&
      (!f.overdue || c.overdue),
  );
}

export function ContributionFilters({ value, onChange, practices, owners }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const active = Object.entries(value).some(([k, v]) => v !== EMPTY_FILTERS[k]);
  const byPractice = practices.length > 1;

  // One line only from xl: next to the sidebar, lg is too narrow for five selects and the selects truncate.
  return (
    <div
      className={cn(
        "grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:items-center",
        byPractice ? "xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto_auto]" : "xl:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto_auto]",
      )}
    >
      <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input aria-label="Search by title or owner" placeholder="Search title or owner" value={value.q} onChange={set("q")} className="pl-9" />
      </div>
      {byPractice && (
        <Select aria-label="Practice" value={value.practiceId} onChange={set("practiceId")}>
          <option value="">All practices</option>
          {practices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      )}
      <Select aria-label="Status" value={value.status} onChange={set("status")}>
        <option value="">All statuses</option>
        {CONTRIBUTION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </Select>
      <Select aria-label="Type" value={value.type} onChange={set("type")}>
        <option value="">All types</option>
        {CONTRIBUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Select>
      <Select aria-label="Started by" value={value.ownerId} onChange={set("ownerId")}>
        <option value="">Anyone</option>
        {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
      </Select>
      <label className="flex items-center gap-2 whitespace-nowrap px-1 text-xs font-semibold text-nu-navy">
        <input type="checkbox" checked={value.overdue} onChange={set("overdue")} className="size-4 accent-nu-purple" /> Overdue only
      </label>
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)} disabled={!active}>
        Clear
      </Button>
    </div>
  );
}
