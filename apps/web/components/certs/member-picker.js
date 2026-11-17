"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Avatar, Button, Input } from "@/components/ui";

/** Checkbox list of practice members with search and select-all. `value` = selected user ids. */
export function MemberPicker({ people, loading, error, value, onChange }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = people.filter((p) => !needle || `${p.displayName} ${p.username}`.toLowerCase().includes(needle));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const allShown = shown.length > 0 && shown.every((p) => value.includes(p.id));
  const toggleAll = () => onChange(allShown ? value.filter((id) => !shown.some((p) => p.id === id)) : [...new Set([...value, ...shown.map((p) => p.id)])]);

  return (
    // A <legend> must be the fieldset's first child, which would break the header row — label it by id instead.
    <fieldset aria-labelledby="member-picker-label" aria-describedby={error ? "member-picker-error" : undefined}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span id="member-picker-label" className="text-xs font-bold uppercase tracking-wider text-nu-navy">
          People * {value.length > 0 && <span className="normal-case text-nu-purple">· {value.length} selected</span>}
        </span>
        {shown.length > 1 && (
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allShown ? "Clear" : "Select all"}
          </Button>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <ul className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
        {loading && !people.length ? (
          <li className="p-3 text-xs text-nu-muted-teal" role="status">Loading members…</li>
        ) : shown.length === 0 ? (
          <li className="p-3 text-xs text-gray-400">{people.length ? "Nobody matches" : "No other members in this practice"}</li>
        ) : (
          shown.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-nu-purple" />
                <Avatar name={p.displayName} size="sm" />
                <span className="min-w-0 text-xs">
                  <span className="block font-bold text-nu-navy">{p.displayName}</span>
                  <span className="block font-mono text-[11px] text-gray-400">{p.username}</span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
      {error && <p id="member-picker-error" className="mt-1 text-xs text-rose-600">{error}</p>}
    </fieldset>
  );
}
