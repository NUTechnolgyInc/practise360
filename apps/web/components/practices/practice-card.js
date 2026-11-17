import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Overview tile for one practice: Manager, each group with its Lead and size. The title's link is stretched over the
 * whole card so it stays one click target; the people links sit above it (z-10) and open profiles instead.
 */
export function PracticeCard({ practice }) {
  const manager = practice.managers[0];
  const titleId = `practice-${practice.id}`;
  return (
    <Card interactive role="region" aria-labelledby={titleId} className="relative flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate text-lg font-bold">
            <Link href={`/practices/${practice.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-nu-purple">
              {practice.name}
            </Link>
          </h2>
          {practice.description && <p className="mt-0.5 line-clamp-2 text-xs text-nu-muted-teal">{practice.description}</p>}
        </div>
        <ChevronRight className="mt-1 size-5 shrink-0 text-gray-400" aria-hidden="true" />
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="font-bold uppercase tracking-wider text-nu-navy">Manager</span>
        {manager ? (
          <PersonLink person={manager} avatar className="relative z-10 font-semibold text-nu-navy" />
        ) : (
          <Badge variant="warning">Not chosen yet</Badge>
        )}
      </div>

      {practice.groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-3 text-xs text-gray-400">No groups yet</p>
      ) : (
        <ul className="space-y-1.5" aria-label={`${practice.name} groups`}>
          {practice.groups.map((g) => (
            <li key={g.id} className="flex items-center justify-between gap-3 rounded-2xl bg-gray-50 px-3 py-2 text-xs">
              <span className="min-w-0 truncate font-bold text-nu-navy">{g.name}</span>
              <span className="flex shrink-0 items-center gap-2">
                {g.lead ? (
                  <span className="text-nu-muted-teal">
                    Lead <PersonLink person={g.lead} className="relative z-10" />
                  </span>
                ) : (
                  <Badge variant="warning">No Lead yet</Badge>
                )}
                <span className="flex items-center gap-1 text-gray-400" title="Members">
                  <Users className="size-3.5" aria-hidden="true" /> {g.memberCount}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto pt-4 text-[11px] text-gray-400">
        {plural(practice.memberCount, "member")} · {plural(practice.groups.length, "group")}
        {practice.unassignedCount > 0 && ` · ${practice.unassignedCount} not in a group`}
      </p>
    </Card>
  );
}
