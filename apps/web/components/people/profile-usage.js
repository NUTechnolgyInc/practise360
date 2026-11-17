"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Button, Card, CardHeader, StatusBadge, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PdfViewer } from "@/components/ai-tracker/pdf-viewer";
import { apiBlob } from "@/lib/api";
import { formatDate, monthLabel, recentMonths } from "@/lib/format";

const MONTHS = 6;

/** A person's monthly Claude usage reports: the last six months (Submitted / Pending) plus anything older they uploaded. */
export function ProfileUsage({ reports, name, isSelf }) {
  const [viewing, setViewing] = useState(null);
  const byPeriod = new Map(reports.map((r) => [r.period, r]));
  const periods = [...new Set([...recentMonths(MONTHS), ...reports.map((r) => r.period)])].sort().reverse();
  const load = useCallback(() => apiBlob(`/ai/usage-reports/${viewing?.id}/file`), [viewing]);
  const close = useCallback(() => setViewing(null), []);

  return (
    <Card>
      <CardHeader
        title="Claude usage reports"
        description={`One PDF per month. ${reports.length} uploaded.`}
        actions={isSelf && <Link href="/ai-tracker" className="text-xs font-bold text-nu-purple hover:underline">Upload in AI Tracker →</Link>}
      />
      <Table>
        <THead>
          <TR>
            <TH>Month</TH>
            <TH>Status</TH>
            <TH>Uploaded</TH>
            <TH className="text-right">Report</TH>
          </TR>
        </THead>
        <TBody>
          {periods.map((period) => {
            const report = byPeriod.get(period);
            return (
              <TR key={period}>
                <TD className="font-semibold text-nu-navy">{monthLabel(period)}</TD>
                <TD><StatusBadge status={report ? "Submitted" : "Pending"} /></TD>
                <TD className="font-mono">{report ? formatDate(report.uploadedAt) : "—"}</TD>
                <TD className="text-right">
                  {report && (
                    <Button variant="ghost" size="sm" onClick={() => setViewing(report)} aria-label={`View ${monthLabel(period)} report`}>
                      <Eye aria-hidden="true" /> View
                    </Button>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
      <PdfViewer open={!!viewing} onClose={close} load={load} title={viewing ? `${name} · ${monthLabel(viewing.period)}` : ""} subtitle={viewing?.fileName} fileName={viewing?.fileName} />
    </Card>
  );
}
