"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { invitedEmail, PersonSelect } from "./person-select";

/**
 * Create a group (with an optional Lead) or rename one. `group` = the group being renamed, or null to create.
 * `members` = practice members, for the Lead picker (shown only when creating and `canSetLead`). With `canInviteLead`,
 * the Lead can be someone not on Practise360 yet: the group is created, then they're invited to lead it.
 */
export function GroupFormModal({ open, practice, group, members, canSetLead, canInviteLead, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", description: "", leadId: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: group?.name ?? "", description: group?.description ?? "", leadId: "" });
      setError("");
    }
  }, [open, group]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give the group a name");
    setBusy(true);
    const email = invitedEmail(form.leadId);
    try {
      const path = group ? `/practices/${practice.id}/groups/${group.id}` : `/practices/${practice.id}/groups`;
      const body = group ? { name: form.name, description: form.description } : { ...form, leadId: (!email && form.leadId) || undefined };
      const updated = await api(path, { method: group ? "PATCH" : "POST", body });
      toast(group ? "Group updated" : `Created ${form.name.trim()}`);
      if (updated.warning) toast(updated.warning, "error");
      if (!email) return onSaved(updated);
      // The invitation needs the group's id, which the API picks — it's the one group that wasn't there before.
      const created = updated.groups.find((g) => !practice.groups.some((old) => old.id === g.id));
      try {
        onSaved(await api(`/practices/${practice.id}/invites`, { method: "POST", body: { email, kind: "lead", groupId: created?.id } }));
      } catch (err) {
        toast(`The group was created, but inviting ${email} failed: ${err.message}`, "error");
        onSaved(updated);
      }
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
      title={group ? `Rename ${group.name}` : `New group in ${practice.name}`}
      description={group ? undefined : "e.g. Fullstack, DevOps, Mobile App — each group gets its own Lead."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="group-form" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {group ? "Save" : "Create group"}
          </Button>
        </>
      }
    >
      <form id="group-form" onSubmit={submit} className="space-y-4">
        <Field id="group-name" label="Name *">
          {(p) => <Input {...p} required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field id="group-description" label="Description" hint="Optional">
          {(p) => <Textarea {...p} rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}
        </Field>
        {!group && canSetLead && (
          <>
            <PersonSelect
              id="group-lead"
              label="Lead"
              people={members}
              value={form.leadId}
              onChange={(leadId) => setForm({ ...form, leadId })}
              emptyText="Nobody in this practice yet — add members first"
              allowInvite={canInviteLead}
            />
            <p className="-mt-2 text-[11px] text-gray-400">
              {canInviteLead
                ? "Optional — you can choose the Lead later. Pick someone in the practice, or enter the email of someone new: they join the practice and lead this group when they accept."
                : "Optional — you can choose the Lead later. Only people already in the practice can lead a group."}
            </p>
          </>
        )}
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
