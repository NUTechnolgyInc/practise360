"use client";

import { useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { Badge, Button, EmptyState, Input, Select, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { CERT_TYPES, certTypeLabel } from "@/lib/certifications";

/**
 * The shared catalog. Row buttons come from the page (permission-agnostic): `onPlan` / `onAssign` / `onEdit` /
 * `onToggleActive` are passed only to people who may use them; `canEdit`/`canRetire` per row come from the API.
 */
export function CatalogTab({ items, onPlan, onAssign, onEdit, onToggleActive }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const needle = q.trim().toLowerCase();
  const shown = items.filter((c) => (!needle || `${c.title} ${c.provider}`.toLowerCase().includes(needle)) && (!type || c.type === type));

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input aria-label="Search the catalog" placeholder="Search title or provider" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={BookOpen} title={items.length ? "Nothing matches" : "The catalog is empty"} description={items.length ? "Try another search." : "Leads and Managers add certifications here, or while assigning one."} className="border-none" />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Certification / course</TH>
              <TH>Provider</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {shown.map((c) => (
              <TR key={c.id} className={c.isActive ? undefined : "opacity-60"}>
                <TD className="min-w-56">
                  <div className="text-sm font-bold text-nu-navy">{c.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-nu-muted-teal">
                    <Badge variant={c.type === "course" ? "teal" : "primary"}>{certTypeLabel(c.type)}</Badge>
                    {!c.isActive && <Badge variant="neutral">Retired</Badge>}
                    {c.url && (
                      <a href={c.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-semibold text-nu-purple hover:underline">
                        <ExternalLink className="size-3" aria-hidden="true" /> Official page
                      </a>
                    )}
                  </div>
                </TD>
                <TD className="whitespace-nowrap">{c.provider || <span className="text-gray-400">—</span>}</TD>
                <TD className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {c.isActive && onPlan && <Button variant="ghost" size="sm" onClick={() => onPlan(c)}>Plan it</Button>}
                    {c.isActive && onAssign && <Button variant="ghost" size="sm" onClick={() => onAssign(c)}>Assign</Button>}
                    {c.canEdit && onEdit && <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>Edit</Button>}
                    {c.canRetire && onToggleActive && (
                      <Button variant="ghost" size="sm" onClick={() => onToggleActive(c)}>{c.isActive ? "Retire" : "Restore"}</Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
