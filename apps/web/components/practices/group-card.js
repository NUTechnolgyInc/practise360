import Link from "next/link";
import { ArrowRight, Crown, Mail, Pencil, Trash2, UserCog } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";

const SHOWN = 8;

/**
 * One group on the practice page: Lead, members, and the actions the API says the caller may take (`group.actions`).
 * Delete only appears for an empty group — the API refuses it otherwise. `pendingLead` = an open invitation to lead it.
 * `href` = the group's own page (Overview, Members, Contributions).
 */
export function GroupCard({ group, href, pendingLead, onChooseLead, onRemoveLead, onRename, onDelete }) {
  const { actions, lead } = group;
  const members = group.members ?? [];
  const empty = !lead && group.memberCount === 0;

  return (
    <section aria-labelledby={`group-${group.id}`} className="flex flex-col rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`group-${group.id}`} className="truncate text-base font-bold">
            <Link href={href} className="rounded-sm hover:text-nu-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple">
              {group.name}
            </Link>
          </h3>
          {group.description && <p className="mt-0.5 text-xs text-nu-muted-teal">{group.description}</p>}
        </div>
        {(actions.edit || (actions.delete && empty)) && (
          <div className="flex shrink-0 gap-1">
            {actions.edit && (
              <Button variant="ghost" size="icon" onClick={onRename} aria-label={`Rename ${group.name}`}>
                <Pencil />
              </Button>
            )}
            {actions.delete && empty && (
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Delete ${group.name}`}>
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Crown className="size-4 shrink-0 text-nu-purple" aria-hidden="true" />
          <span className="font-bold uppercase tracking-wider text-nu-navy">Lead</span>
          {lead ? (
            <PersonLink person={lead} className="truncate font-semibold text-nu-navy" />
          ) : pendingLead ? (
            <Badge variant="purple" title={`${pendingLead.email} becomes Lead when they accept the invitation`}>
              <Mail className="size-3" aria-hidden="true" /> Invited
            </Badge>
          ) : (
            <Badge variant="warning">No Lead yet</Badge>
          )}
        </div>
        {actions.setLead && (
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={onChooseLead}>
              <UserCog /> {lead ? "Change" : "Choose Lead"}
            </Button>
            {lead && (
              <Button variant="ghost" size="sm" onClick={onRemoveLead}>Remove</Button>
            )}
          </div>
        )}
      </div>
      {pendingLead && (
        <p className="mt-1.5 truncate px-1 text-[11px] text-nu-muted-teal">
          {pendingLead.email} {lead ? "is invited to take over as Lead" : "is invited to lead this group"}
        </p>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
        </p>
        {members.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {members.slice(0, SHOWN).map((m) => (
              <li key={m.id}>
                <PersonLink person={m} avatar className="rounded-full border border-gray-200 py-0.5 pl-0.5 pr-2.5 text-xs text-nu-navy hover:border-purple-200" />
              </li>
            ))}
            {members.length > SHOWN && <li className="self-center text-xs text-gray-400">+{members.length - SHOWN} more</li>}
          </ul>
        )}
      </div>

      <Link href={href} className="mt-auto inline-flex items-center gap-1 self-start pt-4 text-xs font-bold text-nu-purple hover:underline" aria-label={`Open ${group.name}`}>
        Open group <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
