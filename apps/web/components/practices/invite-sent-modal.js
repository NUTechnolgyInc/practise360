"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Input, Modal } from "@/components/ui";

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
