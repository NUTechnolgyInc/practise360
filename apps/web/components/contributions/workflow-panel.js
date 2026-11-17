import { Check, ExternalLink } from "lucide-react";
import { Card, CardHeader, Markdown } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { FileChips } from "./attachments";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Where the contribution is in In progress → Lead review → Manager review → Published, and who signed off. */
export function WorkflowStepper({ contribution: c }) {
  const order = ["in_progress", "lead_review", "manager_review", "published"];
  const at = c.status === "clarification" ? (c.clarificationStage === "manager" ? 2 : 1) : c.status === "declined" ? -1 : order.indexOf(c.status);
  const steps = [
    { label: "In progress", sub: `Due ${formatDate(c.dueDate)}` },
    { label: "Lead review", sub: c.leadReview ? <>Approved by <PersonLink person={c.leadReview.by} className="font-semibold" /></> : c.status === "clarification" && c.clarificationStage === "lead" ? "Waiting on the owner's reply" : "Practice Lead" },
    { label: "Manager review", sub: c.managerReview ? <>Approved by <PersonLink person={c.managerReview.by} className="font-semibold" /></> : c.status === "clarification" && c.clarificationStage === "manager" ? "Waiting on the owner's reply" : "Practice Manager" },
    { label: "Published", sub: c.publishedAt ? formatDate(c.publishedAt) : "Visible to the practice" },
  ];

  return (
    <Card>
      <CardHeader title="Review progress" />
      {c.status === "declined" && <p className="mb-3 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">Declined — see the reviewer's comment in the activity log.</p>}
      <ol className="space-y-3">
        {steps.map((s, i) => {
          const done = at > i || c.status === "published";
          const current = at === i && c.status !== "published";
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

function LinkRow({ label, url }) {
  return (
    <li>
      <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs font-semibold text-nu-purple hover:underline">
        <ExternalLink className="size-3.5" aria-hidden="true" /> {label}
      </a>
    </li>
  );
}

/** What the owner handed in: summary, impact, links and documents. */
export function SubmissionCard({ contribution: c }) {
  const s = c.submission;
  if (!s) return null;
  const docs = c.files.filter((f) => s.fileIds.includes(f.id));
  const links = [s.repoUrl && { label: "Repository", url: s.repoUrl }, s.demoUrl && { label: "Demo", url: s.demoUrl }, ...(s.links || []).map((l) => ({ label: l.label || l.url, url: l.url }))].filter(Boolean);

  return (
    <Card>
      <CardHeader title="Submission" description={`Submitted ${formatDate(s.submittedAt)}`} />
      <div className="grid gap-5 md:grid-cols-2">
        <section>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Summary</h4>
          <Markdown>{s.summary}</Markdown>
        </section>
        <section>
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Impact</h4>
          <Markdown>{s.impact}</Markdown>
        </section>
      </div>
      {links.length > 0 && (
        <section className="mt-4">
          <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">Links</h4>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">{links.map((l) => <LinkRow key={l.url + l.label} {...l} />)}</ul>
        </section>
      )}
      <section className="mt-4">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">Documents</h4>
        <FileChips contributionId={c.id} files={docs} />
      </section>
    </Card>
  );
}
