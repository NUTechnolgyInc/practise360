"use client";

import { useEffect } from "react";
import { Field, Select } from "@/components/ui";
import { useSession } from "@/components/auth/session-provider";
import { invitedEmail, PersonSelect } from "@/components/practices/person-select";
import { useResource } from "@/hooks/use-resource";

/** Where a new person goes when the form doesn't say: the group it was opened from, the only option, or no group. */
const defaultPlace = (places, preferGroup) =>
  (places.find((p) => p.groupId === preferGroup) ?? (places.length === 1 ? places[0] : places.find((p) => p.groupId === null) ?? places[0]))?.groupId ?? "";

/**
 * "Owner" picker on Start a contribution, for people who can add one on a member's behalf (practices.contribution.manage:
 * Lead → their group, Manager → the practice, Practices Admin). The API returns only members in the caller's reach, and
 * `inviteInto` — where someone new may be invited (a Lead: their own group). Typing such a person's email picks an
 * invitation (read it with `invitedEmail(value)`); `groupId` ("" = no group) is where they'll join.
 * `canOwn` = the caller may also own one here themselves; value "" means "me".
 */
export function OwnerField({ practiceId, canOwn, value, onChange, groupId, onGroupChange, preferGroup, error }) {
  const { me } = useSession();
  const { data, loading } = useResource(`/contributions/practices/${practiceId}/owners`);
  const members = data?.members ?? [];
  const places = data?.inviteInto ?? [];
  const self = canOwn && me ? [{ id: me.id, displayName: me.displayName, username: me.username, email: me.email }] : [];
  const email = invitedEmail(value);

  // An invitation needs a place the caller may invite into; keep the choice valid as the pick or the data changes.
  useEffect(() => {
    if (email && places.length && !places.some((p) => (p.groupId ?? "") === groupId)) onGroupChange(defaultPlace(places, preferGroup));
  }, [email, places, groupId, preferGroup, onGroupChange]);

  const hint = email
    ? "The contribution is theirs straight away. They get access when they sign in with this email. You'll show as “Added by” and can't review it."
    : value
      ? "They'll own it and submit it. You'll show as “Added by” and can't review it."
      : `Add it for a member of your ${places.length || members.length ? "group or practice" : "practice"}${canOwn ? ", or own it yourself" : ""}${places.length ? ". Not on Practise360 yet? Type their email to invite them." : "."}`;

  return (
    <div className="space-y-3">
      <PersonSelect
        id="c-owner"
        label="Owner"
        people={[...self, ...members]}
        loading={loading}
        error={error}
        value={value || (canOwn ? me?.id ?? "" : "")}
        onChange={(id) => onChange(id === me?.id ? "" : id)}
        note={(p) => (p.id === me?.id ? "you" : null)}
        emptyText="Nobody in your reach yet"
        allowInvite={places.length > 0}
      />
      <p className="text-[11px] text-nu-muted-teal">{hint}</p>
      {email && places.length > 1 && (
        <Field id="c-owner-group" label="They join" hint="A Lead reviews contributions of their own group's members; without a group, the Practice Manager does.">
          {(p) => (
            <Select {...p} value={groupId} onChange={(e) => onGroupChange(e.target.value)}>
              {places.map((pl) => (
                <option key={pl.groupId ?? ""} value={pl.groupId ?? ""}>
                  {pl.groupId ? pl.name : `${pl.name} — no group`}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      {email && places.length === 1 && <p className="text-[11px] text-nu-muted-teal">They join {places[0].groupId ? `your group, ${places[0].name}` : places[0].name}.</p>}
    </div>
  );
}
