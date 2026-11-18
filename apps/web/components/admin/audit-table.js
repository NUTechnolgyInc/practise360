import { Badge, StatusBadge, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";
import { entryFields, formatDateTime, OUTCOME_LABEL } from "@/lib/audit";

const SHOWN_FIELDS = 3;

function Fields({ entry, names }) {
  const fields = entryFields(entry, names);
  if (!fields.length) return <span className="text-gray-400">—</span>;
  const row = (f) => (
    <li key={f.key} className="break-words">
      <span className="font-semibold text-nu-navy">{f.label}:</span> {f.value}
    </li>
  );
  return (
    <div className="space-y-1">
      <ul className="space-y-0.5">{fields.slice(0, SHOWN_FIELDS).map(row)}</ul>
      {fields.length > SHOWN_FIELDS && (
        <details>
          <summary className="cursor-pointer text-[11px] font-semibold text-nu-purple">{fields.length - SHOWN_FIELDS} more</summary>
          <ul className="mt-0.5 space-y-0.5">{fields.slice(SHOWN_FIELDS).map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function Actor({ entry }) {
  if (entry.actor) return <PersonChip person={entry.actor} subtitle={entry.actor.username ?? undefined} size="sm" />;
  return <span className="text-nu-muted-teal">No one signed in</span>;
}

/** One row per recorded action, newest first. Read-only: the log can't be edited from the portal. */
export function AuditTable({ entries, names }) {
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          <TH className="whitespace-nowrap">When</TH>
          <TH>Who</TH>
          <TH>Action</TH>
          <TH>Details</TH>
          <TH>Outcome</TH>
        </TR>
      </THead>
      <TBody>
        {entries.map((e) => (
          <TR key={e.id} className="align-top">
            <TD className="whitespace-nowrap">
              <time dateTime={e.at} className="font-mono">{formatDateTime(e.at)}</time>
              {e.ip && <div className="mt-0.5 font-mono text-[11px] text-gray-400" title={e.userAgent ?? undefined}>{e.ip}</div>}
            </TD>
            <TD className="min-w-40">
              <Actor entry={e} />
            </TD>
            <TD className="min-w-52">
              <div className="text-sm font-bold text-nu-navy">{e.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="purple">{e.category}</Badge>
                <code className="font-mono text-[11px] text-nu-muted-teal">{e.method} {e.route}</code>
              </div>
            </TD>
            <TD className="min-w-56 max-w-md">
              <Fields entry={e} names={names} />
              {e.error && <p className="mt-1 text-rose-600">{e.error}</p>}
            </TD>
            <TD className="whitespace-nowrap">
              <StatusBadge status={OUTCOME_LABEL[e.outcome] ?? e.outcome} />
              <div className="mt-0.5 font-mono text-[11px] text-gray-400">HTTP {e.status}</div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
