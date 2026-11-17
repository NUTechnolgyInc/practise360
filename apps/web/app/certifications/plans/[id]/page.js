"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, CircleHelp, Sparkles, XCircle } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { PageHeader } from "@/components/layout";
import { Badge, Card, EmptyState, Markdown, StatusBadge, useToast } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { PlanActions } from "@/components/certs/plan-actions";
import { EditPlanModal } from "@/components/certs/plan-modals";
import { CompletionCard, PlanDetails, PlanStepper } from "@/components/certs/plan-panels";
import { PlanTimeline } from "@/components/certs/plan-timeline";
import { useResource } from "@/hooks/use-resource";
import { api } from "@/lib/api";
import { SOURCES, certTypeLabel, planStatusLabel, plansPath } from "@/lib/certifications";

const TONES = {
  amber: { card: "border-amber-200 bg-amber-50/60", text: "text-amber-800" },
  rose: { card: "border-rose-200 bg-rose-50/60", text: "text-rose-800" },
  teal: { card: "border-teal-200 bg-teal-50/60", text: "text-nu-dark-teal" },
};

function Banner({ tone, icon: Icon, title, body, hint }) {
  const t = TONES[tone];
  return (
    <Card className={t.card}>
      <div className={`mb-2 flex items-center gap-2 text-sm font-bold ${t.text}`}>
        <Icon className="size-4" aria-hidden="true" /> {title}
      </div>
      {body && <Markdown>{body}</Markdown>}
      {hint && <p className={`mt-2 text-xs ${t.text}`}>{hint}</p>}
    </Card>
  );
}

/** Whatever needs the owner's attention right now: a recommendation, a clarification request or a rejection. */
function Callout({ plan: p }) {
  const lastReview = p.events.find((e) => e.kind === "review");
  if (p.actions.accept) {
    const from = p.events.find((e) => e.kind === "suggested");
    return <Banner tone="teal" icon={Sparkles} title={<span><PersonLink person={p.createdBy} /> recommended this to you</span>} body={from?.body} hint="Accept it with your own dates, or decline it." />;
  }
  if (p.status === "clarification" && p.actions.submit && lastReview?.decision === "clarify") {
    return <Banner tone="amber" icon={CircleHelp} title={<span><PersonLink person={lastReview.author} /> asked for clarification</span>} body={lastReview.body} hint="Use “Reply and resubmit” to answer." />;
  }
  if (p.status === "planned" && p.actions.submit && lastReview?.decision === "reject") {
    return <Banner tone="rose" icon={XCircle} title={<span><PersonLink person={lastReview.author} /> rejected the completion</span>} body={lastReview.body} hint="Fix what's wrong, then submit the completion again — it starts from the Lead step." />;
  }
  return null;
}

function PlanDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { data: p, setData, loading, error } = useResource(plansPath(id));
  const [editing, setEditing] = useState(false);

  /** Every mutation returns the fresh plan, so one helper handles saving, toasts and errors. */
  const run = useCallback(
    async (path, opts, success) => {
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

  if (loading && !p) return <p className="py-10 text-center text-sm text-nu-muted-teal" role="status">Loading…</p>;
  if (error || !p) {
    const notFound = !error || error === "Plan not found";
    return <EmptyState title={notFound ? "Plan not found" : "Couldn't load the plan"} description={notFound ? "It may belong to someone outside your practice, or the link is wrong." : error} />;
  }

  const { actions } = p;
  const canEdit = actions.edit || actions.editDueDate;
  return (
    <>
      <PageHeader
        back={{ href: "/certifications", label: "Certification Tracker" }}
        meta={
          <>
            <StatusBadge status={planStatusLabel(p.status)} />
            {p.overdue && <StatusBadge status="Overdue" />}
            {p.expired && <StatusBadge status="Expired" />}
            {p.source !== "self" && <Badge variant={p.source === "assigned" ? "primary" : "teal"}>{SOURCES[p.source]}</Badge>}
          </>
        }
        title={p.cert.title}
        description={
          <>
            {certTypeLabel(p.cert.type)}
            {p.cert.provider && ` · ${p.cert.provider}`} · <PersonLink person={p.owner} className="font-semibold" /> · {p.practice.name}
          </>
        }
        actions={<PlanActions plan={p} run={run} onFilesAdded={addFiles} />}
      />
      {p.overdue && actions.submit && (
        <p className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700" role="status">
          <AlertTriangle className="size-4" aria-hidden="true" /> Past the due date — submit the completion, or {p.source === "assigned" ? "ask whoever assigned it for a new date" : "move the due date (Details → Edit)"}.
        </p>
      )}
      <Callout plan={p} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <CompletionCard plan={p} />
          <PlanTimeline plan={p} />
        </div>
        <aside className="space-y-6">
          <PlanStepper plan={p} />
          <PlanDetails plan={p} onEdit={canEdit ? () => setEditing(true) : undefined} />
        </aside>
      </div>
      {canEdit && (
        <EditPlanModal open={editing} onClose={() => setEditing(false)} plan={p} canEdit={actions.edit} canEditDue={actions.editDueDate} onSave={(body) => run(plansPath(id), { method: "PATCH", body }, "Saved")} />
      )}
    </>
  );
}

export default function PlanPage() {
  return (
    <PortalShell
      requires={["cert.plan.manage:own", "cert.plan.view"]}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Certification Tracker", href: "/certifications" }, { label: "Plan" }]}
    >
      <PlanDetail />
    </PortalShell>
  );
}
