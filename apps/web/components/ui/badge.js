import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", {
  variants: {
    variant: {
      neutral: "border-gray-200 bg-gray-100 text-gray-700",
      primary: "border-indigo-200 bg-indigo-50 font-semibold text-nu-lapis",
      purple: "border-purple-200 bg-purple-50 text-nu-purple",
      success: "border-emerald-200 bg-emerald-50 text-emerald-700",
      warning: "border-amber-200 bg-amber-50 text-amber-700",
      danger: "border-rose-200 bg-rose-50 text-rose-700",
      teal: "border-teal-200 bg-teal-50 text-nu-dark-teal",
    },
  },
  defaultVariants: { variant: "neutral" },
});

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// Single source for status → colour so the same status never shows in two colours.
const STATUS_VARIANT = {
  // Certification plan lifecycle
  Suggested: "teal",
  Planned: "neutral",
  "In Progress": "purple",
  Completed: "warning",
  Verified: "success",
  Overdue: "danger",
  // AI initiative lifecycle
  Idea: "neutral",
  PoC: "purple",
  Pilot: "primary",
  Production: "success",
  // Claude usage report submission
  Submitted: "success",
  Pending: "warning",
};

export function StatusBadge({ status, className }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "neutral"} className={className}>
      {status}
    </Badge>
  );
}
