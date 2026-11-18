"use client";

import Link from "next/link";
import { Award, Bot, ChevronRight, Lock, Users } from "lucide-react";
import { PortalShell } from "@/components/auth/portal-shell";
import { useSession } from "@/components/auth/session-provider";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { practicesHome } from "@/components/practices/practices-nav";
import { canAnywhere } from "@/lib/can";
import { cn } from "@/lib/cn";

const APP_INFO = {
  practices: { icon: Users, description: "Practices, their groups and Leads, and practice contributions", href: "/practices" },
  "cert-tracker": { icon: Award, description: "Plan certifications and courses, get completions approved", href: "/certifications" },
  // Not open yet: the tile shows "Coming soon" and isn't a link, matching the disabled sidebar entry.
  "ai-tracker": { icon: Bot, name: "Claude Usage Report", description: "Monthly Claude usage reports" },
};

function Home() {
  const { me } = useSession();
  return (
    <>
      {/* The page has no visible title — the apps card is the whole page — but screen readers still need one. */}
      <h1 className="sr-only">Home</h1>
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
              // A tile with no href isn't open yet: greyed out, dashed and not clickable, so it reads as disabled at a glance.
              const tile = (
                <div
                  aria-disabled={href ? undefined : true}
                  className={cn(
                    "h-full rounded-2xl border p-5",
                    href
                      ? "border-gray-200 transition-all hover:-translate-y-0.5 hover:border-nu-purple hover:shadow-md"
                      : "cursor-not-allowed border-dashed border-gray-300 bg-gray-50",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className={cn("flex size-10 items-center justify-center rounded-xl", href ? "bg-purple-50 text-nu-purple" : "bg-gray-200 text-gray-400")}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {href ? (
                      <ChevronRight className="size-5 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Badge variant="neutral">
                        <Lock className="size-3" aria-hidden="true" /> Coming soon
                      </Badge>
                    )}
                  </div>
                  <h3 className={cn("text-base font-bold", !href && "text-gray-400")}>{info.name ?? app.name}</h3>
                  <p className={cn("mt-1 text-xs", href ? "text-nu-muted-teal" : "text-gray-400")}>{description}</p>
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

    </>
  );
}

export default function HomePage() {
  return (
    <PortalShell breadcrumbs={[{ label: "Home" }]}>
      <Home />
    </PortalShell>
  );
}
