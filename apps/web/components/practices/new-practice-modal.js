"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { announceInvite, InviteSentModal } from "./invite-sent-modal";
import { invitedEmail, PersonSelect } from "./person-select";

const EMPTY = { name: "", description: "", managerId: "" };

/**
 * Practices Admin: create a practice and (optionally) choose its Manager in one go. The Manager can be someone not on
 * Practise360 yet — the practice is created, then they're invited and become Manager when they accept.
 */
export function NewPracticeModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const people = useResource(open ? "/practices/people" : null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Set when the invitation wasn't emailed: the dialog with the join link shows before moving on to the practice.
  const [sent, setSent] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError("");
      setSent(null);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give the practice a name");
    const email = invitedEmail(form.managerId);
    setBusy(true);
    try {
      const created = await api("/practices", { method: "POST", body: { ...form, managerId: (!email && form.managerId) || undefined } });
      toast(`Created ${created.name}`);
      if (!email) return onCreated(created);
      try {
        const { invite } = await api(`/practices/${created.id}/invites`, { method: "POST", body: { email, kind: "manager" } });
        if (invite.delivery === "sent") {
          announceInvite(invite, { toast, role: "Manager" });
          onCreated(created);
        } else {
          setSent({ invite, created });
        }
      } catch (err) {
        toast(`${created.name} was created, but inviting ${email} failed: ${err.message}`, "error");
        onCreated(created);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <InviteSentModal invite={sent.invite} onClose={() => onCreated(sent.created)} />;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New practice"
      description="Practice Managers then create groups inside it and choose each group's Lead."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="new-practice-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} Create practice
          </Button>
        </>
      }
    >
      <form id="new-practice-form" onSubmit={submit} className="space-y-4">
        <Field id="practice-name" label="Name *" error={error && !form.name.trim() ? error : undefined}>
          {(p) => <Input {...p} required maxLength={80} placeholder="e.g. Data Engineering" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field id="practice-description" label="Description" hint="Optional — one line on what the practice covers">
          {(p) => <Textarea {...p} rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        <PersonSelect
          id="practice-manager"
          label="Practice Manager"
          people={people.data ?? []}
          loading={people.loading}
          value={form.managerId}
          onChange={(managerId) => setForm({ ...form, managerId })}
          allowInvite
        />
        <p className="-mt-2 text-[11px] text-gray-400">
          {invitedEmail(form.managerId)
            ? "They'll get an email to join Practise360 and become the Manager when they accept."
            : "Optional — you can choose the Manager later. Not on Practise360 yet? Enter their email to invite them."}
        </p>
        {error && form.name.trim() && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
