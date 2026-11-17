"use client";

import { useState } from "react";
import { Badge, Select, Table, TBody, TD, TH, THead, TR, useToast } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { api } from "@/lib/api";

/**
 * Everyone in the practice with their roles and group. With `canMove`, the group column is a select that moves them —
 * which also hands their open work to the new group's Lead.
 */
export function MembersTable({ practice, canMove, onChanged }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);
  const groupName = new Map(practice.groups.map((g) => [g.id, g.name]));

  const move = async (member, groupId) => {
    setBusyId(member.id);
    try {
      const updated = await api(`/practices/${practice.id}/members/${member.id}`, { method: "PUT", body: { groupId: groupId || null } });
      toast(groupId ? `Moved ${member.displayName} to ${groupName.get(groupId)}` : `${member.displayName} is no longer in a group`);
      onChanged(updated);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Table>
      <THead>
        <TR>
          <TH>Person</TH>
          <TH>Roles</TH>
          <TH>Group</TH>
        </TR>
      </THead>
      <TBody>
        {practice.members.map((m) => (
          <TR key={m.id}>
            <TD>
              <PersonChip person={m} subtitle={m.username} size="sm" />
            </TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {m.roles.map((r) => <Badge key={r} variant={r === "Practice Manager" ? "primary" : "neutral"}>{r}</Badge>)}
                {m.leads.map((gid) => <Badge key={gid} variant="purple">Lead · {groupName.get(gid)}</Badge>)}
              </div>
            </TD>
            <TD className="min-w-44">
              {canMove ? (
                <Select
                  aria-label={`Group for ${m.displayName}`}
                  value={m.groupId ?? ""}
                  disabled={busyId === m.id}
                  onChange={(e) => move(m, e.target.value)}
                  className="py-1.5 text-xs"
                >
                  <option value="">Not in a group</option>
                  {practice.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              ) : (
                <span className="text-xs text-nu-dark-teal">{m.groupId ? groupName.get(m.groupId) : <span className="text-gray-400">Not in a group</span>}</span>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
