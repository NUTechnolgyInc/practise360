import { UserPen } from "lucide-react";
import { Badge } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";

/** "Added by …" — shown wherever a contribution appears when someone other than its owner created it. */
export function AddedByBadge({ contribution }) {
  if (!contribution.addedBy) return null;
  return (
    <Badge variant="warning" title={`${contribution.addedBy.displayName} added this on ${contribution.owner.displayName}'s behalf`}>
      <UserPen className="size-3" aria-hidden="true" /> Added by <PersonLink person={contribution.addedBy} className="font-semibold" />
    </Badge>
  );
}
