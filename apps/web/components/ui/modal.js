"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Accessible dialog: Escape and backdrop click close it, focus moves in on open and back on close.
 * Put the form inside `children` and the buttons in `footer` so the footer stays visible while the body scrolls.
 */
export function Modal({ open, onClose, title, description, footer, children, className }) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn("flex max-h-[90vh] w-full max-w-xl animate-fade-in flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl outline-none", className)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-nu-muted-teal">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
