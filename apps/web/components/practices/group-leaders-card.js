import { Crown, Mail, UserCog } from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";
import { PersonChip } from "@/components/people/person-link";

/**
 * Who runs a group, at the top of its page: the group's Lead — with Choose / Change / Remove when the API says the
 * caller may appoint one (`group.actions.setLead`) — and the practice's Manager. `pendingLead` = an open invitation.
 */
export function GroupLeadersCard({ practice, group, pendingLead, onChooseLead, onRemoveLead }) {
  const { lead } = group;
  const manager = practice.managers[0] ?? null;

  return (
    <Card className="grid gap-4 md:grid-cols-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-nu-navy">
            <Crown className="size-4 text-nu-purple" aria-hidden="true" /> Practice Lead
          </p>
          {lead ? (
            <PersonChip person={lead} subtitle={lead.email || lead.username} />
          ) : pendingLead ? (
            <Badge variant="purple" title="They become Lead when they accept the invitation">
              <Mail className="size-3" aria-hidden="true" /> {pendingLead.email} invited
            </Badge>
          ) : (
            <Badge variant="warning">No Lead yet</Badge>
          )}
        </div>
        {group.actions.setLead && (
          <div className="flex gap-1">
            <Button variant="secondary" size="sm" onClick={onChooseLead}>
              <UserCog /> {lead ? "Change Lead" : "Choose Lead"}
            </Button>
            {lead && (
              <Button variant="ghost" size="sm" onClick={onRemoveLead}>Remove</Button>
            )}
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
        <p className="text-xs font-bold uppercase tracking-wider text-nu-navy">Practice Manager</p>
        {manager ? <PersonChip person={manager} subtitle={manager.email || manager.username} /> : <Badge variant="warning">Not chosen yet</Badge>}
      </div>
    </Card>
  );
}
