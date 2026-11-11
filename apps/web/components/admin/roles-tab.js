"use client";

import { useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardHeader, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { RoleFormModal } from "./role-form-modal";

const scopeText = (role, practices) =>
  role.scopeType === "practice" && role.scopeId ? practices.find((p) => p.id === role.scopeId)?.name ?? role.scopeId : role.scopeId ?? role.scopeType;

/** `managePractices` = practices where the viewer holds practices.roles.manage (decided by the page via can()). */
export function RolesTab({ roles, catalog, managePractices, onChanged }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null); // role, or {} for new
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api(`/rbac/roles/${deleting.id}`, { method: "DELETE" });
      toast(`Deleted ${deleting.name}`);
      setDeleting(null);
      await onChanged();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Roles"
        description="System roles come from the RBAC design; only Super Admin can edit them. Custom roles belong to one practice."
        actions={managePractices.length > 0 && <Button onClick={() => setEditing({})}><Plus aria-hidden="true" /> New custom role</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className="rounded-2xl border border-gray-200 p-5">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold">
                  {r.name}
                  {r.isSystem && <Lock className="size-3.5 text-gray-400" aria-label="System role" />}
                </h3>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant={r.isSystem ? "neutral" : "purple"}>{r.isSystem ? "System" : "Custom"}</Badge>
                  <Badge variant="primary">{r.scopeType} · {scopeText(r, catalog.practices)}</Badge>
                  <Badge variant="teal">{r.assignmentCount} assigned</Badge>
                </div>
              </div>
              {r.canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil /></Button>
                  {!r.isSystem && <Button variant="ghost" size="icon" aria-label={`Delete ${r.name}`} onClick={() => setDeleting(r)}><Trash2 /></Button>}
                </div>
              )}
            </div>
            {r.description && <p className="mb-2 text-xs text-nu-muted-teal">{r.description}</p>}
            <div className="flex flex-wrap gap-1">
              {r.permissions.map((p) => (
                <code key={p} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px]">{p === "*" ? "* (everything)" : p}</code>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RoleFormModal role={editing.id ? editing : null} catalog={catalog} practices={managePractices} onClose={() => setEditing(null)} onSaved={onChanged} />
      )}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete custom role?"
        className="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete role"}</Button>
          </>
        }
      >
        {deleting && <p className="text-sm">Delete <strong>{deleting.name}</strong>? Roles still assigned to someone can't be deleted.</p>}
      </Modal>
    </Card>
  );
}
