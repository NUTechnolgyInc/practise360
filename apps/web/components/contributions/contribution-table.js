import Link from "next/link";
import { AlertTriangle, Users } from "lucide-react";
import { Badge, StatusBadge, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { statusLabel, typeLabel } from "@/lib/contributions";
import { formatDate } from "@/lib/format";

/** Contributions list. `showPractice` adds the practice column for people who see several practices. */
export function ContributionTable({ rows, showPractice }) {
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          <TH>Contribution</TH>
          {showPractice && <TH>Practice</TH>}
          <TH>Started by</TH>
          <TH>Status</TH>
          <TH className="whitespace-nowrap">Due</TH>
          <TH className="text-right">People</TH>
        </TR>
      </THead>
      <TBody>
        {rows.map((c) => (
          <TR key={c.id}>
            <TD className="min-w-48">
              <Link href={`/practices/contributions/${c.id}`} className="text-sm font-bold text-nu-navy hover:text-nu-purple hover:underline">
                {c.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-nu-muted-teal">
                {typeLabel(c)}
                {c.awaitingMe && <Badge variant="purple">Awaiting your review</Badge>}
                {c.pendingJoinRequests > 0 && c.mine && <Badge variant="teal">{c.pendingJoinRequests} join request{c.pendingJoinRequests > 1 ? "s" : ""}</Badge>}
              </div>
            </TD>
            {showPractice && <TD className="whitespace-nowrap">{c.practice.name}</TD>}
            <TD className="min-w-36">
              <PersonChip person={c.owner} subtitle={`Started ${formatDate(c.startDate)}`} size="sm" />
            </TD>
            <TD>
              <StatusBadge status={statusLabel(c.status)} />
            </TD>
            <TD className="whitespace-nowrap">
              <span className={c.overdue ? "inline-flex items-center gap-1 font-bold text-rose-600" : undefined}>
                {c.overdue && <AlertTriangle className="size-3.5" aria-hidden="true" />}
                {formatDate(c.dueDate)}
                {c.overdue && <span className="sr-only"> (overdue)</span>}
              </span>
            </TD>
            <TD className="text-right">
              <span className="inline-flex items-center gap-1 text-nu-muted-teal" title={`Owner + ${c.contributorCount} contributor(s)`}>
                <Users className="size-3.5" aria-hidden="true" /> {c.contributorCount + 1}
              </span>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
