"use client";

import { useState } from "react";
import { Check, UserPlus, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Select } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { useResource } from "@/hooks/use-resource";

function InvitePicker({ contribution, onInvite }) {
  const { data: people } = useResource(`/contributions/practices/${contribution.practice.id}/people`);
  const [userId, setUserId] = useState("");
  const taken = new Set([contribution.owner.id, ...contribution.contributors.map((p) => p.id), ...contribution.invites.map((i) => i.user.id)]);
  const options = (people ?? []).filter((p) => !taken.has(p.id));
  if (!options.length) return null;

  return (
    <div className="flex gap-2">
      <Select aria-label="Practice member to invite" value={userId} onChange={(e) => setUserId(e.target.value)} className="h-8 py-1 text-xs">
        <option value="">Invite a practice member…</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
      </Select>
      <Button variant="secondary" size="sm" disabled={!userId} onClick={() => onInvite(userId).then((ok) => ok && setUserId(""))}>
        <UserPlus /> Invite
      </Button>
    </div>
  );
}

function Row({ person, subtitle, children }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2">
      <PersonChip person={person} subtitle={subtitle} size="sm" />
      {children && <div className="flex shrink-0 gap-1">{children}</div>}
    </li>
  );
}

/** Owner, contributors, open invites and join requests. Controls appear only when `actions` allow them. */
export function PeopleCard({ contribution, meId, run }) {
  const c = contribution;
  const { actions } = c;
  const base = `/contributions/${c.id}`;

  return (
    <Card>
      <CardHeader title="People" description={`${c.contributors.length + 1} working on this`} />
      <ul className="divide-y divide-gray-100">
        <Row person={c.owner} subtitle={c.addedBy ? `Owner · added by ${c.addedBy.displayName}` : "Owner · started it"} />
        {c.contributors.map((p) => (
          <Row key={p.id} person={p} subtitle="Contributor">
            {actions.manageMembers && (
              <Button variant="ghost" size="sm" aria-label={`Remove ${p.displayName}`} onClick={() => run(`${base}/contributors/${p.id}`, { method: "DELETE" }, `${p.displayName} removed`, `Remove ${p.displayName} from this contribution?`)}>
                <X />
              </Button>
            )}
          </Row>
        ))}
      </ul>

      {c.joinRequests.length > 0 && (actions.manageMembers || actions.cancelRequest) && (
        <div className="mt-4">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Asked to join</h4>
          <ul className="divide-y divide-gray-100">
            {c.joinRequests.map((r) => (
              <Row key={r.user.id} person={r.user} subtitle={r.message || "No message"}>
                {actions.manageMembers && (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => run(`${base}/join-requests/${r.user.id}`, { method: "POST", body: { accept: true } }, `${r.user.displayName} added`)}>
                      <Check /> Accept
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Reject ${r.user.displayName}`} onClick={() => run(`${base}/join-requests/${r.user.id}`, { method: "POST", body: { accept: false } }, "Request rejected")}>
                      <X />
                    </Button>
                  </>
                )}
              </Row>
            ))}
          </ul>
        </div>
      )}

      {c.invites.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Invited</h4>
          <ul className="divide-y divide-gray-100">
            {c.invites.map((i) => (
              <Row key={i.user.id} person={i.user} subtitle={`Invited by ${i.by.displayName}`}>
                <Badge variant="warning">Pending</Badge>
                {actions.manageMembers && (
                  <Button variant="ghost" size="sm" aria-label={`Withdraw invite for ${i.user.displayName}`} onClick={() => run(`${base}/invites/${i.user.id}`, { method: "DELETE" }, "Invite withdrawn")}>
                    <X />
                  </Button>
                )}
              </Row>
            ))}
          </ul>
        </div>
      )}

      {(actions.manageMembers || actions.leave) && (
        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
          {actions.manageMembers && <InvitePicker contribution={c} onInvite={(userId) => run(`${base}/invites`, { method: "POST", body: { userId } }, "Invite sent")} />}
          {actions.leave && (
            <Button variant="ghost" size="sm" onClick={() => run(`${base}/contributors/${meId}`, { method: "DELETE" }, "You left this contribution", "Leave this contribution?")}>
              Leave contribution
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
