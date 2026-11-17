"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { buttonVariants, Card, CardHeader } from "@/components/ui";
import { ContributionList } from "@/components/contributions/contribution-list";
import { useResource } from "@/hooks/use-resource";
import { can } from "@/lib/can";

/** Where "Start a contribution" goes: the form, preset to this practice and coming back here afterwards. */
export const newContributionHref = (practiceId, groupId) => `/practices/contributions/new?${new URLSearchParams({ practice: practiceId, ...(groupId && { group: groupId }) })}`;

/**
 * The page-level "Start a contribution" CTA on a practice or group page, shown on every tab to anyone who may start
 * one in the practice (`practices.contribution.create` there — anyone in it, from a group page too). UI hint only:
 * POST /contributions enforces the same permission.
 */
export function StartContributionLink({ practiceId, groupId }) {
  const { me } = useSession();
  if (!can(me, "practices.contribution.create", { type: "practice", id: practiceId })) return null;
  return (
    <Link href={newContributionHref(practiceId, groupId)} className={buttonVariants()}>
      <Plus /> Start a contribution
    </Link>
  );
}

/**
 * Contributions tab of a practice or (with `group`) a group: the same list as Practices → Contributions, limited to
 * this practice — or to work started by the group's current members, whose Lead reviews it. The "Start a
 * contribution" CTA lives in the page header (StartContributionLink), not here.
 */
export function ContributionsTab({ practice, group = null }) {
  const query = new URLSearchParams({ practiceId: practice.id, ...(group && { groupId: group.id }) });
  const { data, loading, error } = useResource(`/contributions?${query}`);

  return (
    <Card>
      <CardHeader
        title="Contributions"
        description={
          group
            ? `Started by members of ${group.name} — its Lead reviews them.`
            : `Frameworks, tools, client wins, case studies and blogs from ${practice.name}.`
        }
      />
      <ContributionList
        data={data}
        loading={loading}
        error={error}
        singlePractice
        emptyDescription={
          group
            ? `Nobody in ${group.name} has started one yet. Built a reusable framework, an internal tool or won a client? Start a contribution.`
            : undefined
        }
      />
    </Card>
  );
}
