"use client";

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/layout";
import { EmptyState, StatsToggle, StatTile, Tabs } from "@/components/ui";
import { UsersTab } from "@/components/admin/users-tab";
import { RolesTab } from "@/components/admin/roles-tab";
import { PermissionMatrix } from "@/components/admin/permission-matrix";
import { useRbacData } from "@/hooks/use-rbac-data";
import { useShowStats } from "@/hooks/use-show-stats";
import { RBAC_PORTAL_PERMS } from "@/lib/can";

const TABS = [
  { value: "users", label: "Users" },
  { value: "roles", label: "Roles" },
  { value: "matrix", label: "Permissions" },
];

function AccessControl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { can } = useSession();
  const { users, roles, catalog, assignable, loading, error, reload } = useRbacData();
  const [showStats, toggleStats] = useShowStats();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "users";

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading access data…
      </div>
    );
  }
  if (error) return <EmptyState title="Couldn't load access data" description={error} />;

  const managePractices = catalog.practices.filter((p) => can("practices.roles.manage", { type: "practice", id: p.id }));
  const assignedCount = users.reduce((n, u) => n + u.assignments.length, 0);

  return (
    <>
      <PageHeader
        title="Access control"
        description="Assign roles to people and manage custom roles. You only see and grant what your own roles allow."
        actions={
          <>
            <StatsToggle shown={showStats} onToggle={toggleStats} controls="access-stats" />
            <Tabs aria-label="Access control sections" tabs={TABS} value={tab} onChange={(v) => router.replace(`${pathname}?tab=${v}`)} />
          </>
        }
      />
      <div id="access-stats" hidden={!showStats} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="Users" value={users.length} tone="purple" />
        <StatTile label="Assignments you can see" value={assignedCount} tone="info" />
        <StatTile label="Roles" value={roles.length} hint={`${roles.filter((r) => !r.isSystem).length} custom`} tone="neutral" />
        <StatTile label="Roles you can grant" value={assignable.length} tone="success" />
      </div>
      {tab === "users" && <UsersTab users={users} assignable={assignable} onChanged={reload} />}
      {tab === "roles" && <RolesTab roles={roles} catalog={catalog} managePractices={managePractices} onChanged={reload} />}
      {tab === "matrix" && <PermissionMatrix roles={roles} catalog={catalog} />}
    </>
  );
}

export default function AccessControlPage() {
  return (
    <PortalShell requires={RBAC_PORTAL_PERMS} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Access control" }]}>
      <Suspense>
        <AccessControl />
      </Suspense>
    </PortalShell>
  );
}
