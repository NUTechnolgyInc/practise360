"use client";

import Link from "next/link";
import { Award, Building2, Rocket } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { plansPath } from "@/lib/certifications";
import { typeLabel } from "@/lib/contributions";
import { formatDate } from "@/lib/format";

const HIGHLIGHTS = 5;
const LINK = "rounded-sm font-bold text-nu-navy hover:text-nu-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple";

/** One practice the person is in: their group and roles there. Links to the practice when the viewer can open it. */
function PracticeRow({ practice: p }) {
  const { can } = useSession();
  const canOpen = can("practices.practice.view", { type: "practice", id: p.id });
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        {canOpen ? <Link href={`/practices/${p.id}`} className={`text-sm ${LINK}`}>{p.name}</Link> : <span className="text-sm font-bold text-nu-navy">{p.name}</span>}
        {p.group && <p className="text-[11px] text-nu-muted-teal">{p.group.name} group</p>}
      </div>
      <div className="flex flex-wrap gap-1">
        {p.roles.map((r) => <Badge key={r} variant={r === "Practice Manager" ? "primary" : "neutral"}>{r}</Badge>)}
        {p.groupRoles.map((g) => <Badge key={g.group.id} variant="purple">Lead · {g.group.name}</Badge>)}
      </div>
    </li>
  );
}

function RolesCard({ profile: p, firstName }) {
  const empty = p.practices.length === 0 && p.appRoles.length === 0;
  return (
    <Card>
      <CardHeader title="Practices & roles" description={p.isSelf ? "Where you work and what your roles let you do." : `Where ${firstName} works — as far as your access shows.`} />
      {empty ? (
        <EmptyState icon={Building2} title="No roles you can see" description={`${firstName} isn't in any practice you're part of.`} className="border-none p-6" />
      ) : (
        <div className="space-y-4">
          {p.practices.length > 0 && <ul className="space-y-2" aria-label="Practices">{p.practices.map((x) => <PracticeRow key={x.id} practice={x} />)}</ul>}
          {p.appRoles.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">App roles</h3>
              <div className="flex flex-wrap gap-1">
                {p.appRoles.map((r) => <Badge key={`${r.roleId}@${r.scopeId}`} variant="primary">{r.roleName} @ {r.scopeLabel}</Badge>)}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function HighlightList({ icon: Icon, title, items }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <Icon className="size-3.5" aria-hidden="true" /> {title}
      </h3>
      <ul className="divide-y divide-gray-100">
        {items.map((i) => (
          <li key={i.href} className="flex items-baseline justify-between gap-3 py-2 text-xs">
            <span className="min-w-0">
              <Link href={i.href} className={LINK}>{i.title}</Link>
              <span className="block text-[11px] text-nu-muted-teal">{i.meta}</span>
            </span>
            <span className="shrink-0 text-[11px] text-gray-400">{formatDate(i.date)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Published contributions and completed certifications, newest first — only from sections the API returned. */
function HighlightsCard({ profile: p }) {
  const published = (p.contributions ?? [])
    .filter((c) => c.status === "published")
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, HIGHLIGHTS)
    .map((c) => ({ href: `/practices/contributions/${c.id}`, title: c.title, meta: `${typeLabel(c)} · ${c.practice.name}`, date: c.publishedAt }));
  const earned = (p.certifications ?? [])
    .filter((x) => x.status === "completed")
    .sort((a, b) => new Date(b.completedOn) - new Date(a.completedOn))
    .slice(0, HIGHLIGHTS)
    .map((x) => ({ href: plansPath(x.id), title: x.cert.title, meta: [x.cert.provider, x.expired && "Expired"].filter(Boolean).join(" · ") || x.practice.name, date: x.completedOn }));
  if (!published.length && !earned.length) return null;

  return (
    <Card>
      <CardHeader title="Highlights" description="Latest published work and certifications earned." />
      <div className="space-y-5">
        {published.length > 0 && <HighlightList icon={Rocket} title="Published contributions" items={published} />}
        {earned.length > 0 && <HighlightList icon={Award} title="Certifications earned" items={earned} />}
      </div>
    </Card>
  );
}

export function ProfileOverview({ profile, firstName }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <RolesCard profile={profile} firstName={firstName} />
      <HighlightsCard profile={profile} />
    </div>
  );
}
