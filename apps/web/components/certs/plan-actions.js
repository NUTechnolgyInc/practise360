"use client";

import { useState } from "react";
import { Check, Gavel, Send, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { ReviewModal } from "@/components/contributions/review-modal";
import { CompletionModal } from "./completion-modal";
import { ConfirmModal } from "./confirm-modal";
import { AcceptModal } from "./plan-modals";
import { plansPath } from "@/lib/certifications";

const DECISIONS = [
  { value: "approve", label: "Approve", hint: { lead: "Sends it to the Practice Manager for final approval.", manager: "Marks the certification completed (and approves any reimbursement)." } },
  { value: "clarify", label: "Ask for clarification", hint: { lead: "Sends it back to the member; it returns to you after they reply.", manager: "Sends it back to the member; it returns to you after they reply." } },
  {
    value: "reject",
    label: "Reject",
    danger: true,
    commentError: "Explain why it's rejected",
    hint: { lead: "Reopens the plan so the member can fix it and resubmit from the Lead step.", manager: "Reopens the plan so the member can fix it and resubmit from the Lead step." },
  },
];
const COPY = {
  lead: { title: "Lead review", description: "Step 1 of 2 — check the certificate and the verification link." },
  manager: { title: "Final approval", description: "Step 2 of 2 — approving marks it completed.", approveLabel: "Approve & complete" },
};

// Closing actions share one confirmation modal; each says who's affected and what's logged.
const CLOSERS = {
  decline: { label: "Decline", title: "Decline this recommendation?", reasonLabel: "Why not?", toast: "Recommendation declined" },
  drop: { label: "Drop plan", title: "Drop this plan?", reasonLabel: "Reason", toast: "Plan dropped" },
  withdraw: { label: "Withdraw", title: "Withdraw it?", reasonLabel: "Reason", toast: "Withdrawn" },
};

/**
 * Header buttons driven by the API's `actions` (the same rules the API enforces).
 * At most one is primary: the most important thing this viewer can do next.
 */
export function PlanActions({ plan: p, run, onFilesAdded }) {
  const [modal, setModal] = useState(null);
  const { actions } = p;
  const base = plansPath(p.id);
  const close = () => setModal(null);
  const stage = p.status === "manager_review" ? "manager" : "lead";

  const buttons = [
    actions.accept && { key: "accept", icon: Check, label: "Accept", primary: true },
    actions.submit && { key: "submit", icon: Send, label: p.status === "clarification" ? "Reply and resubmit" : "Submit completion", primary: true },
    actions.review && { key: "review", icon: Gavel, label: "Review", primary: true },
    actions.approve && { key: "review", icon: Gavel, label: "Final approval", primary: true },
    actions.decline && { key: "decline", icon: X, label: CLOSERS.decline.label },
    actions.drop && { key: "drop", icon: Undo2, label: CLOSERS.drop.label },
    actions.withdraw && { key: "withdraw", icon: Undo2, label: CLOSERS.withdraw.label },
  ].filter(Boolean);
  const closer = CLOSERS[modal];

  return (
    <>
      {buttons.map(({ key, icon: Icon, label, primary }, i) => (
        <Button key={label} variant={primary && i === 0 ? "primary" : "secondary"} onClick={() => setModal(key)}>
          <Icon /> {label}
        </Button>
      ))}
      {actions.accept && <AcceptModal open={modal === "accept"} onClose={close} plan={p} onSave={(body) => run(`${base}/accept`, { method: "POST", body }, "Added to your plans")} />}
      {actions.submit && (
        <CompletionModal
          open={modal === "submit"}
          onClose={close}
          plan={p}
          onFilesAdded={onFilesAdded}
          onSubmit={(body) => run(`${base}/submit`, { method: "POST", body }, p.status === "clarification" ? "Resubmitted" : "Submitted for approval")}
        />
      )}
      {(actions.review || actions.approve) && (
        <ReviewModal
          open={modal === "review"}
          onClose={close}
          stage={stage}
          decisions={DECISIONS}
          copy={COPY}
          onDecide={(body) => run(`${base}/review`, { method: "POST", body }, body.decision === "approve" ? (stage === "manager" ? "Approved — marked completed" : "Approved — sent to the Practice Manager") : "Decision recorded")}
        />
      )}
      <ConfirmModal
        open={!!closer}
        onClose={close}
        title={closer?.title}
        description={p.cert.title}
        reasonLabel={closer?.reasonLabel}
        confirmLabel={closer?.label}
        onConfirm={(reason) => run(`${base}/${modal}`, { method: "POST", body: { reason } }, closer.toast)}
      />
    </>
  );
}
