"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { invitedEmail, PersonSelect } from "./person-select";

/**
 * Choose the practice's Manager or a group's Lead. There's one of each, so picking someone replaces the current holder —
 * the modal says who. With `canInvite`, an email that isn't on Practise360 yet can be invited into the role instead.
 * `target` = { kind: "manager" | "lead", title, path, invitePath, groupId?, current, pending?, people, loading, note, canInvite }.
 */
export function ChooseHolderModal({ target, onClose, onSaved }) {
  const toast = useToast();
  const [userId, setUserId] = useState("");
  const [keepPrevious, setKeepPrevious] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const open = !!target;

  useEffect(() => {
    if (open) {
      setUserId("");
      setKeepPrevious(true);
      setError("");
    }
  }, [open]);

  if (!target) return null;
  const { kind, title, path, invitePath, groupId, current, pending, people, loading, note, emptyText, canInvite } = target;
  const role = kind === "manager" ? "Manager" : "Lead";
  const email = invitedEmail(userId);
  const replacing = current && userId && userId !== current.id;

  const save = async () => {
    if (!userId) return setError(`Pick the new ${role}`);
    setBusy(true);
    try {
      if (email) {
        onSaved(await api(invitePath, { method: "POST", body: { email, kind, groupId, ...(kind === "manager" && { keepPrevious }) } }));
      } else {
        const updated = await api(path, { method: "PUT", body: { userId, ...(kind === "manager" && { keepPrevious }) } });
        toast(`${people.find((p) => p.id === userId)?.displayName ?? "They"} is now ${role}`);
        onSaved(updated);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const status = current ? `Currently ${current.displayName}. There's one ${role} — choosing someone else replaces them.` : `No ${role} yet.`;
  const description = pending ? `${status} ${pending.email} is invited — choosing or inviting someone else cancels that invitation.` : status;

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !userId || userId === current?.id}>
            {busy && <Loader2 className="animate-spin" />} {email ? "Send invite" : replacing ? `Replace ${role}` : `Make ${role}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PersonSelect
          id={`choose-${kind}`}
          label={`New ${role}`}
          people={people}
          loading={loading}
          value={userId}
          onChange={setUserId}
          note={note}
          emptyText={emptyText}
          allowInvite={canInvite}
        />
        {email && (
          <p className="text-xs text-nu-muted-teal">
            {kind === "manager"
              ? `${email} becomes the Manager when they accept the invitation${current ? `, replacing ${current.displayName}` : ""}.`
              : `${email} joins the practice and leads this group when they accept${current ? `, replacing ${current.displayName}` : ""}.`}
          </p>
        )}
        {replacing && kind === "manager" && (
          <label className="flex items-start gap-2 text-xs text-nu-dark-teal">
            <input type="checkbox" checked={keepPrevious} onChange={(e) => setKeepPrevious(e.target.checked)} className="mt-0.5 size-4 accent-nu-purple" />
            <span>Keep {current.displayName} in the practice as a Practitioner (their contributions, plans and group stay as they are)</span>
          </label>
        )}
        {replacing && kind === "lead" && (
          <p className="text-xs text-nu-muted-teal">{current.displayName} stays in the practice and in their group — only the Lead role moves.</p>
        )}
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
