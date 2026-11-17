"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Select, useToast } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { AddByEmailField, AddModeTabs, addCountLabel, splitValid } from "./add-by-email";
import { invitedEmail, PersonSelect } from "./person-select";

/**
 * Add someone to the practice as a Practitioner, optionally straight into a group (when the caller may place people).
 * Someone not on Practise360 yet is invited by email and joins when they accept. "Add by email" takes several addresses
 * at once; `onSaved` then also gets `results` (one per address) to announce.
 */
export function AddMemberModal({ open, practice, canPlace, onClose, onSaved }) {
  const toast = useToast();
  const people = useResource(open ? "/practices/people" : null);
  const [mode, setMode] = useState("pick");
  const [userId, setUserId] = useState("");
  const [emails, setEmails] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("pick");
      setUserId("");
      setEmails([]);
      setGroupId("");
      setError("");
    }
  }, [open]);

  const inPractice = new Set((practice.members ?? []).map((m) => m.id));
  const candidates = (people.data ?? []).filter((p) => !inPractice.has(p.id));
  const email = invitedEmail(userId);
  const bulk = mode === "email";
  const { valid, invalid } = splitValid(emails);
  const ready = bulk ? valid.length > 0 && invalid.length === 0 : !!userId;

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const save = async () => {
    if (!ready) return setError(bulk ? "Enter at least one email address" : "Pick someone to add, or enter an email to invite");
    setBusy(true);
    try {
      if (bulk) {
        onSaved(await api(`/practices/${practice.id}/invites/bulk`, { method: "POST", body: { emails: valid, groupId: groupId || undefined } }));
        return;
      }
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
      title={`Add people to ${practice.name}`}
      description="They join as Practitioners. Not on Practise360 yet? Invite them by email. Other roles are granted from Access control."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !ready}>
            {busy && <Loader2 className="animate-spin" />} {bulk ? addCountLabel(valid.length) : email ? "Send invite" : "Add to practice"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AddModeTabs value={mode} onChange={switchMode} />
        {bulk ? (
          <AddByEmailField id="add-member-emails" value={emails} onChange={setEmails} />
        ) : (
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
        )}
        {canPlace && practice.groups.length > 0 && (
          <Field id="add-member-group" label="Group" hint={bulk ? "Optional — everyone goes into it; invited people when they accept" : email ? "Optional — they join it when they accept" : "Optional — whose Lead reviews their work"}>
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
