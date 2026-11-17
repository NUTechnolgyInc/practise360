"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CircleHelp, Mail, Pencil } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/layout";
import { Badge, Button, Card, CardHeader, EmptyState, Markdown, StatusBadge, useToast } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { AttachButton, FileChips } from "@/components/contributions/attachments";
import { ContributionActions } from "@/components/contributions/contribution-actions";
import { EditModal } from "@/components/contributions/edit-modals";
import { AddedByBadge } from "@/components/contributions/added-by";
import { PeopleCard } from "@/components/contributions/people-card";
import { Timeline } from "@/components/contributions/timeline";
import { SubmissionCard, WorkflowStepper } from "@/components/contributions/workflow-panel";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { statusLabel, typeLabel } from "@/lib/contributions";
import { formatDate } from "@/lib/format";

function Fact({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-xs">
      <dt className="font-bold text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-nu-navy">{children}</dd>
    </div>
  );
}

/** Banner for whatever needs the viewer's attention right now. */
function Callout({ c }) {
  const lastClarify = c.events.find((e) => e.kind === "review" && e.decision === "clarify");
  if (c.status === "clarification" && c.actions.submit && lastClarify) {
    return (
      <Card className="border-amber-200 bg-amber-50/60">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
          <CircleHelp className="size-4" aria-hidden="true" /> <span><PersonLink person={lastClarify.author} /> asked for clarification</span>
        </div>
        <Markdown>{lastClarify.body}</Markdown>
        <p className="mt-2 text-xs text-amber-800">Update the contribution if needed, then use “Reply and resubmit”.</p>
      </Card>
    );
  }
  if (c.actions.respondInvite) {
    return (
      <Card className="flex items-center gap-2 border-purple-200 bg-purple-50/60 text-sm font-semibold text-nu-purple">
        <Mail className="size-4" aria-hidden="true" /> You've been invited to contribute.
      </Card>
    );
  }
  return null;
}

function ContributionDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { me } = useSession();
  const { data: c, setData, loading, error } = useResource(`/contributions/${id}`);
  const [editing, setEditing] = useState(null); // "details" | "description" | null

  /** Every mutation returns the fresh contribution, so one helper handles saving, toasts and errors. */
  const run = useCallback(
    async (path, opts, success, confirmText) => {
      if (confirmText && !window.confirm(confirmText)) return false;
      try {
        const next = await api(path, opts);
        if (next) setData(next);
        if (success) toast(success);
        return true;
      } catch (err) {
        toast(err.message, "error");
        return false;
      }
    },
    [setData, toast],
  );

  const addFiles = (stored) => setData((prev) => ({ ...prev, files: [...prev.files, ...stored] }));
  const removeFile = async (f) => {
    const ok = await run(`/contributions/${id}/files/${f.id}`, { method: "DELETE" }, `${f.fileName} removed`, `Remove ${f.fileName}?`);
    if (ok) setData((prev) => ({ ...prev, files: prev.files.filter((x) => x.id !== f.id) }));
  };

  if (loading && !c) return <p className="py-10 text-center text-sm text-nu-muted-teal" role="status">Loading…</p>;
  if (error || !c) return <EmptyState title="Contribution not found" description={error || "It may have been removed, or it belongs to a practice you're not in."} />;

  const { actions } = c;
  return (
    <>
      <PageHeader
        back={{ href: "/practices/contributions", label: "Contributions" }}
        meta={
          <>
            <StatusBadge status={statusLabel(c.status)} />
            {c.overdue && <Badge variant="danger"><AlertTriangle className="size-3" aria-hidden="true" /> Overdue</Badge>}
            <AddedByBadge contribution={c} />
          </>
        }
        title={c.title}
        description={
          <>
            {typeLabel(c)} · {c.practice.name} · {c.addedBy ? "owned" : "started"} by <PersonLink person={c.owner} className="font-semibold" />
            {c.addedBy && <> · added by <PersonLink person={c.addedBy} className="font-semibold" /></>} on {formatDate(c.startDate)}
          </>
        }
        actions={<ContributionActions contribution={c} run={run} onFilesAdded={addFiles} />}
      />
      <Callout c={c} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Description"
              actions={actions.edit && <Button variant="ghost" size="sm" onClick={() => setEditing("description")}><Pencil /> Edit</Button>}
            />
            {c.description.trim() ? <Markdown>{c.description}</Markdown> : <p className="text-xs text-gray-400">No description yet{actions.edit ? " — add one before submitting." : "."}</p>}
          </Card>
          <SubmissionCard contribution={c} />
          <Timeline contribution={c} onPost={(body) => run(`/contributions/${id}/updates`, { method: "POST", body }, "Update posted")} />
        </div>

        <aside className="space-y-6">
          <WorkflowStepper contribution={c} />
          <Card>
            <CardHeader title="Details" actions={actions.edit && <Button variant="ghost" size="sm" onClick={() => setEditing("details")}><Pencil /> Edit</Button>} />
            <dl className="divide-y divide-gray-100">
              <Fact label="Type">{typeLabel(c)}</Fact>
              <Fact label="Practice">{c.practice.name}</Fact>
              <Fact label={c.addedBy ? "Owner" : "Started by"}><PersonLink person={c.owner} /></Fact>
              {c.addedBy && <Fact label="Added by"><PersonLink person={c.addedBy} /></Fact>}
              <Fact label="Start date">{formatDate(c.startDate)}</Fact>
              <Fact label="Due date"><span className={c.overdue ? "text-rose-600" : undefined}>{formatDate(c.dueDate)}</span></Fact>
            </dl>
          </Card>
          <PeopleCard contribution={c} meId={me.id} run={run} />
          <Card>
            <CardHeader title="Documents" description={`${c.files.length} file${c.files.length === 1 ? "" : "s"}`} actions={actions.upload && <AttachButton contributionId={c.id} label="Upload" onUploaded={addFiles} />} />
            {c.files.length ? <FileChips contributionId={c.id} files={c.files} onRemove={actions.edit ? removeFile : undefined} /> : <p className="text-xs text-gray-400">No documents yet.</p>}
          </Card>
        </aside>
      </div>

      <EditModal open={!!editing} part={editing} onClose={() => setEditing(null)} contribution={c} onSave={(body) => run(`/contributions/${id}`, { method: "PATCH", body }, "Saved")} />
    </>
  );
}

export default function ContributionPage() {
  return (
    <PortalShell requires={["practices.contribution.view"]} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices", href: "/practices" }, { label: "Contributions", href: "/practices/contributions" }, { label: "Contribution" }]}>
      <ContributionDetail />
    </PortalShell>
  );
}
