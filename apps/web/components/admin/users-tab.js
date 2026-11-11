"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Input, Table, TBody, TD, TH, THead, TR, UserChip } from "@/components/ui";
import { UserAccessModal } from "./user-access-modal";

export function UsersTab({ users, assignable, onChanged }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const canAssign = assignable.length > 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => `${u.displayName} ${u.username}`.toLowerCase().includes(q)) : users;
  }, [users, query]);
  const selected = users.find((u) => u.id === selectedId);

  return (
    <Card>
      <CardHeader
        title="Users & assignments"
        description="Showing role assignments in the scopes you can see."
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <Input aria-label="Search users" placeholder="Search users" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        }
      />
      {filtered.length === 0 ? (
        <EmptyState title="No users match" description="Try a different name or username." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>User</TH>
              <TH>Assignments</TH>
              <TH className="text-right">
                <span className="sr-only">Actions</span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD>
                  <UserChip name={u.displayName} subtitle={u.username} />
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {u.assignments.length === 0 ? (
                      <span className="text-[11px] text-gray-400">None in your scopes</span>
                    ) : (
                      u.assignments.map((a) => (
                        <Badge key={a.id} variant="primary">{a.roleName} @ {a.scopeLabel}</Badge>
                      ))
                    )}
                  </div>
                </TD>
                <TD className="text-right">
                  <Button variant="secondary" size="sm" onClick={() => setSelectedId(u.id)}>
                    {canAssign ? "Manage" : "View"}
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {selected && <UserAccessModal user={selected} assignable={assignable} onClose={() => setSelectedId(null)} onChanged={onChanged} />}
    </Card>
  );
}
