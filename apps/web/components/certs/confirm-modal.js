"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Textarea } from "@/components/ui";

/**
 * Confirmation for closing actions (decline, drop, withdraw, retire). With `reasonLabel` it also asks for an optional
 * reason, which is logged on the plan's timeline.
 */
export function ConfirmModal({ open, onClose, title, description, body, confirmLabel, reasonLabel, danger = true, onConfirm }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const confirm = async () => {
    setBusy(true);
    const ok = await onConfirm(reason);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {confirmLabel}
          </Button>
        </>
      }
    >
      {reasonLabel ? (
        <Field id="confirm-reason" label={reasonLabel} hint="Optional — shown on the plan's timeline">
          {(p) => <Textarea {...p} rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
      ) : (
        <p className="text-sm text-nu-dark-teal">{body}</p>
      )}
    </Modal>
  );
}
