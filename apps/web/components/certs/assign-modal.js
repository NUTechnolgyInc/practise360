"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { CertPicker, EMPTY_NEW_CERT, certChoiceBody, certChoiceReady } from "./cert-picker";
import { MemberPicker } from "./member-picker";
import { todayInput } from "@/lib/certifications";
import { cn } from "@/lib/cn";

const MODES = [
  { value: "suggest", label: "Recommend", hint: "They accept with their own dates, or decline." },
  { value: "assign", label: "Assign", hint: "Mandatory, with a due date. They can't decline or drop it." },
];

const blank = (presetId, practices) => {
  const first = practices[0];
  return {
    mode: first?.canSuggest ? "suggest" : "assign",
    practiceId: first?.id ?? "",
    userIds: [],
    choice: { mode: "catalog", catalogId: presetId ?? "", cert: EMPTY_NEW_CERT },
    startDate: "",
    dueDate: "",
    note: "",
  };
};

/** Recommend or assign one cert to several practice members at once. A new cert is added to the shared catalog. */
export function AssignModal({ open, onClose, catalog, practices, presetId, meId, onSubmit }) {
  const [form, setForm] = useState(() => blank(presetId, practices));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const people = useResource(open && form.practiceId ? `/certifications/people/${form.practiceId}` : null);

  useEffect(() => {
    if (open) {
      setForm(blank(presetId, practices));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetId]);

  const practice = practices.find((p) => p.id === form.practiceId);
  const modes = MODES.filter((m) => (m.value === "assign" ? practice?.canAssign : practice?.canSuggest));
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const members = (people.data ?? []).filter((p) => p.id !== meId);

  const save = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.userIds.length) found.userIds = "Pick at least one person";
    if (!certChoiceReady(form.choice)) found.cert = form.choice.mode === "new" ? "Name the certification or course" : "Pick one from the catalog";
    if (form.mode === "assign" && !form.dueDate) found.dueDate = "An assignment needs a due date";
    if (form.dueDate && form.dueDate < todayInput()) found.dueDate = "The due date can't be in the past";
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) found.dueDate = "Due date can't be before the start date";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const { choice, ...rest } = form;
    const ok = await onSubmit({ ...rest, ...certChoiceBody(choice), startDate: form.startDate || undefined, dueDate: form.dueDate || undefined });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title="Assign or recommend"
      description="Give a certification or course to one or more members of your practice. Each person gets their own plan."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="assign-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {form.mode === "assign" ? "Assign" : "Recommend"}
            {form.userIds.length > 0 && ` to ${form.userIds.length}`}
          </Button>
        </>
      }
    >
      <form id="assign-form" onSubmit={save} className="space-y-4" noValidate>
        {practices.length > 1 && (
          <Field id="assign-practice" label="Practice *">
            {(p) => (
              <Select {...p} value={form.practiceId} onChange={(e) => setForm((f) => ({ ...blank(presetId, practices), choice: f.choice, practiceId: e.target.value, mode: practices.find((x) => x.id === e.target.value)?.canSuggest ? "suggest" : "assign" }))}>
                {practices.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </Select>
            )}
          </Field>
        )}
        <div role="radiogroup" aria-label="Recommend or assign" className="grid gap-2 sm:grid-cols-2">
          {modes.map((m) => (
            <label
              key={m.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-all focus-within:ring-2 focus-within:ring-nu-purple",
                form.mode === m.value ? "border-nu-purple bg-purple-50" : "border-gray-200 hover:bg-gray-50",
              )}
            >
              <input type="radio" name="assign-mode" value={m.value} checked={form.mode === m.value} onChange={set("mode")} className="sr-only" />
              <span className={cn("block text-xs font-bold", form.mode === m.value ? "text-nu-purple" : "text-nu-navy")}>{m.label}</span>
              <span className="mt-0.5 block text-[11px] text-nu-muted-teal">{m.hint}</span>
            </label>
          ))}
        </div>
        <MemberPicker people={members} loading={!people.data && !people.error} error={errors.userIds || people.error} value={form.userIds} onChange={(userIds) => setForm((f) => ({ ...f, userIds }))} />
        <CertPicker
          idPrefix="assign-cert"
          catalog={catalog}
          value={form.choice}
          onChange={(choice) => setForm((f) => ({ ...f, choice }))}
          newHint="It's added to the shared catalog so every practice can reuse it."
          error={errors.cert}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="assign-start" label="Start date" hint={form.mode === "assign" ? "Defaults to today" : "Optional — they pick dates when accepting"}>
            {(p) => <Input {...p} type="date" value={form.startDate} onChange={set("startDate")} />}
          </Field>
          <Field id="assign-due" label={form.mode === "assign" ? "Due date *" : "Due date"} error={errors.dueDate}>
            {(p) => <Input {...p} type="date" required={form.mode === "assign"} min={todayInput()} value={form.dueDate} onChange={set("dueDate")} />}
          </Field>
        </div>
        <Field id="assign-note" label="Note" hint="Why this cert — shown on their plan">
          {(p) => <Textarea {...p} rows={3} maxLength={5000} value={form.note} onChange={set("note")} />}
        </Field>
      </form>
    </Modal>
  );
}
