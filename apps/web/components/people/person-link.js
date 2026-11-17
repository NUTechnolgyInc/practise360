import Link from "next/link";
import { Avatar, UserChip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { profilePath } from "@/lib/people";

// `person` is the API's { id, username, displayName }. A deleted account comes back as "unknown" — there's no
// profile to open, so it renders as plain text.
const linkable = (person) => !!person?.id && person.username !== "unknown";

// No prefetch: a list can show dozens of people, and prefetching every profile would fire a request per name.
const LINK = "rounded-sm hover:text-nu-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple";

/**
 * A person's name linking to their profile, for names inside text ("Approved by …"). Inherits the surrounding colour
 * and weight; pass `className` to change them. `avatar` adds a small avatar in front.
 */
export function PersonLink({ person, avatar = false, className, children }) {
  if (!person) return null;
  const content = (
    <>
      {avatar && <Avatar name={person.displayName} size="sm" />}
      {children ?? person.displayName}
    </>
  );
  const layout = avatar && "inline-flex min-w-0 items-center gap-1.5";
  if (!linkable(person)) return <span className={cn(layout, className)}>{content}</span>;
  return (
    <Link href={profilePath(person.id)} prefetch={false} className={cn(LINK, layout, className)}>
      {content}
    </Link>
  );
}

/** UserChip (avatar, name, subtitle) linking to the person's profile. Keep `subtitle` plain text — it's inside the link. */
export function PersonChip({ person, subtitle, size, className }) {
  return <UserChip name={person.displayName} subtitle={subtitle} size={size} href={linkable(person) ? profilePath(person.id) : undefined} className={className} />;
}
