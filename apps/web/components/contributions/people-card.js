"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Modal, useToast } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { PersonSelect } from "@/components/practices/person-select";
import { useResource } from "@/hooks/use-resource";

const inviteLabel = (n) => (n === 1 ? "Invite 1 person" : n ? `Invite ${n} people` : "Invite people");

/**
 * Invite practice members to contribute, several at once, with the same searchable picker used everywhere else.
 * Only practice members can be invited (the API refuses anyone else), so there's no invite-by-email here.
 * `onInvite(userId)` resolves true when that invite went through; failures are toasted by the caller.
 */
function InvitePicker({ contribution, onInvite }) {
  const toast = useToast();
  const { data: people, loading } = useResource(`/contributions/practices/${contribution.practice.id}/people`);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setPicked([]);
  }, [open]);

  const taken = new Set([contribution.owner.id, ...contribution.contributors.map((p) => p.id), ...contribution.invites.map((i) => i.user.id)]);
  const options = (people ?? []).filter((p) => !taken.has(p.id));
  if (!options.length) return null;

  const save = async () => {
    setBusy(true);
    // One request per person: each returns the fresh contribution, and one refusal shouldn't block the rest.
    let sent = 0;
    for (const userId of picked) if (await onInvite(userId)) sent += 1;
    setBusy(false);
    if (sent) toast(sent === 1 ? "Invite sent" : `${sent} invites sent`);
    if (sent === picked.length) setOpen(false);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UserPlus /> Invite people
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invite people to contribute"
        description={`Pick members of ${contribution.practice.name}. They can accept or decline the invite.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !picked.length}>
              {busy && <Loader2 className="animate-spin" />} {inviteLabel(picked.length)}
            </Button>
          </>
        }
      >
        <PersonSelect
          id="invite-contributors"
          label="People"
          people={options}
          loading={loading}
          value={picked}
          onChange={setPicked}
          emptyText="Everyone in this practice is already on it"
          multiple
        />
      </Modal>
    </>
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
          {actions.manageMembers && <InvitePicker contribution={c} onInvite={(userId) => run(`${base}/invites`, { method: "POST", body: { userId } })} />}
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
