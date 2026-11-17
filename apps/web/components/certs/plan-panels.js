import { Check, ExternalLink, Pencil } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui";
import { FileChips } from "@/components/contributions/attachments";
import { PersonLink } from "@/components/people/person-link";
import { SOURCES, certTypeLabel, filesPath, formatMoney } from "@/lib/certifications";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

function ExternalLinkRow({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all font-semibold text-nu-purple hover:underline">
      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /> {children}
    </a>
  );
}

/** Where the plan is in Planned → Lead review → Manager review → Completed, and who signed off. */
export function PlanStepper({ plan: p }) {
  const order = ["planned", "lead_review", "manager_review", "completed"];
  const at = p.status === "clarification" ? (p.clarificationStage === "manager" ? 2 : 1) : p.status === "suggested" ? 0 : order.indexOf(p.status);
  const waiting = (stage) => p.status === "clarification" && p.clarificationStage === stage;
  const steps = [
    { label: p.status === "suggested" ? "Recommended" : "Planned", sub: p.status === "suggested" ? <>Waiting for <PersonLink person={p.owner} className="font-semibold" /> to accept</> : p.dueDate ? `Due ${formatDate(p.dueDate)}` : "No due date" },
    { label: "Lead review", sub: p.leadReview ? <>Approved by <PersonLink person={p.leadReview.by} className="font-semibold" /></> : waiting("lead") ? "Waiting on the member's reply" : "Practice Lead" },
    { label: "Manager review", sub: p.managerReview ? <>Approved by <PersonLink person={p.managerReview.by} className="font-semibold" /></> : waiting("manager") ? "Waiting on the member's reply" : "Practice Manager" },
    { label: "Completed", sub: p.completedAt ? formatDate(p.completedAt) : "Certificate approved" },
  ];
  const closed = p.status === "declined" || p.status === "dropped";

  return (
    <Card>
      <CardHeader title="Approval" />
      {closed && (
        <p className="mb-3 rounded-xl bg-gray-100 p-3 text-xs font-semibold text-gray-700">
          {p.status === "declined" ? "Recommendation declined" : "Plan closed"} — see the timeline for the reason.
        </p>
      )}
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const done = !closed && (at > i || p.status === "completed");
          const current = !closed && at === i && p.status !== "completed";
          return (
            <li key={s.label} className="flex items-start gap-3" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  done ? "bg-emerald-600 text-white" : current ? "bg-nu-purple text-white ring-4 ring-purple-100" : "bg-gray-100 text-gray-400",
                )}
              >
                {done ? <Check className="size-3.5" aria-hidden="true" /> : i + 1}
              </span>
              <div>
                <div className={cn("text-sm font-bold", done || current ? "text-nu-navy" : "text-gray-400")}>{s.label}</div>
                <div className="text-[11px] text-nu-muted-teal">{s.sub}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Fact({ label, children }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-xs">
      <dt className="shrink-0 font-bold text-gray-500">{label}</dt>
      <dd className="min-w-0 text-right font-semibold text-nu-navy">{children}</dd>
    </div>
  );
}

/** Cert, owner, source and dates. `onEdit` is passed only when the viewer may change something. */
export function PlanDetails({ plan: p, onEdit }) {
  return (
    <Card>
      <CardHeader title="Details" actions={onEdit && <Button variant="ghost" size="sm" onClick={onEdit}><Pencil /> Edit</Button>} />
      <dl className="divide-y divide-gray-100">
        <Fact label="Type">{certTypeLabel(p.cert.type)}</Fact>
        {p.cert.provider && <Fact label="Provider">{p.cert.provider}</Fact>}
        {p.cert.url && <Fact label="Official page"><ExternalLinkRow href={p.cert.url}>Open</ExternalLinkRow></Fact>}
        <Fact label="Member"><PersonLink person={p.owner} /></Fact>
        <Fact label="Practice">{p.practice.name}</Fact>
        <Fact label="Source">{p.source === "self" ? SOURCES.self : <>{SOURCES[p.source]} by <PersonLink person={p.createdBy} /></>}</Fact>
        <Fact label="Start date">{p.startDate ? formatDate(p.startDate) : "—"}</Fact>
        <Fact label="Due date"><span className={p.overdue ? "text-rose-600" : undefined}>{p.dueDate ? formatDate(p.dueDate) : "—"}{p.overdue && " (overdue)"}</span></Fact>
      </dl>
      {p.notes && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-xs text-nu-dark-teal">{p.notes}</p>}
    </Card>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</h4>
      <div className="text-sm text-nu-navy">{children}</div>
    </section>
  );
}

/** The last submitted completion: certificate, verification link, credential, expiry and any reimbursement claim. */
export function CompletionCard({ plan: p }) {
  const c = p.completion;
  if (!c) return null;
  const pick = (ids) => p.files.filter((f) => ids.includes(f.id));
  const r = c.reimbursement;
  const approved = p.status === "completed";
  // A completion on a plan that's back to "planned" was rejected — it's kept so the member can fix and resubmit it.
  const rejected = p.status === "planned";
  const state = approved ? `Approved ${formatDate(p.completedAt)} · ` : rejected ? "Rejected · " : "";
  return (
    <Card className={rejected ? "border-rose-200" : undefined}>
      <CardHeader title={rejected ? "Last submission" : "Completion"} description={`${state}Submitted ${formatDate(c.submittedAt)}`} />
      <div className="grid gap-5 md:grid-cols-2">
        <Section title="Completed on">{formatDate(c.completedOn)}</Section>
        <Section title="Verification link"><ExternalLinkRow href={c.verificationUrl}>{c.verificationUrl}</ExternalLinkRow></Section>
        {c.credentialId && <Section title="Credential ID"><span className="font-mono">{c.credentialId}</span></Section>}
        {c.expiresOn && <Section title="Expires"><span className={p.expired ? "font-bold text-rose-600" : undefined}>{formatDate(c.expiresOn)}{p.expired && " (expired)"}</span></Section>}
      </div>
      <div className="mt-4">
        <Section title="Certificate"><FileChips filesPath={filesPath(p.id)} files={pick(c.certificateFileIds)} /></Section>
      </div>
      {r && (
        <div className="mt-4 rounded-2xl border border-gray-200 p-4">
          <Section title={approved ? "Reimbursement approved" : "Reimbursement claimed"}>
            <span className="font-heading text-lg font-extrabold text-nu-lapis">{formatMoney(r.amount, r.currency)}</span>
          </Section>
          <div className="mt-2"><FileChips filesPath={filesPath(p.id)} files={pick(r.receiptFileIds)} /></div>
        </div>
      )}
    </Card>
  );
}
