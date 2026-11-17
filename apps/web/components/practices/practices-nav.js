"use client";

import { useRouter } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { Tabs } from "@/components/ui";
import { canAnywhere } from "@/lib/can";

const VIEWS = [
  { value: "/practices", label: "Overview", perm: "practices.practice.view" },
  { value: "/practices/contributions", label: "Contributions", perm: "practices.contribution.view" },
];

/** Practices app sections. Shows only the sections the user's roles open; nothing when there's just one. */
export function PracticesNav({ current }) {
  const router = useRouter();
  const { me } = useSession();
  const tabs = VIEWS.filter((v) => canAnywhere(me, v.perm));
  if (tabs.length < 2) return null;
  return <Tabs aria-label="Practices sections" tabs={tabs} value={current} onChange={(href) => router.push(href)} />;
}

/** Where the Practices app opens for this user: the overview, or contributions for roles that only see those. */
export const practicesHome = (me) => (canAnywhere(me, "practices.practice.view") ? "/practices" : "/practices/contributions");
