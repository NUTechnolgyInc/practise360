"use client";

import { EmailChipsInput, Field, isEmailAddress, Tabs } from "@/components/ui";

/** Most addresses one bulk add takes — the API's limit (BULK_INVITE_MAX). */
export const BULK_MAX = 50;

export const ADD_MODES = [
  { value: "pick", label: "Pick people" },
  { value: "email", label: "Add by email" },
];

/** Switch between picking one person and adding several by email. */
export function AddModeTabs({ value, onChange }) {
  return <Tabs aria-label="How to add people" tabs={ADD_MODES} value={value} onChange={onChange} />;
}

/** Valid and invalid addresses among the chips: the submit button counts the first and is blocked by the second. */
export const splitValid = (emails) => ({ valid: emails.filter(isEmailAddress), invalid: emails.filter((e) => !isEmailAddress(e)) });

/** The chip field for "Add by email". The API decides each address; this only checks the shape. */
export function AddByEmailField({ id, value, onChange, error, inviteOnly = false }) {
  const { invalid } = splitValid(value);
  return (
    <Field
      id={id}
      label="Email addresses"
      error={error || (invalid.length ? `Remove ${invalid.length === 1 ? "the address" : `the ${invalid.length} addresses`} marked in red` : undefined)}
      hint={
        inviteOnly
          ? "Separate addresses with commas, or paste a list. Each person gets an email invitation; anyone already on Practise360 needs the Practice Manager to add them."
          : "Separate addresses with commas, or paste a list. People already on Practise360 are added straight away; everyone else gets an email invitation."
      }
    >
      {(p) => <EmailChipsInput {...p} value={value} onChange={onChange} max={BULK_MAX} />}
    </Field>
  );
}

/**
 * Adds several picked people, then invites the picked emails. Each person is one call (`addOne(person)` → the updated
 * practice), since each is its own appointment the API checks; the emails go in one bulk invite (`inviteMany(emails)`).
 * One refusal doesn't stop the rest. Returns the latest practice plus `results` (one per person/address) for
 * announceBulkInvite; throws when nothing went through, so the dialog can show why.
 */
export async function addPicked({ people, emails, addOne, inviteMany, noteFor }) {
  let latest = null;
  const results = [];
  for (const p of people) {
    const row = { email: p.email || p.username, name: p.displayName };
    try {
      latest = await addOne(p);
      results.push({ ...row, status: "added", note: noteFor?.(p) });
    } catch (err) {
      results.push({ ...row, status: "refused", reason: err.message });
    }
  }
  if (emails.length) {
    const { results: invited, ...practice } = await inviteMany(emails);
    latest = practice;
    results.push(...invited);
  }
  if (!latest) throw new Error(results.map((r) => `${r.name}: ${r.reason}`).join(" · "));
  return { ...latest, results };
}

/** Button text for the email mode: "Add 1 person" / "Add 3 people". */
export const addCountLabel = (n) => (n === 1 ? "Add 1 person" : n ? `Add ${n} people` : "Add people");
