"use client";

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Award, Plus, Send } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/layout";
import { Button, Card, CardHeader, EmptyState, StatsToggle, StatTile, Tabs } from "@/components/ui";
import { CatalogTab } from "@/components/certs/catalog-tab";
import { EMPTY_PLAN_FILTERS, PlanFilters, applyPlanFilters } from "@/components/certs/plan-filters";
import { PlanTable } from "@/components/certs/plan-table";
import { TrackerModals } from "@/components/certs/tracker-modals";
import { useResource } from "@/hooks/use-resource";
import { useShowStats } from "@/hooks/use-show-stats";
import { canAnywhere } from "@/lib/can";
import { inReview, isOpen, moneyTotals } from "@/lib/certifications";

const PAGE_PERMS = ["cert.catalog.view", "cert.plan.manage:own", "cert.plan.view"];
const TABS = [
  { value: "mine", label: "My plans", perms: ["cert.plan.manage:own"] },
  { value: "team", label: "Team", perms: ["cert.plan.view"] },
  { value: "review", label: "Awaiting my review", perms: ["cert.plan.review", "cert.plan.verify"] },
  { value: "catalog", label: "Catalog", perms: ["cert.catalog.view"] },
];
const EMPTY = {
  mine: ["No plans yet", "Add a certification or course you're working towards — or accept one your Lead recommends."],
  team: ["No team plans yet", "Assign or recommend a certification to people in your practice."],
  review: ["Nothing to review", "Completed certifications waiting for your approval show up here."],
};

function Stats({ rows, shown }) {
  const count = (fn) => rows.filter(fn).length;
  const reimbursed = moneyTotals(rows.filter((r) => r.status === "completed"));
  return (
    <div id="cert-stats" hidden={!shown} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile label="Planned" value={count((r) => ["planned", "clarification"].includes(r.status))} tone="neutral" />
      <StatTile label="In review" value={count((r) => inReview(r.status))} tone="info" />
      <StatTile label="Completed" value={count((r) => r.status === "completed")} tone="success" />
      <StatTile label="Overdue" value={count((r) => r.overdue)} tone="danger" />
      <StatTile label="Reimbursement approved" value={reimbursed || "—"} className="col-span-2 lg:col-span-1" />
    </div>
  );
}

function CertTracker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { me } = useSession();
  const [modal, setModal] = useState(null);
  const [filters, setFilters] = useState(EMPTY_PLAN_FILTERS);
  const [showStats, toggleStats] = useShowStats();
  const plans = useResource("/certifications/plans");
  const catalog = useResource(`/certifications/catalog${canAnywhere(me, "cert.catalog.manage") ? "?includeRetired=true" : ""}`);

  const d = plans.data;
  const all = useMemo(() => d?.plans ?? [], [d]);
  // Cert Admin holds cert.plan.manage:own at app scope but belongs to no practice, so has nothing of their own to plan.
  const hasOwn = !d || d.canPlanIn.length > 0 || all.some((r) => r.mine);
  const tabs = TABS.filter((t) => canAnywhere(me, ...t.perms) && (t.value !== "mine" || hasOwn));
  const tab = tabs.some((t) => t.value === params.get("tab")) ? params.get("tab") : tabs[0]?.value;
  const switchTab = (v) => {
    setFilters(EMPTY_PLAN_FILTERS);
    router.replace(`${pathname}?tab=${v}`);
  };

  const rows = tab === "mine" ? all.filter((r) => r.mine) : tab === "team" ? all.filter((r) => !r.mine) : all.filter((r) => r.awaitingMe);
  const recommended = tab === "mine" ? rows.filter((r) => r.status === "suggested") : [];
  // Open plans first (stable sort keeps the API's most-recently-updated order inside each group).
  const listed = applyPlanFilters(tab === "mine" ? rows.filter((r) => r.status !== "suggested") : rows, filters).sort((a, b) => isOpen(b.status) - isOpen(a.status));
  const owners = useMemo(() => [...new Map(rows.map((r) => [r.owner.id, r.owner])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName)), [rows]);

  const nameOf = (id) => me.practices.find((p) => p.id === id)?.name ?? id;
  const planPractices = (d?.canPlanIn ?? []).map((id) => ({ id, name: nameOf(id) }));
  const givePractices = [...new Set([...(d?.canSuggestIn ?? []), ...(d?.canAssignIn ?? [])])].map((id) => ({ id, name: nameOf(id), canSuggest: d.canSuggestIn.includes(id), canAssign: d.canAssignIn.includes(id) }));
  const catalogItems = catalog.data?.items ?? [];
  const activeCatalog = catalogItems.filter((c) => c.isActive);
  const open = (kind, item) => setModal({ kind, item });

  // One primary action per tab: the thing you most likely came to that tab to do.
  const action =
    tab === "mine" && planPractices.length ? <Button onClick={() => open("add")}><Plus /> Add a plan</Button>
    : tab === "team" && givePractices.length ? <Button onClick={() => open("assign")}><Send /> Assign or recommend</Button>
    : tab === "catalog" && catalog.data?.canCreate ? <Button onClick={() => open("catalog")}><Plus /> Add to catalog</Button>
    : null;

  const loading = tab === "catalog" ? catalog.loading && !catalog.data : plans.loading && !d;
  const error = tab === "catalog" ? catalog.error : plans.error;
  const [emptyTitle, emptyText] = EMPTY[tab] ?? [];
  const hasStats = (tab === "mine" || tab === "team") && !!d;

  return (
    <>
      <PageHeader
        title="Certification Tracker"
        description="Plan certifications and courses, submit the certificate when you pass, and get it approved by your Practice Lead and Manager."
        actions={
          (hasStats || action) && (
            <>
              {hasStats && <StatsToggle shown={showStats} onToggle={toggleStats} controls="cert-stats" />}
              {action}
            </>
          )
        }
      />
      {hasStats && <Stats rows={rows} shown={showStats} />}
      {recommended.length > 0 && (
        <Card className="border-teal-200">
          <CardHeader title="Recommended for you" description="Open one to accept it with your own dates, or decline it." />
          <PlanTable rows={recommended} showPractice={planPractices.length > 1} />
        </Card>
      )}
      <Card className="space-y-4">
        <Tabs aria-label="Certification views" tabs={tabs} value={tab} onChange={switchTab} />
        {loading ? (
          <p className="py-10 text-center text-sm text-nu-muted-teal" role="status">Loading…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-rose-600" role="alert">{error}</p>
        ) : tab === "catalog" ? (
          <CatalogTab
            items={catalogItems}
            onPlan={planPractices.length ? (c) => open("add", c) : undefined}
            onAssign={givePractices.length ? (c) => open("assign", c) : undefined}
            onEdit={(c) => open("catalog", c)}
            onToggleActive={(c) => open("retire", c)}
          />
        ) : (
          <>
            <PlanFilters value={filters} onChange={setFilters} practices={d?.practices ?? []} owners={tab === "mine" ? [] : owners} />
            {listed.length === 0 ? (
              <EmptyState icon={Award} title={rows.length ? "Nothing matches" : emptyTitle} description={rows.length ? "Try clearing a filter." : emptyText} className="border-none" />
            ) : (
              <PlanTable rows={listed} showOwner={tab !== "mine"} showPractice={(d?.practices.length ?? 0) > 1} />
            )}
          </>
        )}
      </Card>
      <TrackerModals
        modal={modal}
        onClose={() => setModal(null)}
        me={me}
        catalogItems={activeCatalog}
        planPractices={planPractices}
        givePractices={givePractices}
        reloadPlans={plans.reload}
        reloadCatalog={catalog.reload}
      />
    </>
  );
}

export default function CertificationsPage() {
  return (
    <PortalShell requires={PAGE_PERMS} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Certification Tracker" }]}>
      <Suspense>
        <CertTracker />
      </Suspense>
    </PortalShell>
  );
}
