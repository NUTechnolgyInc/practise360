"use client";

import { EmailChipsInput, Field, isEmailAddress, Tabs } from "@/components/ui";

/** Most addresses one bulk add takes — the API's limit (BULK_INVITE_MAX). */
export const BULK_MAX = 50;

export const ADD_MODES = [
  { value: "pick", label: "Pick someone" },
  { value: "email", label: "Add by email" },
];

/** Switch between picking one person and adding several by email. */
export function AddModeTabs({ value, onChange }) {
  return <Tabs aria-label="How to add people" tabs={ADD_MODES} value={value} onChange={onChange} />;
}

/** Valid and invalid addresses among the chips: the submit button counts the first and is blocked by the second. */
export const splitValid = (emails) => ({ valid: emails.filter(isEmailAddress), invalid: emails.filter((e) => !isEmailAddress(e)) });

/** The chip field for "Add by email". The API decides each address; this only checks the shape. */
export function AddByEmailField({ id, value, onChange, error }) {
  const { invalid } = splitValid(value);
  return (
    <Field
      id={id}
      label="Email addresses"
      error={error || (invalid.length ? `Remove ${invalid.length === 1 ? "the address" : `the ${invalid.length} addresses`} marked in red` : undefined)}
      hint="Separate addresses with commas, or paste a list. People already on Practise360 are added straight away; everyone else gets an email invitation."
    >
      {(p) => <EmailChipsInput {...p} value={value} onChange={onChange} max={BULK_MAX} />}
    </Field>
  );
}

/** Button text for the email mode: "Add 1 person" / "Add 3 people". */
export const addCountLabel = (n) => (n === 1 ? "Add 1 person" : n ? `Add ${n} people` : "Add people");
