import { cn } from "@/lib/cn";

const TONES = {
  purple: "border-purple-100 bg-purple-50 [&_dt]:text-nu-purple",
  success: "border-emerald-100 bg-emerald-50 [&_dt]:text-emerald-700",
  info: "border-blue-100 bg-blue-50 [&_dt]:text-blue-700",
  danger: "border-rose-100 bg-rose-50 [&_dt]:text-rose-700",
  neutral: "border-gray-100 bg-gray-50 [&_dt]:text-gray-500",
};

export function StatTile({ label, value, hint, tone = "purple", className }) {
  return (
    <dl className={cn("rounded-2xl border p-4", TONES[tone], className)}>
      <dt className="text-xs font-bold">{label}</dt>
      <dd className="mt-1 font-heading text-2xl font-extrabold text-nu-lapis">{value}</dd>
      {hint && <dd className="mt-0.5 text-[11px] text-gray-500">{hint}</dd>}
    </dl>
  );
}
