"use client";

import { Suspense, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail, Pencil, UserCog } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Card, EmptyState, StatsToggle, StatTile, Tabs } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { OverviewTab } from "@/components/practices/overview-tab";
import { PracticeModals } from "@/components/practices/practice-modals";
import { ContributionsTab, StartContributionLink } from "@/components/practices/contributions-tab";
import { StructureTab } from "@/components/practices/structure-tab";
import { useResource } from "@/hooks/use-resource";
import { useShowStats } from "@/hooks/use-show-stats";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "groups", label: "Groups & members" },
  { value: "contributions", label: "Contributions" },
];

function Practice() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview";
  const { data: practice, setData, loading, error } = useResource(`/practices/${id}`);
  const [showStats, toggleStats] = useShowStats();
  // modal = { type: "edit" | "manager" | "lead" | "group" | "add" | "delete" | "removeLead", group? }
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  if (loading && !practice) {
    return (
      <p className="flex items-center justify-center py-12 text-sm text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading practice…
      </p>
    );
  }
  if (error) return <EmptyState title="Practice not found" description={error} />;

  const { actions, groups } = practice;
  const manager = practice.managers[0] ?? null;
  const managerInvite = practice.invites?.find((i) => i.kind === "manager") ?? null;

  return (
    <>
      <PageHeader
        back={{ href: "/practices", label: "Practices" }}
        title={practice.name}
        description={practice.description || undefined}
        actions={
          <>
            <StatsToggle shown={showStats} onToggle={toggleStats} controls="practice-stats" />
            {actions.update && (
              <Button variant="secondary" onClick={() => setModal({ type: "edit" })}>
                <Pencil /> Edit
              </Button>
            )}
            <StartContributionLink practiceId={practice.id} />
          </>
        }
      />

      <div id="practice-stats" hidden={!showStats} className="grid grid-cols-3 gap-3">
        <StatTile label="Members" value={practice.memberCount} tone="purple" />
        <StatTile label="Groups" value={groups.length} tone="info" />
        <StatTile label="Not in a group" value={practice.unassignedCount} tone={practice.unassignedCount ? "danger" : "success"} hint={practice.unassignedCount ? "The Manager covers them" : undefined} />
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-nu-navy">Practice Manager</p>
          {manager ? <PersonChip person={manager} subtitle={manager.email || manager.username} /> : !managerInvite && <Badge variant="warning">Not chosen yet</Badge>}
          {managerInvite && (
            <Badge variant="purple" title="They become Manager when they accept the invitation">
              <Mail className="size-3" aria-hidden="true" /> {managerInvite.email} invited
            </Badge>
          )}
        </div>
        {actions.setManager && (
          <Button variant="secondary" size="sm" onClick={() => setModal({ type: "manager" })}>
            <UserCog /> {manager ? "Change Manager" : "Choose Manager"}
          </Button>
        )}
      </Card>

      <Tabs aria-label="Practice sections" tabs={TABS} value={tab} onChange={(v) => router.replace(`${pathname}?tab=${v}`)} />
      {tab === "overview" && <OverviewTab path={`/practices/${practice.id}/overview`} name={practice.name} />}
      {tab === "groups" && <StructureTab practice={practice} openModal={setModal} onChanged={setData} />}
      {tab === "contributions" && <ContributionsTab practice={practice} />}

      <PracticeModals practice={practice} modal={modal} onClose={close} onChanged={setData} />
    </>
  );
}

export default function PracticePage() {
  return (
    <PortalShell requires={["practices.practice.view"]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices", href: "/practices" }, { label: "Practice" }]}>
      <Suspense>
        <Practice />
      </Suspense>
    </PortalShell>
  );
}
