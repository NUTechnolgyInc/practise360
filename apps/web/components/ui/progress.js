import { cn } from "@/lib/cn";

/** `label` is visible text; pass `aria-label` instead when the bar sits in a table cell with no room for text. */
export function Progress({ value = 0, label, showValue = true, className, barClassName, "aria-label": ariaLabel }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500">
          <span>{label}</span>
          {showValue && <span>{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
      >
        <div className={cn("h-full rounded-full bg-nu-purple transition-[width]", barClassName)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
