import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Top-of-page white card: title, description, optional back link, and actions or tabs on the right.
 * `leading` goes before the title block (e.g. a person's avatar on their profile).
 */
export function PageHeader({ title, description, back, meta, actions, leading, className }) {
  const heading = (
    <div className="min-w-0">
      {(back || meta) && (
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {back && <Link href={back.href} className="text-xs font-bold text-nu-purple hover:underline">← {back.label}</Link>}
          {meta}
        </div>
      )}
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {description && <p className="mt-1 text-xs text-nu-muted-teal">{description}</p>}
    </div>
  );
  return (
    <div className={cn("flex flex-col justify-between gap-4 rounded-3xl border border-gray-200 bg-white p-6 md:flex-row md:items-center", className)}>
      {leading ? (
        <div className="flex min-w-0 items-center gap-4">
          {leading}
          {heading}
        </div>
      ) : (
        heading
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Dark-gradient hero used on landing views (e.g. the app launcher welcome). */
export function HeroBanner({ eyebrow, title, children, className }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-nu-dark p-6 text-white shadow-xl md:p-8", className)}>
      {eyebrow && (
        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-nu-light-purple backdrop-blur-md">
          {eyebrow}
        </span>
      )}
      <h1 className="mb-2 mt-3 text-2xl font-extrabold text-white md:text-4xl">{title}</h1>
      {children && <div className="max-w-2xl text-sm text-gray-300">{children}</div>}
    </div>
  );
}
