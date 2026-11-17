"use client";

import { useState } from "react";
import { Check, Gavel, Send, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui";
import { JoinModal } from "./edit-modals";
import { ReviewModal } from "./review-modal";
import { SubmitModal } from "./submit-modal";

/**
 * Header buttons driven by the API's `actions` (computed by the same rules the API enforces).
 * At most one is primary: the most important thing this viewer can do next.
 */
export function ContributionActions({ contribution: c, run, onFilesAdded }) {
  const [modal, setModal] = useState(null);
  const { actions } = c;
  const base = `/contributions/${c.id}`;
  const close = () => setModal(null);

  const buttons = [
    actions.submit && { key: "submit", icon: Send, label: c.status === "clarification" ? "Reply and resubmit" : "Submit for review", onClick: () => setModal("submit") },
    actions.review && { key: "review", icon: Gavel, label: "Review", onClick: () => setModal("review") },
    actions.approve && { key: "approve", icon: Gavel, label: "Final approval", onClick: () => setModal("review") },
    actions.respondInvite && { key: "accept", icon: Check, label: "Accept invite", onClick: () => run(`${base}/invites/respond`, { method: "POST", body: { accept: true } }, "You're now a contributor") },
    actions.respondInvite && { key: "decline", icon: X, label: "Decline invite", onClick: () => run(`${base}/invites/respond`, { method: "POST", body: { accept: false } }, "Invite declined") },
    actions.requestJoin && { key: "join", icon: UserPlus, label: "Ask to join", onClick: () => setModal("join") },
    actions.cancelRequest && { key: "cancel", icon: X, label: "Cancel join request", onClick: () => run(`${base}/join-requests/mine`, { method: "DELETE" }, "Request cancelled") },
  ].filter(Boolean);

  const stage = c.status === "manager_review" ? "manager" : "lead";
  return (
    <>
      {buttons.map(({ key, icon: Icon, label, onClick }, i) => (
        <Button key={key} variant={i === 0 && key !== "decline" && key !== "cancel" ? "primary" : "secondary"} onClick={onClick}>
          <Icon /> {label}
        </Button>
      ))}
      {actions.submit && (
        <SubmitModal
          open={modal === "submit"}
          onClose={close}
          contribution={c}
          onFilesAdded={onFilesAdded}
          onSubmit={(form) => run(`${base}/submit`, { method: "POST", body: form }, c.status === "clarification" ? "Resubmitted" : "Submitted for review")}
        />
      )}
      {(actions.review || actions.approve) && (
        <ReviewModal
          open={modal === "review"}
          onClose={close}
          stage={stage}
          onDecide={(body) => run(`${base}/review`, { method: "POST", body }, body.decision === "approve" ? (stage === "manager" ? "Approved and published" : "Approved — sent to the Practice Manager") : "Decision recorded")}
        />
      )}
      {actions.requestJoin && <JoinModal open={modal === "join"} onClose={close} onSend={(message) => run(`${base}/join-requests`, { method: "POST", body: { message } }, "Request sent")} />}
    </>
  );
}
