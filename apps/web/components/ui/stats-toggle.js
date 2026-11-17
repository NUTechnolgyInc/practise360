"use client";

import { BarChart3 } from "lucide-react";
import { Button } from "./button";

/**
 * Shows or hides a page's count tiles. Controlled (pair it with `useShowStats()`); `controls` is the id of the
 * tiles' container so screen readers know what it opens.
 */
export function StatsToggle({ shown, onToggle, controls, className }) {
  return (
    <Button variant="secondary" size="sm" onClick={onToggle} aria-expanded={shown} aria-controls={controls} className={className}>
      <BarChart3 aria-hidden="true" /> {shown ? "Hide stats" : "Show stats"}
    </Button>
  );
}
