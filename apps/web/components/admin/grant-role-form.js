"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Field, Select, useToast } from "@/components/ui";
import { api } from "@/lib/api";

const keyOf = (s) => `${s.type}:${s.id ?? ""}`;
const GROUPS = [
  { type: "platform", label: "Platform" },
  { type: "app", label: "Apps" },
  { type: "practice", label: "Practices" },
];

/**
 * Scope first, then the roles grantable there — roles are tied to a scope level, so picking a role first
 * made people guess which role fits where. Both lists come from /rbac/assignable (escalation guard).
 */
export function GrantRoleForm({ userId, assignable, onGranted }) {
  const toast = useToast();
  const [scopeKey, setScopeKey] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);

  // Invert role → scopes into scope → roles.
  const scopes = useMemo(() => {
    const byKey = new Map();
    for (const o of assignable) {
      for (const s of o.scopes) {
        const k = keyOf(s);
        if (!byKey.has(k)) byKey.set(k, { ...s, key: k, roles: [] });
        byKey.get(k).roles.push({ roleId: o.roleId, roleName: o.roleName });
      }
    }
    return [...byKey.values()];
  }, [assignable]);

  if (assignable.length === 0) {
    return <p className="mt-5 text-[11px] text-gray-400">You can't grant roles — that needs practices.roles.assign or platform.apps.assign.</p>;
  }

  const scope = scopes.length === 1 ? scopes[0] : scopes.find((s) => s.key === scopeKey);
  const roles = scope?.roles ?? [];
  const role = roles.length === 1 ? roles[0] : roles.find((r) => r.roleId === roleId);

  async function onSubmit(e) {
    e.preventDefault();
    if (!scope || !role) return;
    setBusy(true);
    try {
      await api("/rbac/assignments", { method: "POST", body: { userId, roleId: role.roleId, scopeType: scope.type, scopeId: scope.id } });
      toast(`Granted ${role.roleName} @ ${scope.label}`);
      setRoleId("");
      setScopeKey("");
      await onGranted();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-dashed border-gray-200 p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-nu-navy">Grant a role</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="grant-scope" label="Scope" hint="Where the role applies">
          <Select id="grant-scope" required value={scope ? scope.key : scopeKey} onChange={(e) => { setScopeKey(e.target.value); setRoleId(""); }}>
            <option value="">Select a scope</option>
            {GROUPS.map((g) => {
              const items = scopes.filter((s) => s.type === g.type);
              return items.length ? (
                <optgroup key={g.type} label={g.label}>
                  {items.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </optgroup>
              ) : null;
            })}
          </Select>
        </Field>
        <Field id="grant-role" label="Role" hint="Only roles you're allowed to grant here">
          <Select id="grant-role" required disabled={!scope} value={role ? role.roleId : roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">{scope ? "Select a role" : "Pick a scope first"}</option>
            {roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" variant="dark" disabled={busy || !scope || !role}>
          <Plus aria-hidden="true" /> {busy ? "Granting…" : "Grant role"}
        </Button>
      </div>
    </form>
  );
}
