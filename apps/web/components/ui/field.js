import { cn } from "@/lib/cn";

const control =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-nu-dark-teal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-nu-purple disabled:bg-gray-50 aria-[invalid=true]:border-rose-300 aria-[invalid=true]:ring-rose-200";

export function Label({ className, ...props }) {
  return <label className={cn("mb-1 block text-xs font-bold uppercase tracking-wider text-nu-navy", className)} {...props} />;
}

export function Input({ className, ...props }) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(control, className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(control, className)} {...props}>
      {children}
    </select>
  );
}

/** Label + control + hint/error, wired for screen readers via `id`. */
export function Field({ id, label, hint, error, children, className }) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {typeof children === "function" ? children({ id, "aria-describedby": describedBy, "aria-invalid": !!error }) : children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">{error}</p>
      ) : (
        hint && <p id={`${id}-hint`} className="mt-1 text-[11px] text-gray-400">{hint}</p>
      )}
    </div>
  );
}
