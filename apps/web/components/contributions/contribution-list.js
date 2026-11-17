"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { EmptyState, Tabs } from "@/components/ui";
import { canAnywhere } from "@/lib/can";
import { ContributionFilters, EMPTY_FILTERS, applyFilters } from "./contribution-filters";
import { ContributionTable } from "./contribution-table";

const REVIEW_PERMS = ["practices.contribution.review", "practices.contribution.approve"];

/** Reviewers (Lead, Manager, admins) get an "Awaiting my review" view. UI hint only — the API decides `awaitingMe`. */
export const isReviewer = (me) => canAnywhere(me, ...REVIEW_PERMS);

const DEFAULT_EMPTY = "Built a reusable framework, an internal tool or won a client? Start a contribution and log progress as you go.";

/**
 * The contributions list shared by Practices → Contributions and the Contributions tab of a practice or group:
 * All / Mine / Awaiting my review views, the filter bar and the table. `data` = GET /contributions (only what the
 * caller may see). `view` + `onViewChange` let a page sync the view to the URL; without them it's local state.
 * `singlePractice` drops the practice filter and column when the list is already one practice.
 */
export function ContributionList({ data, loading, error, view: controlledView, onViewChange, singlePractice = false, emptyDescription = DEFAULT_EMPTY }) {
  const { me } = useSession();
  const [localView, setLocalView] = useState("all");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const views = [{ value: "all", label: "All" }, { value: "mine", label: "Mine" }, ...(isReviewer(me) ? [{ value: "review", label: "Awaiting my review" }] : [])];
  const wanted = controlledView ?? localView;
  const view = views.some((v) => v.value === wanted) ? wanted : "all";
  const setView = onViewChange ?? setLocalView;

  const rows = useMemo(() => data?.contributions ?? [], [data]);
  const owners = useMemo(() => [...new Map(rows.map((r) => [r.owner.id, r.owner])).values()].sort((a, b) => a.displayName.localeCompare(b.displayName)), [rows]);
  const practices = singlePractice ? [] : (data?.practices ?? []);
  const inView = rows.filter((r) => (view === "mine" ? r.mine : view === "review" ? r.awaitingMe : true));
  const shown = applyFilters(inView, filters);

  return (
    <div className="space-y-4">
      <Tabs aria-label="Contribution views" tabs={views} value={view} onChange={setView} />
      <ContributionFilters value={filters} onChange={setFilters} practices={practices} owners={owners} />
      {loading && !data ? (
        <p className="py-10 text-center text-sm text-nu-muted-teal" role="status">Loading contributions…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-rose-600" role="alert">{error}</p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={rows.length === 0 ? "No contributions yet" : "Nothing matches"}
          description={rows.length === 0 ? emptyDescription : view === "review" ? "Nothing is waiting for your review." : "Try clearing a filter."}
          className="border-none"
        />
      ) : (
        <ContributionTable rows={shown} showPractice={practices.length > 1} />
      )}
    </div>
  );
}
