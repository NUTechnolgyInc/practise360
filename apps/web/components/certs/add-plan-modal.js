"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { CertPicker, EMPTY_NEW_CERT, certChoiceBody, certChoiceReady } from "./cert-picker";
import { todayInput } from "@/lib/certifications";

const blank = (presetId, practices) => ({
  choice: { mode: "catalog", catalogId: presetId ?? "", cert: EMPTY_NEW_CERT },
  practiceId: practices[0]?.id ?? "",
  startDate: todayInput(),
  dueDate: "",
  notes: "",
});

/** Plan one of your own certifications. A cert typed in here stays on this plan only (it isn't added to the catalog). */
export function AddPlanModal({ open, onClose, catalog, practices, presetId, onSubmit }) {
  const [form, setForm] = useState(() => blank(presetId, practices));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(presetId, practices));
      setErrors({});
    }
    // Reset only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetId]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (!certChoiceReady(form.choice)) found.cert = form.choice.mode === "new" ? "Name the certification or course" : "Pick one from the catalog";
    if (!form.startDate) found.startDate = "Pick a start date";
    if (!form.dueDate) found.dueDate = "Pick a due date";
    else if (form.startDate && form.dueDate < form.startDate) found.dueDate = "Due date can't be before the start date";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const ok = await onSubmit({ practiceId: form.practiceId, ...certChoiceBody(form.choice), startDate: form.startDate, dueDate: form.dueDate, notes: form.notes });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a plan"
      description="Plan a certification or course. When you finish it, submit the certificate for Lead and Manager approval."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-plan-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Add plan
          </Button>
        </>
      }
    >
      <form id="add-plan-form" onSubmit={save} className="space-y-4" noValidate>
        <CertPicker
          idPrefix="plan-cert"
          catalog={catalog}
          value={form.choice}
          onChange={(choice) => setForm((f) => ({ ...f, choice }))}
          newHint="Stays on your plan only — Leads and Managers add certifications to the shared catalog."
          error={errors.cert}
        />
        {practices.length > 1 && (
          <Field id="plan-practice" label="Practice *" hint="Who reviews it: that practice's Lead and Manager">
            {(p) => (
              <Select {...p} value={form.practiceId} onChange={set("practiceId")}>
                {practices.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </Select>
            )}
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="plan-start" label="Start date *" error={errors.startDate}>
            {(p) => <Input {...p} type="date" required value={form.startDate} onChange={set("startDate")} />}
          </Field>
          <Field id="plan-due" label="Due date *" error={errors.dueDate}>
            {(p) => <Input {...p} type="date" required min={form.startDate || undefined} value={form.dueDate} onChange={set("dueDate")} />}
          </Field>
        </div>
        <Field id="plan-notes" label="Notes" hint="Optional — study plan, exam slot, anything your Lead should know">
          {(p) => <Textarea {...p} rows={3} maxLength={5000} value={form.notes} onChange={set("notes")} />}
        </Field>
      </form>
    </Modal>
  );
}
