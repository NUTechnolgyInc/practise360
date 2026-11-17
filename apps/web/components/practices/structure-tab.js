"use client";

import { useState } from "react";
import { Plus, UserPlus, Users } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, useToast } from "@/components/ui";
import { GroupCard } from "./group-card";
import { announceInvite, InviteSentModal } from "./invite-sent-modal";
import { MembersTable } from "./members-table";
import { PendingInvites } from "./pending-invites";

/**
 * "Groups & members" tab of the practice page: groups with their Leads, and who sits in which group.
 * `openModal` takes the page's modal descriptor ({ type, group? }); `onChanged` receives the updated practice.
 */
export function StructureTab({ practice, openModal, onChanged }) {
  const toast = useToast();
  const [sentInvite, setSentInvite] = useState(null);
  const { actions, groups } = practice;
  const members = practice.members ?? [];
  const invites = practice.invites ?? [];

  return (
    <>
      <Card>
        <CardHeader
          title="Groups"
          description="A Lead reviews contributions and certifications of their own group's members."
          actions={
            actions.createGroup && (
              <Button variant="secondary" onClick={() => openModal({ type: "group" })}>
                <Plus /> New group
              </Button>
            )
          }
        />
        {groups.length === 0 ? (
          <EmptyState icon={Users} title="No groups yet" description={actions.createGroup ? "Create groups such as Fullstack or DevOps and choose a Lead for each." : "The Manager hasn't created any groups yet."} className="border-none" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                href={`/practices/${practice.id}/groups/${g.id}`}
                pendingLead={invites.find((i) => i.kind === "lead" && i.groupId === g.id)}
                onChooseLead={() => openModal({ type: "lead", group: g })}
                onRemoveLead={() => openModal({ type: "removeLead", group: g })}
                onRename={() => openModal({ type: "group", group: g })}
                onDelete={() => openModal({ type: "delete", group: g })}
              />
            ))}
          </div>
        )}
      </Card>

      {practice.members && (
        <Card>
          <CardHeader
            title="Members"
            description={
              actions.moveMembers
                ? "Pick a group to move someone. Their open work moves to that group's Lead."
                : "Everyone in this practice and the group they're in."
            }
            actions={
              actions.addMember && (
                <Button variant="secondary" onClick={() => openModal({ type: "add" })}>
                  <UserPlus /> Add member
                </Button>
              )
            }
          />
          {members.length === 0 ? (
            <EmptyState icon={Users} title="Nobody here yet" className="border-none" />
          ) : (
            <MembersTable practice={practice} canMove={actions.moveMembers} onChanged={onChanged} />
          )}
        </Card>
      )}

      {invites.length > 0 && <PendingInvites practice={practice} onChanged={onChanged} onSent={(invite) => announceInvite(invite, { toast, show: setSentInvite })} />}
      <InviteSentModal invite={sentInvite} onClose={() => setSentInvite(null)} />
    </>
  );
}
