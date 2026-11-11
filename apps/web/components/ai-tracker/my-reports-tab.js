"use client";

import { useState } from "react";
import { Eye, FileText, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, Modal, Table, TBody, TD, TH, THead, TR, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { formatBytes, formatDate, monthLabel, recentMonths } from "@/lib/format";
import { useMyReports } from "@/hooks/use-usage-reports";
import { SkillCard } from "./skill-card";
import { UploadCard } from "./upload-card";

/** Practitioner view: get the skill, upload this month's PDF, see and manage past reports. */
export function MyReportsTab({ onView }) {
  const toast = useToast();
  const { data, loading, error, reload } = useMyReports();
  const [period, setPeriod] = useState(() => recentMonths(1)[0]);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const reports = data ?? [];

  const confirmDelete = async () => {
    setBusy(true);
    try {
      await api(`/ai/usage-reports/mine/${deleting.period}`, { method: "DELETE" });
      toast(`Report for ${monthLabel(deleting.period)} deleted`);
      setDeleting(null);
      reload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SkillCard period={period} />
      <UploadCard period={period} onPeriodChange={setPeriod} existing={reports} onUploaded={reload} />

      <Card>
        <CardHeader title="Your reports" description="Newest first. Upload again for a month to replace its report." />
        {loading && !data ? (
          <p className="p-6 text-center text-xs text-nu-muted-teal" role="status">Loading your reports…</p>
        ) : error ? (
          <EmptyState title="Couldn't load your reports" description={error} />
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} title="No reports yet" description="Generate your first report with the skill above, then upload the PDF." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Month</TH>
                <TH>File</TH>
                <TH>Size</TH>
                <TH>Uploaded</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {reports.map((r) => (
                <TR key={r.id}>
                  <TD className="font-semibold text-nu-navy">{monthLabel(r.period)}</TD>
                  <TD className="max-w-56 truncate font-mono">{r.fileName}</TD>
                  <TD>{formatBytes(r.size)}</TD>
                  <TD className="font-mono">{formatDate(r.uploadedAt)}</TD>
                  <TD>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onView(r, "Your report")}>
                        <Eye aria-hidden="true" /> View
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Delete report for ${monthLabel(r.period)}`} onClick={() => setDeleting(r)}>
                        <Trash2 className="text-rose-600" aria-hidden="true" />
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete report?"
        description={deleting && `Your ${monthLabel(deleting.period)} report will be removed for you and your managers.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>{busy ? "Deleting…" : "Delete report"}</Button>
          </>
        }
      >
        <p className="text-sm">This can't be undone. You can upload a new PDF for the month afterwards.</p>
      </Modal>
    </>
  );
}
