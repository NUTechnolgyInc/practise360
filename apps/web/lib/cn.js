import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge lets a caller's className override a variant's classes (e.g. `px-6` beats `px-4`).
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
