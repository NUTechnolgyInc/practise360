"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge, Button, EmptyState, Modal, useToast } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { api } from "@/lib/api";
import { GrantRoleForm } from "./grant-role-form";

/** One user's assignments: revoke (guarded per assignment by the API's escalation check) and grant new roles. */
export function UserAccessModal({ user, assignable, onClose, onChanged }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);

  async function revoke() {
    setBusy(true);
    try {
      await api(`/rbac/assignments/${confirming.id}`, { method: "DELETE" });
      toast(`Removed ${confirming.roleName} @ ${confirming.scopeLabel}`);
      setConfirming(null);
      await onChanged();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open onClose={onClose} title="Manage access" description="Changes apply on the user's next request.">
        <PersonChip person={user} subtitle={user.username} size="lg" className="mb-5" />
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-nu-navy">Current roles</h3>
        {user.assignments.length === 0 ? (
          <EmptyState title="No roles in your scopes" className="p-6" />
        ) : (
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-200">
            {user.assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-nu-navy">{a.roleName}</span>
                  <Badge variant="primary">{a.scopeLabel}</Badge>
                </div>
                {a.canRevoke && (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${a.roleName} at ${a.scopeLabel}`} onClick={() => setConfirming(a)}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        <GrantRoleForm userId={user.id} assignable={assignable} onGranted={onChanged} />
      </Modal>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Remove role?"
        className="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)}>Cancel</Button>
            <Button variant="danger" onClick={revoke} disabled={busy}>{busy ? "Removing…" : "Remove role"}</Button>
          </>
        }
      >
        {confirming && (
          <p className="text-sm">
            {user.displayName} will lose <strong>{confirming.roleName}</strong> in <strong>{confirming.scopeLabel}</strong> and every permission it gives.
          </p>
        )}
      </Modal>
    </>
  );
}
