"use client";

import { useState } from "react";
import { Mail, RotateCw, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, Table, TBody, TD, TH, THead, TR, useToast } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

/** Delivery/expiry as a badge: what the inviter needs to know about whether the link reached them. */
function InviteStatus({ invite }) {
  if (invite.expired) return <Badge variant="danger">Expired {formatDate(invite.expiresAt)}</Badge>;
  if (invite.delivery === "failed") return <Badge variant="danger">Email failed</Badge>;
  if (invite.delivery === "logged") return <Badge variant="warning" title="No mail server is set up — the email went to the API console">Not emailed</Badge>;
  return <Badge variant="teal">Sent {formatDate(invite.sentAt)}</Badge>;
}

/**
 * Open invitations of a practice (only sent to people who can invite here). Resend issues a fresh link and expiry;
 * cancel makes the link stop working. `onChanged` gets the updated practice; `onSent` the resent invite's result.
 */
export function PendingInvites({ practice, onChanged, onSent }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  const run = async (invite, action) => {
    setBusy(`${invite.id}:${action}`);
    try {
      const path = `/practices/${practice.id}/invites/${invite.id}`;
      const { invite: sent, ...updated } = await api(action === "resend" ? `${path}/resend` : path, { method: action === "resend" ? "POST" : "DELETE" });
      onChanged(updated);
      if (action === "cancel") toast(`Cancelled the invitation for ${invite.email}`);
      else onSent(sent);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Pending invitations" description="People invited by email who haven't joined yet. Each link works once and expires after 7 days." />
      <Table>
        <THead>
          <TR>
            <TH>Email</TH>
            <TH>Invited as</TH>
            <TH>Status</TH>
            <TH className="text-right">
              <span className="sr-only">Actions</span>
            </TH>
          </TR>
        </THead>
        <TBody>
          {practice.invites.map((i) => (
            <TR key={i.id}>
              <TD>
                <span className="flex items-center gap-2 text-xs font-semibold text-nu-navy">
                  <Mail className="size-4 shrink-0 text-nu-purple" aria-hidden="true" /> {i.email}
                </span>
                {i.invitedBy && (
                  <span className="ml-6 block text-[11px] text-gray-400">
                    by <PersonLink person={i.invitedBy} />
                  </span>
                )}
              </TD>
              <TD className="text-xs text-nu-dark-teal first-letter:uppercase">{i.role}</TD>
              <TD className="whitespace-nowrap">
                <InviteStatus invite={i} />
              </TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  {i.actions.resend && (
                    <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => run(i, "resend")}>
                      <RotateCw className={busy === `${i.id}:resend` ? "animate-spin" : undefined} /> Resend
                    </Button>
                  )}
                  {i.actions.cancel && (
                    <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => run(i, "cancel")} aria-label={`Cancel the invitation for ${i.email}`}>
                      <X /> Cancel
                    </Button>
                  )}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
