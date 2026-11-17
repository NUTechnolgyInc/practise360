"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { invitedEmail, PersonSelect } from "./person-select";

/**
 * Add someone to one group. Who can be picked follows the API's rules (rbac.md §4 "Practices and groups"):
 * practice members who aren't in a group, plus members of other groups the caller also runs (`manageMembers`) —
 * so a Lead only brings in people without a group. With `practice.actions.addMember` (Manager, Practices Admin),
 * anyone on Practise360 can be added to the practice straight into this group, or invited by email.
 * `onSaved` gets the updated practice (plus `invite` when one was sent).
 */
export function AddToGroupModal({ open, practice, group, onClose, onSaved }) {
  const toast = useToast();
  const canAddNew = practice.actions.addMember;
  const people = useResource(open && canAddNew ? "/practices/people" : null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUserId("");
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
  const email = invitedEmail(userId);
  const picked = candidates.find((p) => p.id === userId);

  const save = async () => {
    if (!userId) return setError("Pick someone to add");
    setBusy(true);
    try {
      if (email) {
        onSaved(await api(`/practices/${practice.id}/invites`, { method: "POST", body: { email, kind: "member", groupId: group.id } }));
        return;
      }
      const updated = inPractice.has(userId)
        ? await api(`/practices/${practice.id}/members/${userId}`, { method: "PUT", body: { groupId: group.id } })
        : await api(`/practices/${practice.id}/members`, { method: "POST", body: { userId, groupId: group.id } });
      toast(`Added ${picked?.displayName ?? "them"} to ${group.name}`);
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
      title={`Add someone to ${group.name}`}
      description={
        canAddNew
          ? `Pick someone from ${practice.name}, or anyone on Practise360 — they join the practice as a Practitioner. Not on Practise360 yet? Enter their email to invite them.`
          : fromOtherGroups
            ? `Pick someone in ${practice.name}. To bring in someone from outside the practice, ask the Practice Manager.`
            : `Pick someone in ${practice.name} who isn't in a group yet. To bring in someone from another group or from outside the practice, ask the Practice Manager.`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !userId}>
            {busy && <Loader2 className="animate-spin" />} {email ? "Send invite" : "Add to group"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <PersonSelect
          id="add-to-group"
          label="Person"
          people={candidates}
          loading={people.loading}
          value={userId}
          onChange={setUserId}
          note={note}
          emptyText={canAddNew || fromOtherGroups ? `Everyone is already in ${group.name}` : "Everyone in the practice is already in a group"}
          allowInvite={canAddNew}
        />
        {picked?.groupId && <p className="text-[11px] text-nu-muted-teal">Their open work moves to {group.lead ? `${group.lead.displayName}, this group's Lead` : "this group (the Manager reviews it until it has a Lead)"}.</p>}
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
