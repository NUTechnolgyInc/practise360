"use client";

import { useState } from "react";
import { useToast } from "@/components/ui";
import { ConfirmModal } from "@/components/certs/confirm-modal";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { AddMemberModal } from "./add-member-modal";
import { ChooseHolderModal } from "./choose-holder-modal";
import { GroupFormModal } from "./group-form-modal";
import { announceInvite, InviteSentModal } from "./invite-sent-modal";
import { RenamePracticeModal } from "./rename-practice-modal";

const ROLE_OF_INVITE = { manager: "Manager", lead: "Lead" };

/**
 * Every dialog on the practice page. `modal` = { type: "edit" | "manager" | "lead" | "group" | "add" | "delete" |
 * "removeLead", group? } or null. Each mutation returns the updated practice, handed to `onChanged`; one that sent an
 * invitation also carries `invite`, announced here (a toast, or the join link when email isn't set up).
 */
export function PracticeModals({ practice, modal, onClose, onChanged }) {
  const toast = useToast();
  const [sentInvite, setSentInvite] = useState(null);
  const people = useResource(modal?.type === "manager" ? "/practices/people" : null);
  const { id, actions, groups } = practice;
  const members = practice.members ?? [];
  const invites = practice.invites ?? [];
  const group = modal?.group ?? null;
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const saved = ({ invite, ...updated }) => {
    onChanged(updated);
    onClose();
    if (invite) {
      const kind = updated.invites?.find((i) => i.id === invite.id)?.kind;
      announceInvite(invite, { toast, show: setSentInvite, role: ROLE_OF_INVITE[kind] });
    }
  };

  const holderTarget =
    modal?.type === "manager"
      ? {
          kind: "manager",
          title: `Choose the Manager of ${practice.name}`,
          path: `/practices/${id}/manager`,
          invitePath: `/practices/${id}/invites`,
          current: practice.managers[0] ?? null,
          pending: invites.find((i) => i.kind === "manager") ?? null,
          people: people.data ?? [],
          loading: people.loading,
          canInvite: actions.setManager,
        }
      : modal?.type === "lead"
        ? {
            kind: "lead",
            title: `Choose the Lead of ${group.name}`,
            path: `/practices/${id}/groups/${group.id}/lead`,
            invitePath: `/practices/${id}/invites`,
            groupId: group.id,
            current: group.lead,
            pending: invites.find((i) => i.kind === "lead" && i.groupId === group.id) ?? null,
            people: members,
            note: (p) => (p.groupId ? `in ${groupName.get(p.groupId)}` : "not in a group"),
            emptyText: "Nobody in this practice yet — add members first",
            // A new Lead also joins the practice, so inviting one needs both appointments.
            canInvite: group.actions.setLead && actions.addMember,
          }
        : null;

  /** Runs a DELETE from a confirmation dialog; true closes it. */
  const remove = (path, message) => async () => {
    try {
      onChanged(await api(path, { method: "DELETE" }));
      toast(message);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  };

  return (
    <>
      <RenamePracticeModal open={modal?.type === "edit"} practice={practice} onClose={onClose} onSaved={saved} />
      <ChooseHolderModal target={holderTarget} onClose={onClose} onSaved={saved} />
      <GroupFormModal
        open={modal?.type === "group"}
        practice={practice}
        group={group}
        members={members}
        canSetLead={actions.appointLeads}
        canInviteLead={actions.appointLeads && actions.addMember}
        onClose={onClose}
        onSaved={saved}
      />
      <AddMemberModal open={modal?.type === "add"} practice={practice} canPlace={actions.moveMembers} onClose={onClose} onSaved={saved} />
      <InviteSentModal invite={sentInvite} onClose={() => setSentInvite(null)} />
      <ConfirmModal
        open={modal?.type === "delete"}
        onClose={onClose}
        title={`Delete ${group?.name ?? "group"}?`}
        body="The group is empty, so nobody's work changes hands. This can't be undone."
        confirmLabel="Delete group"
        onConfirm={group && remove(`/practices/${id}/groups/${group.id}`, `Deleted ${group.name}`)}
      />
      <ConfirmModal
        open={modal?.type === "removeLead"}
        onClose={onClose}
        title={`Remove ${group?.lead?.displayName ?? "the Lead"} as Lead?`}
        body={`${group?.name ?? "The group"} will have no Lead until you choose one — the Manager reviews its members' work meanwhile. ${group?.lead?.displayName ?? "They"} stay in the practice.`}
        confirmLabel="Remove Lead"
        onConfirm={group && remove(`/practices/${id}/groups/${group.id}/lead`, `${group.name} has no Lead now — the Manager covers its members`)}
      />
    </>
  );
}
