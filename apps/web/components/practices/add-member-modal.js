"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Select } from "@/components/ui";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { AddByEmailField, AddModeTabs, addCountLabel, addPicked, splitValid } from "./add-by-email";
import { PersonSelect, splitPicked } from "./person-select";

/**
 * Add people to the practice as Practitioners, optionally straight into a group (when the caller may place people).
 * "Pick someone" ticks several people at once, plus emails of people not on Practise360 yet (invited — they get access
 * when they sign in). "Add by email" takes a pasted list. `onSaved` gets the practice plus `results` to announce.
 */
export function AddMemberModal({ open, practice, canPlace, onClose, onSaved }) {
  const people = useResource(open ? "/practices/people" : null);
  const [mode, setMode] = useState("pick");
  const [picked, setPicked] = useState([]);
  const [emails, setEmails] = useState([]);
  const [groupId, setGroupId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("pick");
      setPicked([]);
      setEmails([]);
      setGroupId("");
      setError("");
    }
  }, [open]);

  const inPractice = new Set((practice.members ?? []).map((m) => m.id));
  const candidates = (people.data ?? []).filter((p) => !inPractice.has(p.id));
  const bulk = mode === "email";
  const { valid, invalid } = splitValid(emails);
  const ready = bulk ? valid.length > 0 && invalid.length === 0 : picked.length > 0;

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const save = async () => {
    if (!ready) return setError(bulk ? "Enter at least one email address" : "Pick someone to add, or enter an email to invite");
    setBusy(true);
    const group = groupId || undefined;
    const inviteMany = (list) => api(`/practices/${practice.id}/invites/bulk`, { method: "POST", body: { emails: list, groupId: group } });
    try {
      if (bulk) {
        onSaved(await inviteMany(valid));
        return;
      }
      const { userIds, emails: invites } = splitPicked(picked);
      onSaved(
        await addPicked({
          people: candidates.filter((p) => userIds.includes(p.id)),
          emails: invites,
          addOne: (p) => api(`/practices/${practice.id}/members`, { method: "POST", body: { userId: p.id, groupId: group } }),
          inviteMany,
          noteFor: () => `Added to ${practice.name}`,
        }),
      );
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
            {busy && <Loader2 className="animate-spin" />} {addCountLabel(bulk ? valid.length : picked.length)}
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
            label="People"
            people={candidates}
            loading={people.loading}
            value={picked}
            onChange={setPicked}
            emptyText="Everyone on Practise360 is already in this practice"
            allowInvite
            multiple
          />
        )}
        {canPlace && practice.groups.length > 0 && (
          <Field id="add-member-group" label="Group" hint={bulk || splitPicked(picked).emails.length ? "Optional — everyone goes into it; invited people when they sign in" : "Optional — everyone goes into it; its Lead reviews their work"}>
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
