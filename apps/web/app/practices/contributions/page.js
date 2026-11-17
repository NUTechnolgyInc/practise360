"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/layout";
import { buttonVariants, Card, StatsToggle, StatTile } from "@/components/ui";
import { ContributionList, isReviewer } from "@/components/contributions/contribution-list";
import { PracticesNav } from "@/components/practices/practices-nav";
import { useResource } from "@/hooks/use-resource";
import { useShowStats } from "@/hooks/use-show-stats";

const VIEW_PERM = "practices.contribution.view";

function Contributions() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { me } = useSession();
  const { data, loading, error } = useResource("/contributions");
  const [showStats, toggleStats] = useShowStats();

  const rows = data?.contributions ?? [];
  const count = (fn) => rows.filter(fn).length;
  const canStart = (data?.canCreateIn.length ?? 0) > 0;

  return (
    <>
      <PracticesNav current="/practices/contributions" />
      <PageHeader
        title="Practice contributions"
        description="Frameworks, tools, client wins, case studies and blogs from your practice — tracked from first commit to published."
        actions={
          <>
            <StatsToggle shown={showStats} onToggle={toggleStats} controls="contribution-stats" />
            {canStart && (
              <Link href="/practices/contributions/new" className={buttonVariants()}>
                <Plus /> Start a contribution
              </Link>
            )}
          </>
        }
      />

      <div id="contribution-stats" hidden={!showStats} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Total" value={rows.length} tone="neutral" />
        <StatTile label="In progress" value={count((r) => ["in_progress", "clarification"].includes(r.status))} />
        <StatTile label="In review" value={count((r) => ["lead_review", "manager_review"].includes(r.status))} tone="info" hint={isReviewer(me) ? `${count((r) => r.awaitingMe)} waiting for you` : undefined} />
        <StatTile label="Published" value={count((r) => r.status === "published")} tone="success" />
        <StatTile label="Overdue" value={count((r) => r.overdue)} tone="danger" className="col-span-2 lg:col-span-1" />
      </div>

      <Card>
        <ContributionList data={data} loading={loading} error={error} view={params.get("tab")} onViewChange={(v) => router.replace(`${pathname}?tab=${v}`)} />
      </Card>
    </>
  );
}

export default function ContributionsPage() {
  return (
    <PortalShell requires={[VIEW_PERM]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices", href: "/practices" }, { label: "Contributions" }]}>
      <Suspense>
        <Contributions />
      </Suspense>
    </PortalShell>
  );
}
