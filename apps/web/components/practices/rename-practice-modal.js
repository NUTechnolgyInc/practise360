"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api";

/** Manager / Practices Admin: rename a practice or change its description. Its id (and URL) stay the same. */
export function RenamePracticeModal({ open, practice, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: practice.name, description: practice.description });
      setError("");
    }
  }, [open, practice]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const updated = await api(`/practices/${practice.id}`, { method: "PATCH", body: form });
      toast("Practice updated");
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit ${practice.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="practice-edit-form" disabled={busy || !form.name.trim()}>
            {busy && <Loader2 className="animate-spin" />} Save
          </Button>
        </>
      }
    >
      <form id="practice-edit-form" onSubmit={submit} className="space-y-4">
        <Field id="practice-edit-name" label="Name *">
          {(p) => <Input {...p} required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field id="practice-edit-description" label="Description">
          {(p) => <Textarea {...p} rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
