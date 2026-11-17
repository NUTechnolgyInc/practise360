"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Button, buttonVariants, EmptyState, Tabs } from "@/components/ui";
import { ContributionsTab, StartContributionLink } from "@/components/practices/contributions-tab";
import { GroupLeadersCard } from "@/components/practices/group-leaders-card";
import { GroupMembersTab } from "@/components/practices/group-members-tab";
import { OverviewTab } from "@/components/practices/overview-tab";
import { PracticeModals } from "@/components/practices/practice-modals";
import { useResource } from "@/hooks/use-resource";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "members", label: "Members" },
  { value: "contributions", label: "Contributions" },
];

/**
 * One group of a practice: its Lead and Manager, then Overview, Members and Contributions tabs (?tab=). Groups have
 * no sub-groups. Everything comes from the practice detail (GET /practices/:id), whose `group.actions` say what the
 * caller may do — its Lead, the Manager and Practices Admin run the group (rbac.md §4 "Practices and groups").
 */
function Group() {
  const { id, groupId } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview";
  const { data: practice, setData, loading, error } = useResource(`/practices/${id}`);
  // modal = { type: "group" | "lead" | "removeLead", group } — the practice page's dialogs, reused.
  const [modal, setModal] = useState(null);

  if (loading && !practice) {
    return (
      <p className="flex items-center justify-center py-12 text-sm text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading group…
      </p>
    );
  }
  if (error) return <EmptyState title="Practice not found" description={error} />;

  const group = practice.groups.find((g) => g.id === groupId);
  if (!group) {
    return (
      <EmptyState
        title="Group not found"
        description={`${practice.name} has no such group — it may have been deleted.`}
        action={<Link href={`/practices/${id}?tab=groups`} className={buttonVariants({ variant: "secondary" })}>Back to {practice.name}</Link>}
      />
    );
  }
  const pendingLead = practice.invites?.find((i) => i.kind === "lead" && i.groupId === group.id) ?? null;

  return (
    <>
      <PageHeader
        back={{ href: `/practices/${id}?tab=groups`, label: practice.name }}
        title={group.name}
        description={group.description || `A group in ${practice.name}`}
        actions={
          <>
            {group.actions.edit && (
              <Button variant="secondary" onClick={() => setModal({ type: "group", group })}>
                <Pencil /> Rename
              </Button>
            )}
            <StartContributionLink practiceId={practice.id} groupId={group.id} />
          </>
        }
      />

      <GroupLeadersCard
        practice={practice}
        group={group}
        pendingLead={pendingLead}
        onChooseLead={() => setModal({ type: "lead", group })}
        onRemoveLead={() => setModal({ type: "removeLead", group })}
      />

      <Tabs aria-label="Group sections" tabs={TABS} value={tab} onChange={(v) => router.replace(`${pathname}?tab=${v}`)} />
      {tab === "overview" && <OverviewTab path={`/practices/${id}/groups/${group.id}/overview`} name={group.name} subject="group" />}
      {tab === "members" && <GroupMembersTab practice={practice} group={group} onChanged={setData} />}
      {tab === "contributions" && <ContributionsTab practice={practice} group={group} />}

      <PracticeModals practice={practice} modal={modal} onClose={() => setModal(null)} onChanged={setData} />
    </>
  );
}

export default function GroupPage() {
  const { id } = useParams();
  return (
    <PortalShell
      requires={["practices.practice.view"]}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices", href: "/practices" }, { label: "Practice", href: `/practices/${id}?tab=groups` }, { label: "Group" }]}
    >
      <Suspense>
        <Group />
      </Suspense>
    </PortalShell>
  );
}
