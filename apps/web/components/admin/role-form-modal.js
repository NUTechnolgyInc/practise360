"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useSession } from "@/components/auth/session-provider";
import { api } from "@/lib/api";

/**
 * Create/edit a custom role, or edit a system role (Super Admin only).
 * Custom: only permissions the actor holds in that practice are offered. System: the whole catalog, minus
 * platform.* on non-platform roles. The API re-checks both.
 */
export function RoleFormModal({ role, catalog, practices, onClose, onSaved }) {
  const isSystem = !!role?.isSystem;
  const toast = useToast();
  const { can } = useSession();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [practiceId, setPracticeId] = useState(role?.scopeId ?? practices[0]?.id ?? "");
  const [perms, setPerms] = useState(new Set(role?.permissions ?? []));
  const [busy, setBusy] = useState(false);

  const scope = { type: "practice", id: practiceId };
  const offered = isSystem
    ? catalog.permissions.filter((p) => role.scopeType === "platform" || !p.key.startsWith("platform."))
    : catalog.permissions.filter((p) => catalog.customRolePermissions.includes(p.key) && can(p.key, scope));
  const toggle = (key) => setPerms((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    const body = isSystem ? { name, description, permissions: [...perms] } : { name, description, practiceId, permissions: [...perms] };
    try {
      await api(role ? `/rbac/roles/${role.id}` : "/rbac/roles", { method: role ? "PATCH" : "POST", body });
      toast(role ? `Saved ${name}` : `Created ${name}`);
      await onSaved();
      onClose();
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isSystem ? "Edit system role" : role ? "Edit custom role" : "New custom role"}
      description={
        isSystem
          ? `Changes apply right away to everyone holding ${role.name} (${role.assignmentCount} assigned). Scope stays ${role.scopeType}.`
          : "Custom roles can only be assigned inside their practice."
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="role-form" disabled={busy || !name.trim() || perms.size === 0}>{busy ? "Saving…" : "Save role"}</Button>
        </>
      }
    >
      <form id="role-form" onSubmit={onSubmit} className="space-y-4">
        <Field id="role-name" label="Name">
          <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Practice Coordinator" />
        </Field>
        <Field id="role-desc" label="Description">
          <Textarea id="role-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {!isSystem && (
          <Field id="role-practice" label="Practice" hint={role ? "A role stays in the practice it was created in." : undefined}>
            <Select id="role-practice" value={practiceId} disabled={!!role} onChange={(e) => { setPracticeId(e.target.value); setPerms(new Set()); }}>
              {practices.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        )}
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-nu-navy">Permissions</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {offered.map((p) => (
              <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-xl p-2 hover:bg-gray-50">
                <input type="checkbox" className="mt-0.5 accent-nu-purple" checked={perms.has(p.key)} onChange={() => toggle(p.key)} />
                <span>
                  <span className="block font-mono text-[11px] font-semibold text-nu-lapis">{p.key}</span>
                  <span className="block text-[11px] text-gray-500">{p.description}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {isSystem
              ? "Whoever grants this role must hold every permission in it — e.g. adding to Practice Manager also needs adding to Practices Admin, or Practices Admin can no longer appoint Managers."
              : "Only permissions you hold in this practice are listed — you can't grant more than you have."}
          </p>
        </fieldset>
      </form>
    </Modal>
  );
}
