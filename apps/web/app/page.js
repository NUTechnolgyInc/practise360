"use client";

import Link from "next/link";
import { Award, Bot, ChevronRight, Settings, ShieldCheck, Users } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { HeroBanner } from "@/components/layout";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { practicesHome } from "@/components/practices/practices-nav";
import { canAnywhere, RBAC_PORTAL_PERMS } from "@/lib/can";
import { cn } from "@/lib/cn";

const APP_INFO = {
  practices: { icon: Users, description: "Practices, their groups and Leads, and practice contributions", href: "/practices" },
  "cert-tracker": { icon: Award, description: "Plan certifications and courses, get completions approved", href: "/certifications" },
  // Not open yet: the tile shows "Coming soon" and isn't a link, matching the disabled sidebar entry.
  "ai-tracker": { icon: Bot, name: "Claude Usage Report", description: "Monthly Claude usage reports" },
};

function Home() {
  const { me } = useSession();
  const showAccess = canAnywhere(me, ...RBAC_PORTAL_PERMS);

  return (
    <>
      <HeroBanner eyebrow="Practise360" title={`Welcome, ${me.displayName.split(" ")[0]}`}>
        {me.apps.length === 0
          ? "You're signed in. You're not part of a practice yet, so there's nothing to open here for now."
          : `You can see ${me.apps.length} ${me.apps.length === 1 ? "app" : "apps"} based on your role assignments.`}
      </HeroBanner>

      <Card>
        <CardHeader title="Your apps" description="Apps open up as they're built — access already follows your roles." />
        {me.apps.length === 0 ? (
          <EmptyState
            title="No apps yet"
            description="Ask your Practice Manager to add you to their practice. Your apps show up here the next time you open Practise360 — no need to sign in again."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {me.apps.map((app) => {
              const info = APP_INFO[app.id] ?? { icon: Users, description: "" };
              const { icon: Icon, description } = info;
              // A custom role can open the Practices app without any screen in it — don't link to a dead end.
              const practicesScreen = canAnywhere(me, "practices.practice.view", "practices.contribution.view");
              const href = app.id === "practices" ? (practicesScreen ? practicesHome(me) : undefined) : info.href;
              const tile = (
                <div className={cn("h-full rounded-2xl border border-gray-200 p-5", href && "transition-all hover:-translate-y-0.5 hover:border-nu-purple hover:shadow-md")}>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-purple-50 text-nu-purple">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {href ? <ChevronRight className="size-5 text-gray-400" aria-hidden="true" /> : <Badge variant="neutral">Coming soon</Badge>}
                  </div>
                  <h3 className="text-base font-bold">{info.name ?? app.name}</h3>
                  <p className="mt-1 text-xs text-nu-muted-teal">{description}</p>
                </div>
              );
              return href ? (
                <Link key={app.id} href={href} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple">
                  {tile}
                </Link>
              ) : (
                <div key={app.id}>{tile}</div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {showAccess && (
          <QuickLink href="/access-control" icon={ShieldCheck} title="Access control" text="Assign roles, manage custom roles and review permissions." />
        )}
        <QuickLink href="/settings" icon={Settings} title="Settings" text="Your account, role assignments and effective permissions." />
      </div>
    </>
  );
}

function QuickLink({ href, icon: Icon, title, text }) {
  return (
    <Link href={href} className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple">
      <Card interactive className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-nu-lapis text-white">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-xs text-nu-muted-teal">{text}</p>
        </div>
        <ChevronRight className="size-5 text-gray-400" aria-hidden="true" />
      </Card>
    </Link>
  );
}

export default function HomePage() {
  return (
    <PortalShell breadcrumbs={[{ label: "Home" }]}>
      <Home />
    </PortalShell>
  );
}
