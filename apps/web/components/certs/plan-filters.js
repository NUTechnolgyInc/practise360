"use client";

import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { CERT_TYPES, PLAN_STATUSES } from "@/lib/certifications";

export const EMPTY_PLAN_FILTERS = { q: "", practiceId: "", status: "", type: "", ownerId: "", overdue: false };

/** Applies the filter bar to plans already loaded from the API (the API only returns what the caller may see). */
export function applyPlanFilters(rows, f) {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (p) =>
      (!q || `${p.cert.title} ${p.cert.provider} ${p.owner.displayName}`.toLowerCase().includes(q)) &&
      (!f.practiceId || p.practice.id === f.practiceId) &&
      (!f.status || p.status === f.status) &&
      (!f.type || p.cert.type === f.type) &&
      (!f.ownerId || p.owner.id === f.ownerId) &&
      (!f.overdue || p.overdue),
  );
}

/** `owners` empty = hide the member filter (own plans). */
export function PlanFilters({ value, onChange, practices, owners }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const active = Object.entries(value).some(([k, v]) => v !== EMPTY_PLAN_FILTERS[k]);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)_auto_auto] lg:items-center">
      <div className="relative sm:col-span-2 lg:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input aria-label="Search by certification, provider or member" placeholder="Search" value={value.q} onChange={set("q")} className="pl-9" />
      </div>
      {practices.length > 1 ? (
        <Select aria-label="Practice" value={value.practiceId} onChange={set("practiceId")}>
          <option value="">All practices</option>
          {practices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      ) : (
        <span className="hidden lg:block" />
      )}
      <Select aria-label="Status" value={value.status} onChange={set("status")}>
        <option value="">All statuses</option>
        {PLAN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </Select>
      <Select aria-label="Type" value={value.type} onChange={set("type")}>
        <option value="">All types</option>
        {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </Select>
      {owners.length > 0 ? (
        <Select aria-label="Member" value={value.ownerId} onChange={set("ownerId")}>
          <option value="">Anyone</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.displayName}</option>)}
        </Select>
      ) : (
        <span className="hidden lg:block" />
      )}
      <label className="flex items-center gap-2 whitespace-nowrap px-1 text-xs font-semibold text-nu-navy">
        <input type="checkbox" checked={value.overdue} onChange={set("overdue")} className="size-4 accent-nu-purple" /> Overdue only
      </label>
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_PLAN_FILTERS)} disabled={!active}>
        Clear
      </Button>
    </div>
  );
}
