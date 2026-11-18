"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { AddByEmailField, AddModeTabs, addCountLabel, addPicked, splitValid } from "./add-by-email";
import { PersonSelect, splitPicked } from "./person-select";

/**
 * Add people to one group — tick several at once. Who can be picked follows the API's rules (rbac.md §4 "Practices and groups"):
 * practice members who aren't in a group, plus members of other groups the caller also runs (`manageMembers`) —
 * so a Lead only brings in people without a group. With `practice.actions.addMember` (Manager, Practices Admin),
 * anyone on Practise360 can be added to the practice straight into this group. With `group.actions.invite` (those,
 * plus the group's Lead) someone new can be invited by email, one or several at once. `onSaved` gets the updated
 * practice (plus `invite` when one was sent, or `results` per address for a bulk add).
 */
export function AddToGroupModal({ open, practice, group, onClose, onSaved }) {
  const canAddNew = practice.actions.addMember;
  const canInvite = canAddNew || !!group.actions.invite;
  const people = useResource(open && canAddNew ? "/practices/people" : null);
  const [mode, setMode] = useState("pick");
  const [picked, setPicked] = useState([]);
  const [emails, setEmails] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("pick");
      setPicked([]);
      setEmails([]);
      setError("");
    }
  }, [open]);

  const groupById = new Map(practice.groups.map((g) => [g.id, g]));
  const members = practice.members ?? [];
  const inPractice = new Set(members.map((m) => m.id));
  const managers = new Set(practice.managers.map((m) => m?.id));
  // The Manager oversees every group, so they aren't offered here (the practice's Members table can still place them).
  const movable = members.filter((m) => m.groupId !== group.id && !managers.has(m.id) && (!m.groupId || groupById.get(m.groupId)?.actions.manageMembers));
  // People without a group first: they're the usual pick, and the only one for a Lead.
  const candidates = [
    ...movable.filter((m) => !m.groupId),
    ...movable.filter((m) => m.groupId),
    ...(canAddNew ? (people.data ?? []).filter((p) => !inPractice.has(p.id)) : []),
  ];
  const note = (p) => (!inPractice.has(p.id) ? `joins ${practice.name}` : p.groupId ? `in ${groupById.get(p.groupId)?.name} — moves here` : "not in a group");
  const fromOtherGroups = practice.groups.some((g) => g.id !== group.id && g.actions.manageMembers);
  const { userIds, emails: invites } = splitPicked(picked);
  const movers = candidates.filter((p) => userIds.includes(p.id) && p.groupId);
  const bulk = canInvite && mode === "email";
  const { valid, invalid } = splitValid(emails);
  const ready = bulk ? valid.length > 0 && invalid.length === 0 : picked.length > 0;

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const save = async () => {
    if (!ready) return setError(bulk ? "Enter at least one email address" : "Pick someone to add");
    setBusy(true);
    const inviteMany = (list) => api(`/practices/${practice.id}/invites/bulk`, { method: "POST", body: { emails: list, groupId: group.id } });
    try {
      if (bulk) {
        onSaved(await inviteMany(valid));
        return;
      }
      onSaved(
        await addPicked({
          people: candidates.filter((p) => userIds.includes(p.id)),
          emails: invites,
          // A practice member moves into the group; someone from outside joins the practice straight into it.
          addOne: (p) =>
            inPractice.has(p.id)
              ? api(`/practices/${practice.id}/members/${p.id}`, { method: "PUT", body: { groupId: group.id } })
              : api(`/practices/${practice.id}/members`, { method: "POST", body: { userId: p.id, groupId: group.id } }),
          inviteMany,
          noteFor: (p) => (p.groupId ? `Moved from ${groupById.get(p.groupId)?.name}` : `Added to ${group.name}`),
        }),
      );
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
      title={`Add people to ${group.name}`}
      description={
        canAddNew
          ? `Pick someone from ${practice.name}, or anyone on Practise360 — they join the practice as a Practitioner. Not on Practise360 yet? Enter their email to invite them.`
          : canInvite
            ? `Pick someone in ${practice.name} who isn't in a group yet, or enter the email of someone not on Practise360 to invite them into ${group.name}. To bring in someone who already has an account, ask the Practice Manager.`
            : fromOtherGroups
            ? `Pick someone in ${practice.name}. To bring in someone from outside the practice, ask the Practice Manager.`
            : `Pick someone in ${practice.name} who isn't in a group yet. To bring in someone from another group or from outside the practice, ask the Practice Manager.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !ready}>
            {busy && <Loader2 className="animate-spin" />} {addCountLabel(bulk ? valid.length : picked.length)}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {canInvite && <AddModeTabs value={mode} onChange={switchMode} />}
        {bulk ? (
          <AddByEmailField id="add-to-group-emails" value={emails} onChange={setEmails} inviteOnly={!canAddNew} />
        ) : (
          <PersonSelect
            id="add-to-group"
            label="People"
            people={candidates}
            loading={people.loading}
            value={picked}
            onChange={setPicked}
            note={note}
            emptyText={canAddNew || fromOtherGroups ? `Everyone is already in ${group.name}` : "Everyone in the practice is already in a group"}
            allowInvite={canInvite}
            multiple
          />
        )}
        {bulk && <p className="text-[11px] text-nu-muted-teal">Everyone joins {practice.name} and goes into {group.name}; invited people when they sign in. Someone already in the practice isn't moved — pick them instead.</p>}
        {!bulk && movers.length > 0 && (
          <p className="text-[11px] text-nu-muted-teal">
            Open work of the {movers.length === 1 ? "person" : `${movers.length} people`} moving from another group goes to{" "}
            {group.lead ? `${group.lead.displayName}, this group's Lead` : "this group (the Manager reviews it until it has a Lead)"}.
          </p>
        )}
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
