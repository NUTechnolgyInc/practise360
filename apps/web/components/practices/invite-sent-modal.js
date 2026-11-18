"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Badge, Button, Input, Modal } from "@/components/ui";

/**
 * After an invitation is created: a toast when it was emailed, otherwise this dialog. `invite` = the API's
 * { email, delivery, acceptUrl? }. Locally there's no mail server, so the API hands back the join link to pass on.
 */
export function InviteSentModal({ invite, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!invite || invite.delivery === "sent") return null;
  const failed = invite.delivery === "failed";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.acceptUrl);
      setCopied(true);
    } catch {
      setCopied(false); // Clipboard blocked: the link is selectable in the field.
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={failed ? "Invitation saved, but the email didn't go out" : `Invitation ready for ${invite.email}`}
      description={failed ? `We couldn't email ${invite.email}. Send it again from Pending invitations, or check the mail settings.` : undefined}
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {invite.acceptUrl ? (
        <div className="space-y-3">
          <p className="text-xs text-nu-dark-teal">
            Email isn't set up on this server, so the message was printed in the API console instead. Send them this join link — it works once and
            expires in 7 days.
          </p>
          <div className="flex gap-2">
            <Input aria-label="Join link" readOnly value={invite.acceptUrl} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
            <Button variant="secondary" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-nu-dark-teal">The invitation is listed under Pending invitations on the Groups &amp; members tab.</p>
      )}
    </Modal>
  );
}

/** Toast for an emailed invitation; anything else goes to the InviteSentModal via `show`. */
export function announceInvite(invite, { toast, show, role }) {
  if (!invite) return;
  if (invite.delivery === "sent") toast(`Invitation emailed to ${invite.email}${role ? ` — they become ${role} when they join` : ""}`);
  else show(invite);
}

const BULK_STATUS = {
  invited: { label: "Invited", variant: "teal" },
  added: { label: "Added", variant: "success" },
  member: { label: "Already a member", variant: "neutral" },
  refused: { label: "Not added", variant: "danger" },
};

/** "Invited 3 and added 2" — counts of what happened, for the toast and the dialog title. */
const bulkSummary = (results) => {
  const n = (s) => results.filter((r) => r.status === s).length;
  const parts = [n("invited") && `invited ${n("invited")}`, n("added") && `added ${n("added")}`].filter(Boolean);
  const text = parts.join(" and ");
  return text ? text[0].toUpperCase() + text.slice(1) : "Nobody was added";
};

/** One row of the bulk result: the person or address, and what happened. */
function BulkResultRow({ result }) {
  const status = BULK_STATUS[result.status] ?? BULK_STATUS.refused;
  // No join link to pass on: signing in with the invited email gives access (rbac.md §4 "Invitations").
  const note =
    result.note ??
    (result.status === "added"
      ? `${result.name ?? "They"} already had an account, so they were added directly`
      : result.status === "invited" && result.delivery === "failed"
        ? "The email didn't go out — they still get access when they sign in with this email"
        : result.status === "invited"
          ? result.delivery === "sent" ? "Emailed — they get access when they sign in with this email" : "They get access when they sign in with this email"
          : result.reason);
  return (
    <li className="space-y-1.5 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-nu-navy">{result.name && result.status !== "invited" ? result.name : result.email}</span>
          {note && <span className="block text-[11px] text-nu-muted-teal">{note}</span>}
        </span>
        <Badge variant={result.status === "invited" && result.delivery === "failed" ? "danger" : status.variant} className="shrink-0">
          {result.status === "invited" && result.delivery === "failed" ? "Email failed" : status.label}
        </Badge>
      </div>
    </li>
  );
}

/** After a bulk "add by email": every address with its outcome. Shown unless everything simply worked. */
export function BulkInviteResultsModal({ results, onClose }) {
  if (!results) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={bulkSummary(results)}
      description="What happened to each person and address."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
        {results.map((r) => <BulkResultRow key={r.email} result={r} />)}
      </ul>
    </Modal>
  );
}

/** Toast when every address was invited by email or added; otherwise the per-address dialog via `show`. */
export function announceBulkInvite(results, { toast, show, where }) {
  if (!results) return;
  // An invitation that wasn't emailed (no mail server) still works: they get access by signing in with that email.
  const clean = results.every((r) => r.status === "added" || (r.status === "invited" && r.delivery !== "failed"));
  if (clean) toast(`${bulkSummary(results)}${where ? ` to ${where}` : ""}`);
  else show(results);
}
