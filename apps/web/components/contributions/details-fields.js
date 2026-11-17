"use client";

import { Field, Input, Select } from "@/components/ui";
import { CONTRIBUTION_TYPES } from "@/lib/contributions";

/** Title / type / custom type / dates — shared by "Start a contribution" and "Edit details". */
export function DetailsFields({ value, onChange, errors = {}, practices }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id="c-title" label="Title" error={errors.title} className="sm:col-span-2" hint="e.g. nu-auth-shared">
        {(p) => <Input {...p} value={value.title} onChange={set("title")} maxLength={120} required />}
      </Field>
      {practices && (
        <Field id="c-practice" label="Practice" error={errors.practiceId} hint={practices.length === 1 ? "Your practice" : undefined}>
          {(p) => (
            <Select {...p} value={value.practiceId} onChange={set("practiceId")} disabled={practices.length === 1} required>
              {practices.length > 1 && <option value="">Choose…</option>}
              {practices.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </Select>
          )}
        </Field>
      )}
      <Field id="c-type" label="Type" error={errors.type}>
        {(p) => (
          <Select {...p} value={value.type} onChange={set("type")} required>
            <option value="">Choose…</option>
            {CONTRIBUTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        )}
      </Field>
      {value.type === "other" && (
        <Field id="c-custom" label="Custom type" error={errors.customType} hint="e.g. Conference talk, Training module">
          {(p) => <Input {...p} value={value.customType} onChange={set("customType")} maxLength={60} required />}
        </Field>
      )}
      <Field id="c-start" label="Start date" error={errors.startDate}>
        {(p) => <Input {...p} type="date" value={value.startDate} onChange={set("startDate")} required />}
      </Field>
      <Field id="c-due" label="Due date" error={errors.dueDate}>
        {(p) => <Input {...p} type="date" value={value.dueDate} min={value.startDate || undefined} onChange={set("dueDate")} required />}
      </Field>
    </div>
  );
}

/** Client-side checks mirroring the API, so people see problems before submitting. */
export function validateDetails(v, { needPractice = false } = {}) {
  const e = {};
  if (!v.title.trim()) e.title = "Give it a title";
  if (needPractice && !v.practiceId) e.practiceId = "Choose a practice";
  if (!v.type) e.type = "Choose a type";
  if (v.type === "other" && !v.customType?.trim()) e.customType = "Name the type";
  if (!v.startDate) e.startDate = "Pick a start date";
  if (!v.dueDate) e.dueDate = "Pick a due date";
  else if (v.startDate && v.dueDate < v.startDate) e.dueDate = "Due date is before the start date";
  return e;
}
