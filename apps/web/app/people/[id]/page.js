"use client";

import { Suspense } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, Lightbulb, Loader2, UserRound } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Avatar, Badge, Card, CardHeader, EmptyState, StatsToggle, StatTile, Tabs } from "@/components/ui";
import { ContributionTable } from "@/components/contributions/contribution-table";
import { PlanTable } from "@/components/certs/plan-table";
import { ProfileOverview } from "@/components/people/profile-overview";
import { ProfileUsage } from "@/components/people/profile-usage";
import { useResource } from "@/hooks/use-resource";
import { useShowStats } from "@/hooks/use-show-stats";
import { isOpen } from "@/lib/certifications";
import { formatDate } from "@/lib/format";

const practicesIn = (rows) => new Set(rows.map((r) => r.practice.id)).size;

/** Tabs for the sections the API returned — a hidden section comes back as null. */
function tabsFor(p) {
  return [
    { value: "overview", label: "Overview" },
    p.contributions && { value: "contributions", label: `Contributions (${p.contributions.length})` },
    p.certifications && { value: "certifications", label: `Certifications (${p.certifications.length})` },
    p.usageReports && { value: "ai-usage", label: "AI usage" },
  ].filter(Boolean);
}

/** Count tiles for the visible sections (hidden until "Show stats"). */
function statTiles(p) {
  return [
    p.contributions && <StatTile key="c" label="Contributions" value={p.contributions.length} tone="purple" />,
    p.contributions && <StatTile key="p" label="Published" value={p.contributions.filter((c) => c.status === "published").length} tone="success" />,
    p.certifications && <StatTile key="e" label="Certifications earned" value={p.certifications.filter((x) => x.status === "completed").length} tone="info" />,
    p.certifications && <StatTile key="o" label="Open plans" value={p.certifications.filter((x) => isOpen(x.status)).length} tone="neutral" />,
  ].filter(Boolean);
}

function Records({ title, description, rows, empty, children }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      {rows.length === 0 ? <EmptyState icon={empty.icon} title={empty.title} className="border-none p-6" /> : children}
    </Card>
  );
}

function Profile() {
  const { id } = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: p, loading, error } = useResource(`/people/${id}`);
  const [showStats, toggleStats] = useShowStats();

  if (loading && !p) {
    return (
      <p className="flex items-center justify-center py-12 text-sm text-nu-muted-teal" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden="true" /> Loading profile…
      </p>
    );
  }
  if (error || !p) {
    const notFound = !error || error === "Person not found";
    return <EmptyState icon={UserRound} title={notFound ? "Profile not found" : "Couldn't load the profile"} description={notFound ? "They may be outside your practices, or the link is wrong." : error} />;
  }

  const firstName = p.isSelf ? "you" : p.displayName.split(" ")[0];
  const tabs = tabsFor(p);
  const tab = tabs.some((t) => t.value === params.get("tab")) ? params.get("tab") : "overview";
  const tiles = statTiles(p);

  return (
    <>
      <PageHeader
        leading={<Avatar name={p.displayName} size="xl" />}
        meta={
          (p.isSelf || !p.isActive) && (
            <>
              {p.isSelf && <Badge variant="purple">You</Badge>}
              {!p.isActive && <Badge variant="neutral">Inactive account</Badge>}
            </>
          )
        }
        title={p.displayName}
        description={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="font-mono">{p.username}</span>
            {p.email && <a href={`mailto:${p.email}`} className="text-nu-purple hover:underline">{p.email}</a>}
            {p.memberSince && <span>On Practise360 since {formatDate(p.memberSince)}</span>}
          </span>
        }
        actions={tiles.length > 0 && <StatsToggle shown={showStats} onToggle={toggleStats} controls="profile-stats" />}
      />

      {tiles.length > 0 && (
        <div id="profile-stats" hidden={!showStats} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles}
        </div>
      )}

      {tabs.length > 1 && <Tabs aria-label="Profile sections" tabs={tabs} value={tab} onChange={(v) => router.replace(`${pathname}?tab=${v}`)} />}

      {tab === "overview" && <ProfileOverview profile={p} firstName={firstName} />}
      {tab === "contributions" && (
        <Records title="Contributions" description={`Work ${p.isSelf ? "you" : firstName} started or contribute${p.isSelf ? "" : "s"} to, in practices you can see.`} rows={p.contributions} empty={{ icon: Lightbulb, title: "No contributions yet" }}>
          <ContributionTable rows={p.contributions} showPractice={practicesIn(p.contributions) > 1} />
        </Records>
      )}
      {tab === "certifications" && (
        <Records title="Certifications" description="Planned, in review and earned certifications and courses." rows={p.certifications} empty={{ icon: Award, title: "No certifications planned yet" }}>
          <PlanTable rows={p.certifications} showPractice={practicesIn(p.certifications) > 1} />
        </Records>
      )}
      {tab === "ai-usage" && <ProfileUsage reports={p.usageReports} name={p.displayName} isSelf={p.isSelf} />}
    </>
  );
}

export default function ProfilePage() {
  return (
    <PortalShell breadcrumbs={[{ label: "Home", href: "/" }, { label: "Profile" }]}>
      <Suspense>
        <Profile />
      </Suspense>
    </PortalShell>
  );
}
