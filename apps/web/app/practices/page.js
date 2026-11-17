"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Button, EmptyState, StatsToggle, StatTile } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { NewPracticeModal } from "@/components/practices/new-practice-modal";
import { PracticeCard } from "@/components/practices/practice-card";
import { PracticesNav } from "@/components/practices/practices-nav";
import { useResource } from "@/hooks/use-resource";
import { useShowStats } from "@/hooks/use-show-stats";

/** Who runs the Practices app, under the page title. */
function AdminsLine({ admins }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-bold uppercase tracking-wider text-nu-navy">{admins.length === 1 ? "Practices Admin" : "Practices Admins"}</span>
      {admins.map((a) => <PersonLink key={a.id} person={a} avatar className="font-semibold text-nu-navy" />)}
    </span>
  );
}

function Overview() {
  const router = useRouter();
  const { data, loading, error } = useResource("/practices");
  const [creating, setCreating] = useState(false);
  const [showStats, toggleStats] = useShowStats();
  const practices = data?.practices ?? [];
  const admins = data?.admins ?? [];
  const sum = (fn) => practices.reduce((n, p) => n + fn(p), 0);
  const withoutLead = sum((p) => p.groups.filter((g) => !g.lead).length);
  const hasStats = practices.length > 1;

  return (
    <>
      <PracticesNav current="/practices" />
      <PageHeader
        title="Practices"
        description={admins.length > 0 && <AdminsLine admins={admins} />}
        actions={
          (hasStats || data?.canCreate) && (
            <>
              {hasStats && <StatsToggle shown={showStats} onToggle={toggleStats} controls="practices-stats" />}
              {data?.canCreate && (
                <Button onClick={() => setCreating(true)}>
                  <Plus /> New practice
                </Button>
              )}
            </>
          )
        }
      />

      {loading && !data ? (
        <p className="flex items-center justify-center py-12 text-sm text-nu-muted-teal" role="status">
          <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading practices…
        </p>
      ) : error ? (
        <EmptyState title="Couldn't load practices" description={error} />
      ) : practices.length === 0 ? (
        <EmptyState icon={Building2} title="No practices yet" description={data?.canCreate ? "Create the first practice and choose its Manager." : "You aren't in a practice yet."} />
      ) : (
        <>
          {hasStats && (
            <div id="practices-stats" hidden={!showStats} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Practices" value={practices.length} tone="purple" />
              <StatTile label="Groups" value={sum((p) => p.groups.length)} tone="info" />
              <StatTile label="Members" value={sum((p) => p.memberCount)} tone="neutral" />
              <StatTile label="Groups without a Lead" value={withoutLead} tone={withoutLead ? "danger" : "success"} />
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            {practices.map((p) => <PracticeCard key={p.id} practice={p} />)}
          </div>
        </>
      )}

      <NewPracticeModal open={creating} onClose={() => setCreating(false)} onCreated={(p) => router.push(`/practices/${p.id}`)} />
    </>
  );
}

export default function PracticesPage() {
  return (
    <PortalShell requires={["practices.practice.view"]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices" }]}>
      <Overview />
    </PortalShell>
  );
}
