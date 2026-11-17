"use client";

import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/layout";
import { Badge, Card, CardHeader, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";

function Settings() {
  const { me } = useSession();
  return (
    <>
      <PageHeader title="Settings" description="Your account and what your roles let you do" />

      <Card>
        <CardHeader title="Account" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PersonChip person={me} subtitle={me.username} size="lg" />
          <Badge variant="warning">Signed in with dev password</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title="Your role assignments" description="Roles granted at a parent scope apply to everything under it." />
        <Table>
          <THead>
            <TR>
              <TH>Role</TH>
              <TH>Scope</TH>
              <TH>Permissions</TH>
            </TR>
          </THead>
          <TBody>
            {me.grants.map((g) => (
              <TR key={g._id}>
                <TD className="font-semibold text-nu-navy">{g.roleName}</TD>
                <TD>
                  <Badge variant="primary">{g.scopeLabel}</Badge>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {g.permissions.map((p) => (
                      <code key={p} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-nu-dark-teal">{p === "*" ? "* (everything)" : p}</code>
                    ))}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

export default function SettingsPage() {
  return (
    <PortalShell breadcrumbs={[{ label: "Home", href: "/" }, { label: "Settings" }]}>
      <Settings />
    </PortalShell>
  );
}
