"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Select, useToast } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { invitedEmail, PersonSelect } from "./person-select";

/**
 * Add someone to the practice as a Practitioner, optionally straight into a group (when the caller may place people).
 * Someone not on Practise360 yet is invited by email and joins when they accept.
 */
export function AddMemberModal({ open, practice, canPlace, onClose, onSaved }) {
  const toast = useToast();
  const people = useResource(open ? "/practices/people" : null);
  const [userId, setUserId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setUserId("");
      setGroupId("");
      setError("");
    }
  }, [open]);

  const inPractice = new Set((practice.members ?? []).map((m) => m.id));
  const candidates = (people.data ?? []).filter((p) => !inPractice.has(p.id));
  const email = invitedEmail(userId);

  const save = async () => {
    if (!userId) return setError("Pick someone to add, or enter an email to invite");
    setBusy(true);
    try {
      if (email) {
        onSaved(await api(`/practices/${practice.id}/invites`, { method: "POST", body: { email, kind: "member", groupId: groupId || undefined } }));
        return;
      }
      const updated = await api(`/practices/${practice.id}/members`, { method: "POST", body: { userId, groupId: groupId || undefined } });
      toast(`Added ${candidates.find((p) => p.id === userId)?.displayName ?? "them"} to ${practice.name}`);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add someone to ${practice.name}`}
      description="They join as a Practitioner. Not on Practise360 yet? Enter their email to invite them. Other roles are granted from Access control."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !userId}>
            {busy && <Loader2 className="animate-spin" />} {email ? "Send invite" : "Add to practice"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <PersonSelect
          id="add-member"
          label="Person"
          people={candidates}
          loading={people.loading}
          value={userId}
          onChange={setUserId}
          emptyText="Everyone on Practise360 is already in this practice"
          allowInvite
        />
        {canPlace && practice.groups.length > 0 && (
          <Field id="add-member-group" label="Group" hint={email ? "Optional — they join it when they accept" : "Optional — whose Lead reviews their work"}>
            {(p) => (
              <Select {...p} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">Not in a group yet</option>
                {practice.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            )}
          </Field>
        )}
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
