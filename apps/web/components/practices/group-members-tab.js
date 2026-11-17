"use client";

import { useState } from "react";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR, useToast } from "@/components/ui";
import { ConfirmModal } from "@/components/certs/confirm-modal";
import { PersonChip } from "@/components/people/person-link";
import { api } from "@/lib/api";
import { AddToGroupModal } from "./add-to-group-modal";
import { announceBulkInvite, announceInvite, BulkInviteResultsModal, InviteSentModal } from "./invite-sent-modal";

/**
 * Members tab of a group page. With `group.actions.manageMembers` (its Lead, the Manager, Practices Admin) people can
 * be added and removed; removing keeps them in the practice, without a group. The Lead's own row has no Remove —
 * choose another Lead first. `onChanged` receives the updated practice.
 */
export function GroupMembersTab({ practice, group, onChanged }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [sentInvite, setSentInvite] = useState(null);
  const [bulkResults, setBulkResults] = useState(null);
  const canManage = group.actions.manageMembers;
  const groupName = new Map(practice.groups.map((g) => [g.id, g.name]));
  const members = (practice.members ?? []).filter((m) => m.groupId === group.id);

  const added = ({ invite, results, ...updated }) => {
    onChanged(updated);
    setAdding(false);
    announceInvite(invite, { toast, show: setSentInvite });
    announceBulkInvite(results, { toast, show: setBulkResults, where: group.name });
  };

  const remove = async () => {
    try {
      onChanged(await api(`/practices/${practice.id}/members/${removing.id}`, { method: "PUT", body: { groupId: null } }));
      toast(`${removing.displayName} is no longer in ${group.name}`);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  };

  return (
    <Card>
      <CardHeader
        title="Members"
        description={`Everyone in ${group.name}. ${group.lead ? `${group.lead.displayName} reviews` : "Until it has a Lead, the Practice Manager reviews"} their contributions and certifications.`}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setAdding(true)}>
              <UserPlus /> Add member
            </Button>
          )
        }
      />
      {!practice.members ? (
        <EmptyState icon={Users} title="Members are hidden" description="You can't see who is in this practice." className="border-none" />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="Nobody in this group yet" description={canManage ? "Add people from the practice who aren't in a group yet." : undefined} className="border-none" />
      ) : (
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Person</TH>
              <TH>Roles</TH>
              {canManage && <TH className="text-right"><span className="sr-only">Actions</span></TH>}
            </TR>
          </THead>
          <TBody>
            {members.map((m) => (
              <TR key={m.id}>
                <TD>
                  <PersonChip person={m} subtitle={m.email || m.username} size="sm" />
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {m.leads.includes(group.id) && <Badge variant="purple">Lead</Badge>}
                    {m.roles.map((r) => <Badge key={r} variant={r === "Practice Manager" ? "primary" : "neutral"}>{r}</Badge>)}
                    {m.leads.filter((gid) => gid !== group.id).map((gid) => <Badge key={gid} variant="purple">Lead · {groupName.get(gid)}</Badge>)}
                  </div>
                </TD>
                {canManage && (
                  <TD className="text-right">
                    {group.lead?.id !== m.id && (
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(m)} aria-label={`Remove ${m.displayName} from ${group.name}`}>
                        <UserMinus /> Remove
                      </Button>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <AddToGroupModal open={adding} practice={practice} group={group} onClose={() => setAdding(false)} onSaved={added} />
      <InviteSentModal invite={sentInvite} onClose={() => setSentInvite(null)} />
      <BulkInviteResultsModal results={bulkResults} onClose={() => setBulkResults(null)} />
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.displayName ?? "them"} from ${group.name}?`}
        body={`They stay in ${practice.name}. Until they join another group, the Practice Manager reviews their open work.`}
        confirmLabel="Remove from group"
        onConfirm={remove}
      />
    </Card>
  );
}
