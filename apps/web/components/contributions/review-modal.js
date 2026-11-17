"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";

// Contribution wording. Other two-step workflows (Certification Tracker) pass their own `decisions` and `copy`.
const DECISIONS = [
  { value: "approve", label: "Approve", hint: { lead: "Sends it to the Practice Manager for final approval.", manager: "Publishes it to the practice." } },
  { value: "clarify", label: "Ask for clarification", hint: { lead: "Sends it back to the owner; it returns to you after they reply.", manager: "Sends it back to the owner; it returns to you after they reply." } },
  { value: "decline", label: "Decline", hint: { lead: "Closes it. The owner sees your comment.", manager: "Closes it. The owner sees your comment." }, danger: true },
];
const COPY = {
  lead: { title: "Lead review", description: "Step 1 of 2 — your decision is logged on the contribution." },
  manager: { title: "Final approval", description: "Step 2 of 2 — approving publishes the contribution.", approveLabel: "Approve & publish" },
};

/** Lead step or Manager step decision, with a comment (required unless approving). Logged on the timeline. */
export function ReviewModal({ open, onClose, stage, onDecide, decisions = DECISIONS, copy = COPY }) {
  const [decision, setDecision] = useState("approve");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDecision("approve");
      setComment("");
      setError("");
    }
  }, [open]);

  const save = async () => {
    if (decision !== "approve" && !comment.trim()) return setError(chosen.commentError ?? "Explain what's missing or why it's declined");
    setBusy(true);
    const ok = await onDecide({ decision, comment });
    setBusy(false);
    if (ok) onClose();
  };

  const chosen = decisions.find((d) => d.value === decision);
  const text = copy[stage];
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={text.title}
      description={text.description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={chosen.danger ? "danger" : "primary"} onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {(chosen.value === "approve" && text.approveLabel) || chosen.label}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Decision" className="grid gap-2 sm:grid-cols-3">
          {decisions.map((d) => (
            <label
              key={d.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 text-xs font-bold transition-all focus-within:ring-2 focus-within:ring-nu-purple",
                decision === d.value ? "border-nu-purple bg-purple-50 text-nu-purple" : "border-gray-200 text-nu-navy hover:bg-gray-50",
              )}
            >
              <input type="radio" name="decision" value={d.value} checked={decision === d.value} onChange={() => { setDecision(d.value); setError(""); }} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-nu-muted-teal">{chosen.hint[stage]}</p>
        <Field id="review-comment" label={decision === "approve" ? "Comment (optional)" : "Comment *"} error={error} hint="Markdown supported">
          {(p) => <Textarea {...p} rows={5} value={comment} onChange={(e) => setComment(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
