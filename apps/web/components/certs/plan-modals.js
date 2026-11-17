"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { todayInput } from "@/lib/certifications";
import { toDateInput } from "@/lib/contributions";

/** Shared form state + save handling for the small date forms below. */
function useDateForm(open, initial, validate, onSave, onClose) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setForm(initial);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const save = async (e) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const ok = await onSave(form);
    setBusy(false);
    if (ok) onClose();
  };
  return { form, errors, busy, set, save };
}

const datesProblems = (f) => {
  const e = {};
  if (!f.startDate) e.startDate = "Pick a start date";
  if (!f.dueDate) e.dueDate = "Pick a due date";
  else if (f.startDate && f.dueDate < f.startDate) e.dueDate = "Due date can't be before the start date";
  return e;
};

function Footer({ formId, busy, label, onClose }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button type="submit" form={formId} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {label}</Button>
    </>
  );
}

/** Accept a recommendation with your own dates (prefilled with whatever the recommender suggested). */
export function AcceptModal({ open, onClose, plan: p, onSave }) {
  const initial = { startDate: toDateInput(p.startDate) || todayInput(), dueDate: toDateInput(p.dueDate) };
  const { form, errors, busy, set, save } = useDateForm(open, initial, datesProblems, onSave, onClose);
  return (
    <Modal open={open} onClose={onClose} title="Accept recommendation" description={`Add ${p.cert.title} to your plans.`} footer={<Footer formId="accept-form" busy={busy} label="Accept" onClose={onClose} />}>
      <form id="accept-form" onSubmit={save} className="grid gap-3 sm:grid-cols-2" noValidate>
        <Field id="accept-start" label="Start date *" error={errors.startDate}>{(f) => <Input {...f} type="date" required value={form.startDate} onChange={set("startDate")} />}</Field>
        <Field id="accept-due" label="Due date *" error={errors.dueDate}>{(f) => <Input {...f} type="date" required min={form.startDate || undefined} value={form.dueDate} onChange={set("dueDate")} />}</Field>
      </form>
    </Modal>
  );
}

/**
 * Edit dates/notes. The owner edits start date and notes (and the due date of their own plans); an assigner edits only
 * the due date of an assignment. `canEdit` / `canEditDue` come from the API's actions.
 */
export function EditPlanModal({ open, onClose, plan: p, canEdit, canEditDue, onSave }) {
  const initial = { startDate: toDateInput(p.startDate), dueDate: toDateInput(p.dueDate), notes: p.notes };
  const validate = (f) => {
    const e = {};
    if (canEdit && !f.startDate) e.startDate = "Pick a start date";
    if (canEditDue && !f.dueDate) e.dueDate = "Pick a due date";
    else if (f.startDate && f.dueDate && f.dueDate < f.startDate) e[canEditDue ? "dueDate" : "startDate"] = "Due date can't be before the start date";
    return e;
  };
  const send = (f) => onSave({ ...(canEdit && { startDate: f.startDate, notes: f.notes }), ...(canEditDue && { dueDate: f.dueDate }) });
  const { form, errors, busy, set, save } = useDateForm(open, initial, validate, send, onClose);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit plan"
      description={canEdit ? "Changes are logged on the timeline." : "You can move the due date of an assignment you can manage. The change is logged."}
      footer={<Footer formId="edit-plan-form" busy={busy} label="Save" onClose={onClose} />}
    >
      <form id="edit-plan-form" onSubmit={save} className="space-y-4" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          {canEdit && <Field id="edit-start" label="Start date *" error={errors.startDate}>{(f) => <Input {...f} type="date" required value={form.startDate} onChange={set("startDate")} />}</Field>}
          {canEditDue && <Field id="edit-due" label="Due date *" error={errors.dueDate}>{(f) => <Input {...f} type="date" required value={form.dueDate} onChange={set("dueDate")} />}</Field>}
        </div>
        {!canEditDue && <p className="text-[11px] text-nu-muted-teal">The due date was set by whoever assigned this certification.</p>}
        {canEdit && <Field id="edit-notes" label="Notes">{(f) => <Textarea {...f} rows={4} maxLength={5000} value={form.notes} onChange={set("notes")} />}</Field>}
      </form>
    </Modal>
  );
}
