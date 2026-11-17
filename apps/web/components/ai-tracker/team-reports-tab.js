"use client";

import { useState } from "react";
import { Eye, Users } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, StatsToggle, StatTile, StatusBadge, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { formatDate, monthLabel, recentMonths } from "@/lib/format";
import { useTeamReports } from "@/hooks/use-usage-reports";
import { useShowStats } from "@/hooks/use-show-stats";

const FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "submitted", label: "Submitted" },
  { value: "pending", label: "Pending" },
];

/** Management view: who has submitted for a month, and open any report. The API decides who is in scope. */
export function TeamReportsTab({ onView }) {
  const [period, setPeriod] = useState(() => recentMonths(1)[0]);
  const [filter, setFilter] = useState("all");
  const { data, loading, error } = useTeamReports(period);
  const [showStats, toggleStats] = useShowStats();
  const people = data?.people ?? [];
  const shown = people.filter((p) => filter === "all" || (filter === "submitted") === !!p.report);
  const submitted = data?.summary.submitted ?? 0;
  const total = data?.summary.people ?? 0;

  return (
    <>
      <div id="team-report-stats" hidden={!showStats} className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile label="People in scope" value={total} tone="neutral" />
        <StatTile label="Submitted" value={submitted} tone="success" />
        <StatTile label="Pending" value={total - submitted} tone={total - submitted ? "danger" : "neutral"} />
        <StatTile label="Completion" value={total ? `${Math.round((submitted / total) * 100)}%` : "—"} hint={monthLabel(period)} tone="purple" />
      </div>

      <Card>
        <CardHeader
          title={`Reports for ${monthLabel(period)}`}
          description="Practice Managers see their practice; AI Tracker admins see everyone."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <StatsToggle shown={showStats} onToggle={toggleStats} controls="team-report-stats" />
              <Field id="team-period" className="w-44">
                {(p) => (
                  <Select {...p} aria-label="Month" value={period} onChange={(e) => setPeriod(e.target.value)}>
                    {recentMonths(12).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
                  </Select>
                )}
              </Field>
              <Field id="team-filter" className="w-36">
                {(p) => (
                  <Select {...p} aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value)}>
                    {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          }
        />
        {loading && !data ? (
          <p className="p-6 text-center text-xs text-nu-muted-teal" role="status">Loading reports…</p>
        ) : error ? (
          <EmptyState title="Couldn't load reports" description={error} />
        ) : shown.length === 0 ? (
          <EmptyState icon={Users} title={people.length ? "Nobody matches this filter" : "No one in your scope yet"} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Person</TH>
                <TH>Practice</TH>
                <TH>Status</TH>
                <TH>Uploaded</TH>
                <TH className="text-right">Report</TH>
              </TR>
            </THead>
            <TBody>
              {shown.map(({ user, practices, report }) => (
                <TR key={user.id}>
                  <TD><PersonChip person={user} subtitle={user.username} size="sm" /></TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {practices.length ? practices.map((p) => <Badge key={p.id} variant="primary">{p.name}</Badge>) : <span className="text-gray-400">—</span>}
                    </div>
                  </TD>
                  <TD><StatusBadge status={report ? "Submitted" : "Pending"} /></TD>
                  <TD className="font-mono">{report ? formatDate(report.uploadedAt) : "—"}</TD>
                  <TD className="text-right">
                    {report && (
                      <Button variant="ghost" size="sm" onClick={() => onView(report, user.displayName)}>
                        <Eye aria-hidden="true" /> View
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </>
  );
}
