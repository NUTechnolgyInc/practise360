"use client";

import { Field, Select } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";

/**
 * "Owner" picker on Start a contribution, for people who can add one on a member's behalf (practices.contribution.manage:
 * Lead → their group, Manager → the practice, Practices Admin). The API returns only members in the caller's reach.
 * `canOwn` = the caller may also own one here themselves; value "" means "me".
 */
export function OwnerField({ practiceId, canOwn, value, onChange, error }) {
  const { data: people, loading } = useResource(`/contributions/practices/${practiceId}/owners`);
  return (
    <Field id="c-owner" label="Owner" error={error} hint={value ? "They'll own it and submit it. You'll show as “Added by” and can't review it." : "Add it for a member of your group or practice, or own it yourself."}>
      {(p) => (
        <Select {...p} value={value} onChange={(e) => onChange(e.target.value)} disabled={loading}>
          {canOwn ? <option value="">Me</option> : <option value="">Choose a member…</option>}
          {(people ?? []).map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
        </Select>
      )}
    </Field>
  );
}
