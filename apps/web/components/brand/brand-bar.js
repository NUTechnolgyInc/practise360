import { cn } from "@/lib/cn";

/** Thin brand-gradient strip pinned to the top of every authenticated page. */
export function BrandBar({ className }) {
  return <div aria-hidden="true" className={cn("h-1.5 w-full bg-nu-brand-bar", className)} />;
}
