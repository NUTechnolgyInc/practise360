import { cn } from "@/lib/cn";

/**
 * NULogic logo from the official SVGs in public/brand. Never recolour, crop or add effects —
 * `onDark` swaps to the white-wordmark file (the one approved dark variant; the gradient "g" is unchanged).
 */
export function Logo({ variant = "wordmark", onDark = false, className }) {
  if (variant === "icon") {
    return <img src="/brand/nulogic-g-icon.svg" alt="NULogic" className={cn("h-8 w-auto", className)} />;
  }
  return (
    <img
      src={onDark ? "/brand/nulogic-wordmark-white.svg" : "/brand/nulogic-wordmark.svg"}
      alt="NULogic — Infinite Innovation"
      className={cn("h-8 w-auto", className)}
    />
  );
}

export function Tagline({ className }) {
  return <div className={cn("font-heading text-xs font-light uppercase tracking-[3px] text-nu-muted-teal", className)}>Infinite Innovation</div>;
}
