"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { CERT_TYPES } from "@/lib/certifications";

export const EMPTY_NEW_CERT = { title: "", type: "certification", provider: "", url: "" };

/** Turns the picker's value into the API's `{ catalogId }` or `{ cert }`. */
export const certChoiceBody = (v) => (v.mode === "new" ? { cert: v.cert } : { catalogId: v.catalogId });
export const certChoiceReady = (v) => (v.mode === "new" ? !!v.cert.title.trim() : !!v.catalogId);

/**
 * Pick a cert from the shared catalog, or describe one that isn't listed.
 * value = { mode: "catalog" | "new", catalogId, cert }. `newHint` says where a new cert ends up (catalog or one-off).
 */
export function CertPicker({ idPrefix, catalog, value, onChange, newHint, error }) {
  const [q, setQ] = useState("");
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalog.filter((c) => !needle || `${c.title} ${c.provider}`.toLowerCase().includes(needle));
  }, [catalog, q]);
  const setCert = (key) => (e) => onChange({ ...value, cert: { ...value.cert, [key]: e.target.value } });

  if (value.mode === "new") {
    return (
      <fieldset className="space-y-3 rounded-2xl border border-gray-200 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wider text-nu-navy">New certification or course</legend>
        <p className="text-[11px] text-nu-muted-teal">{newHint}</p>
        <Field id={`${idPrefix}-title`} label="Name *" error={error}>
          {(p) => <Input {...p} required maxLength={160} value={value.cert.title} onChange={setCert("title")} placeholder="e.g. Certified Kubernetes Security Specialist" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${idPrefix}-type`} label="Type *">
            {(p) => (
              <Select {...p} value={value.cert.type} onChange={setCert("type")}>
                {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            )}
          </Field>
          <Field id={`${idPrefix}-provider`} label="Provider">
            {(p) => <Input {...p} maxLength={80} value={value.cert.provider} onChange={setCert("provider")} placeholder="e.g. The Linux Foundation" />}
          </Field>
        </div>
        <Field id={`${idPrefix}-url`} label="Link" hint="Official page for the exam or course (optional)">
          {(p) => <Input {...p} type="url" maxLength={500} value={value.cert.url} onChange={setCert("url")} placeholder="https://" />}
        </Field>
        <Button variant="link" size="sm" className="px-0" onClick={() => onChange({ ...value, mode: "catalog" })}>
          Pick from the catalog instead
        </Button>
      </fieldset>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <Input aria-label="Search the catalog" placeholder="Search the catalog" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <Field id={`${idPrefix}-catalog`} label="Certification or course *" error={error} hint={`${options.length} of ${catalog.length} shown`}>
        {(p) => (
          <Select {...p} required value={value.catalogId} onChange={(e) => onChange({ ...value, catalogId: e.target.value })}>
            <option value="">Choose…</option>
            {CERT_TYPES.map((t) => {
              const items = options.filter((c) => c.type === t.value);
              return items.length ? (
                <optgroup key={t.value} label={`${t.label}s`}>
                  {items.map((c) => <option key={c.id} value={c.id}>{c.title}{c.provider ? ` — ${c.provider}` : ""}</option>)}
                </optgroup>
              ) : null;
            })}
          </Select>
        )}
      </Field>
      <Button variant="link" size="sm" className="px-0" onClick={() => onChange({ ...value, mode: "new" })}>
        Not in the catalog? Add a new certification or course
      </Button>
    </div>
  );
}
