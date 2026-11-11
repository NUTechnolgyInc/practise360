"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Loader2, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui";
import { usePdfDocument } from "@/hooks/use-pdf-document";
import { PdfPage } from "./pdf-page";

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const GUTTER = 48;

/**
 * Full-screen in-app PDF viewer: page navigation, zoom (fit width + steps), download, keyboard shortcuts.
 * `load` returns a Blob — the API needs the bearer token, so the viewer fetches instead of pointing an iframe at a URL.
 */
export function PdfViewer({ open, onClose, load, title, subtitle, fileName }) {
  const [blob, setBlob] = useState(null);
  const [loadError, setLoadError] = useState("");
  const { pages, error: parseError } = usePdfDocument(blob);
  const [zoom, setZoom] = useState("fit");
  const [fitScale, setFitScale] = useState(1);
  const [current, setCurrent] = useState(1);
  const scrollRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setBlob(null);
    setLoadError("");
    setZoom("fit");
    setCurrent(1);
    load()
      .then((b) => !cancelled && setBlob(b))
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
  }, [open, load]);

  // Fit-to-width follows the window size; capped so a wide screen doesn't blow pages up to poster size.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pages.length) return undefined;
    const widest = Math.max(...pages.map((p) => p.width));
    const ro = new ResizeObserver(() => setFitScale(Math.min(1.3, Math.max(0.3, (el.clientWidth - GUTTER) / widest))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pages]);

  const scale = zoom === "fit" ? fitScale : zoom;
  const total = pages.length;
  const goTo = useCallback((n) => {
    document.getElementById(`pdf-page-${n}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);
  const step = (dir) => {
    const next = dir > 0 ? ZOOMS.find((z) => z > scale + 0.01) : [...ZOOMS].reverse().find((z) => z < scale - 0.01);
    if (next) setZoom(next);
  };
  const download = () => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: fileName || "report.pdf" }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.target.tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(Math.min(total, current + 1));
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(Math.max(1, current - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open, onClose, goTo, total, current]);

  if (!open) return null;
  const error = loadError || parseError;

  return (
    <div role="dialog" aria-modal="true" aria-label={`${title} — PDF viewer`} className="fixed inset-0 z-50 flex flex-col bg-nu-navy/95 backdrop-blur-sm">
      <div className="h-1 bg-nu-brand-bar" />
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3 text-white">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <FileText className="size-5 shrink-0 text-nu-light-purple" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">{title}</h2>
            {subtitle && <p className="truncate text-[11px] text-gray-300">{subtitle}</p>}
          </div>
        </div>

        {total > 0 && (
          <div className="order-last flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
            <ToolButton label="Previous page" onClick={() => goTo(current - 1)} disabled={current <= 1}><ChevronLeft /></ToolButton>
            <PageInput current={current} total={total} onGo={goTo} />
            <ToolButton label="Next page" onClick={() => goTo(current + 1)} disabled={current >= total}><ChevronRight /></ToolButton>
            <span className="mx-2 h-5 w-px bg-white/20" aria-hidden="true" />
            <ToolButton label="Zoom out" onClick={() => step(-1)} disabled={scale <= ZOOMS[0]}><ZoomOut /></ToolButton>
            <span className="w-12 text-center font-mono text-xs tabular-nums" aria-live="polite">{Math.round(scale * 100)}%</span>
            <ToolButton label="Zoom in" onClick={() => step(1)} disabled={scale >= ZOOMS.at(-1)}><ZoomIn /></ToolButton>
            <ToolButton label="Fit to width" onClick={() => setZoom("fit")} pressed={zoom === "fit"}><Maximize2 /></ToolButton>
          </div>
        )}

        <div className="flex items-center gap-2">
          {blob && (
            <Button variant="secondary" size="sm" onClick={download}>
              <Download aria-hidden="true" /> Download
            </Button>
          )}
          <ToolButton ref={closeRef} label="Close viewer (Esc)" onClick={onClose}><X /></ToolButton>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        {error ? (
          <Centered><AlertTriangle className="size-6 text-nu-soft-coral" aria-hidden="true" /> {error}</Centered>
        ) : !total ? (
          <Centered><Loader2 className="size-5 animate-spin" aria-hidden="true" /> Opening report…</Centered>
        ) : (
          <div className="mx-auto flex w-max min-w-full flex-col items-center gap-6 px-6 py-6">
            {pages.map((entry, i) => (
              <PdfPage key={i} entry={entry} number={i + 1} scale={scale} onVisible={setCurrent} rootRef={scrollRef} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolButton({ label, children, pressed, ref, ...props }) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="flex size-8 items-center justify-center rounded-lg text-gray-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-light-purple disabled:pointer-events-none disabled:opacity-30 aria-pressed:bg-white/15 [&_svg]:size-4"
      {...props}
    >
      {children}
    </button>
  );
}

function PageInput({ current, total, onGo }) {
  const [draft, setDraft] = useState(null);
  const commit = () => {
    const n = Number(draft);
    if (Number.isInteger(n) && n >= 1 && n <= total) onGo(n);
    setDraft(null);
  };
  return (
    <label className="flex items-center gap-1.5 text-xs text-gray-300">
      <span className="sr-only">Page number</span>
      <input
        value={draft ?? current}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        inputMode="numeric"
        className="w-10 rounded-md border border-white/20 bg-white/10 px-1 py-1 text-center font-mono text-xs text-white focus:outline-none focus:ring-2 focus:ring-nu-light-purple"
      />
      <span aria-hidden="true">/ {total}</span>
    </label>
  );
}

function Centered({ children }) {
  return <div className="flex h-full items-center justify-center gap-2 p-8 text-sm text-gray-200">{children}</div>;
}
