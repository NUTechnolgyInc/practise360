"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { CERT_TYPES } from "@/lib/certifications";

const blank = (item) => ({ title: item?.title ?? "", type: item?.type ?? "certification", provider: item?.provider ?? "", url: item?.url ?? "", description: item?.description ?? "" });
const isUrl = (u) => !u || /^https?:\/\/\S+$/i.test(u.trim());

/** Add a catalog entry, or edit one (`item`). */
export function CatalogModal({ open, onClose, item, onSubmit }) {
  const [form, setForm] = useState(() => blank(item));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(item));
      setErrors({});
    }
  }, [open, item]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.title.trim()) found.title = "Name the certification or course";
    if (!isUrl(form.url)) found.url = "Use a full http(s):// link";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const ok = await onSubmit(form);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "Edit catalog entry" : "Add to catalog"}
      description="The catalog is shared by every practice. Existing plans keep the details they were created with."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="catalog-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {item ? "Save" : "Add to catalog"}
          </Button>
        </>
      }
    >
      <form id="catalog-form" onSubmit={save} className="space-y-4" noValidate>
        <Field id="catalog-title" label="Name *" error={errors.title}>
          {(p) => <Input {...p} required maxLength={160} value={form.title} onChange={set("title")} placeholder="e.g. HashiCorp Certified: Vault Associate" />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="catalog-type" label="Type *">
            {(p) => (
              <Select {...p} value={form.type} onChange={set("type")}>
                {CERT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            )}
          </Field>
          <Field id="catalog-provider" label="Provider">
            {(p) => <Input {...p} maxLength={80} value={form.provider} onChange={set("provider")} />}
          </Field>
        </div>
        <Field id="catalog-url" label="Link" error={errors.url} hint="Official page for the exam or course">
          {(p) => <Input {...p} type="url" maxLength={500} value={form.url} onChange={set("url")} placeholder="https://" />}
        </Field>
        <Field id="catalog-description" label="Description">
          {(p) => <Textarea {...p} rows={3} maxLength={2000} value={form.description} onChange={set("description")} />}
        </Field>
      </form>
    </Modal>
  );
}
