import Link from "next/link";
import { cn } from "@/lib/cn";

const SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm", xl: "size-16 text-xl" };

export function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function Avatar({ name, size = "md", className }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-nu-lapis font-bold text-white shadow-sm", SIZES[size], className)}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Avatar with name and a secondary line (username, role). With `href`, the avatar and name link there (e.g. a profile);
 * no prefetch, since chips come in long lists.
 */
export function UserChip({ name, subtitle, size = "md", href, className }) {
  const body = (
    <>
      <Avatar name={name} size={size} />
      <div className="min-w-0">
        <div className={cn("truncate text-sm font-semibold text-nu-navy", href && "group-hover:text-nu-purple group-hover:underline")}>{name}</div>
        {subtitle && <div className="truncate text-[11px] text-gray-400">{subtitle}</div>}
      </div>
    </>
  );
  if (!href) return <div className={cn("flex min-w-0 items-center gap-2", className)}>{body}</div>;
  return (
    <Link href={href} prefetch={false} className={cn("group inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple", className)}>
      {body}
    </Link>
  );
}
