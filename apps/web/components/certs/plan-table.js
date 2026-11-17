import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge, StatusBadge, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PersonChip, PersonLink } from "@/components/people/person-link";
import { SOURCES, certTypeLabel, formatMoney, isOpen, planStatusLabel, plansPath } from "@/lib/certifications";
import { formatDate } from "@/lib/format";

function When({ plan: p }) {
  if (p.status === "completed") {
    return (
      <span className={p.expired ? "font-bold text-rose-600" : undefined}>
        Done {formatDate(p.completedOn)}
        {p.expiresOn && <span className="block text-[11px] font-normal text-nu-muted-teal">{p.expired ? "Expired" : "Expires"} {formatDate(p.expiresOn)}</span>}
      </span>
    );
  }
  if (!isOpen(p.status)) return <span className="text-gray-400">—</span>;
  if (!p.dueDate) return <span className="text-gray-400">No due date</span>;
  return (
    <span className={p.overdue ? "inline-flex items-center gap-1 font-bold text-rose-600" : undefined}>
      {p.overdue && <AlertTriangle className="size-3.5" aria-hidden="true" />}
      {formatDate(p.dueDate)}
      {p.overdue && <span className="sr-only"> (overdue)</span>}
    </span>
  );
}

/** Certification plans. `showOwner` adds the member column (team views), `showPractice` the practice column. */
export function PlanTable({ rows, showOwner, showPractice }) {
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Certification</TH>
          {showOwner && <TH>Member</TH>}
          {showPractice && <TH>Practice</TH>}
          <TH>Status</TH>
          <TH className="whitespace-nowrap">Due / done</TH>
          <TH className="text-right">Reimbursement</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((p) => (
          <TR key={p.id}>
            <TD className="min-w-56">
              <Link href={plansPath(p.id)} className="text-sm font-bold text-nu-navy hover:text-nu-purple hover:underline">
                {p.cert.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-nu-muted-teal">
                {certTypeLabel(p.cert.type)}
                {p.cert.provider && <span>· {p.cert.provider}</span>}
                {p.source !== "self" && <Badge variant={p.source === "assigned" ? "primary" : "teal"}>{SOURCES[p.source]} by <PersonLink person={p.createdBy} className="font-semibold" /></Badge>}
                {p.awaitingMe && <Badge variant="purple">Awaiting your review</Badge>}
                {p.mine && p.status === "suggested" && <Badge variant="warning">Respond</Badge>}
              </div>
            </TD>
            {showOwner && (
              <TD className="min-w-36">
                <PersonChip person={p.owner} subtitle={p.owner.username} size="sm" />
              </TD>
            )}
            {showPractice && <TD className="whitespace-nowrap">{p.practice.name}</TD>}
            <TD>
              <StatusBadge status={planStatusLabel(p.status)} />
            </TD>
            <TD className="whitespace-nowrap">
              <When plan={p} />
            </TD>
            {/* A rejected completion keeps its claim for resubmission — don't show it as if it were pending. */}
            <TD className="whitespace-nowrap text-right">{p.reimbursement && p.status !== "planned" ? formatMoney(p.reimbursement.amount, p.reimbursement.currency) : <span className="text-gray-400">—</span>}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
