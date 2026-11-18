"use client";

import { Search } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { EMPTY_AUDIT_FILTERS, OUTCOME_LABEL } from "@/lib/audit";

/** Filter bar for the audit log. Values go to the API as query params; `options` comes from its `filters`. */
export function AuditFilters({ value, onChange, options }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  const active = Object.entries(value).some(([k, v]) => v !== EMPTY_AUDIT_FILTERS[k]);

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))_auto_auto_auto] xl:items-center">
      <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input type="search" aria-label="Search the audit log" placeholder="Search action, person, error or IP" value={value.q} onChange={set("q")} className="pl-9" />
      </div>
      <Select aria-label="Area" value={value.category} onChange={set("category")}>
        <option value="">All areas</option>
        {(options?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <Select aria-label="Outcome" value={value.outcome} onChange={set("outcome")}>
        <option value="">All outcomes</option>
        {(options?.outcomes ?? []).map((o) => <option key={o} value={o}>{OUTCOME_LABEL[o] ?? o}</option>)}
      </Select>
      <Select aria-label="Who" value={value.actorId} onChange={set("actorId")}>
        <option value="">Anyone</option>
        <option value="none">No one signed in</option>
        {(options?.actors ?? []).map((a) => <option key={a.id} value={a.id}>{a.displayName}</option>)}
      </Select>
      <label className="flex items-center gap-2 text-xs font-semibold text-nu-navy">
        <span className="w-9 shrink-0">From</span>
        <Input type="date" value={value.from} max={value.to || undefined} onChange={set("from")} />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-nu-navy">
        <span className="w-9 shrink-0">To</span>
        <Input type="date" value={value.to} min={value.from || undefined} onChange={set("to")} />
      </label>
      <Button variant="ghost" size="sm" onClick={() => onChange(EMPTY_AUDIT_FILTERS)} disabled={!active}>
        Clear
      </Button>
    </div>
  );
}
