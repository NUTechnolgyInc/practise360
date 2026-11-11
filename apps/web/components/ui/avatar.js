import { cn } from "@/lib/cn";

const SIZES = { sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-10 text-sm" };

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

/** Avatar with name and a secondary line (username, role). */
export function UserChip({ name, subtitle, size = "md", className }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar name={name} size={size} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-nu-navy">{name}</div>
        {subtitle && <div className="truncate text-[11px] text-gray-400">{subtitle}</div>}
      </div>
    </div>
  );
}
