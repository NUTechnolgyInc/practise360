"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useScopeRolePicker } from "./grant-role-form";

/**
 * Give a role to someone who hasn't signed in yet (docs/rbac.md §4 "Adding someone by email"). The API creates their
 * account with the role straight away, so it's there on their first sign-in. Roles/scopes come from /rbac/assignable.
 */
export function AddByEmailModal({ assignable, onClose, onAdded }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const { scope, role, fields } = useScopeRolePicker(assignable, "add-email");

  async function onSubmit(e) {
    e.preventDefault();
    if (!scope || !role) return;
    setBusy(true);
    try {
      const res = await api("/rbac/users", {
        method: "POST",
        body: { email: email.trim(), displayName: displayName.trim() || undefined, roleId: role.roleId, scopeType: scope.type, scopeId: scope.id },
      });
      const what = `${role.roleName} @ ${scope.label}`;
      toast(res.created ? `Added ${res.displayName} as ${what} — it's ready when they sign in` : `${res.displayName} already had an account — granted ${what}`);
      await onAdded();
      onClose();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add by email"
      description="For someone who hasn't signed in yet. They get this role as soon as they sign in with this email."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-by-email-form" disabled={busy || !email.trim() || !scope || !role}>
            {busy ? "Adding…" : "Add person"}
          </Button>
        </>
      }
    >
      <form id="add-by-email-form" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <Field id="add-email-email" label="Email" hint="The address they'll sign in with">
          <Input id="add-email-email" type="email" required autoComplete="off" placeholder="name@nulogic.io" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="add-email-name" label="Name (optional)" hint="Made from the email if left blank">
          <Input id="add-email-name" maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Field>
        {fields}
      </form>
    </Modal>
  );
}
