"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One PDF page. Holds its final size from the start (no layout jump) and only rasterises once it is
 * near the viewport. Renders at devicePixelRatio so text stays sharp on retina screens.
 */
export function PdfPage({ entry, number, scale, onVisible, rootRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [near, setNear] = useState(false);
  const width = Math.floor(entry.width * scale);
  const height = Math.floor(entry.height * scale);

  useEffect(() => {
    const el = wrapRef.current;
    // Observe against the viewer's scroll pane: the window would clip at the pane edge and defeat the pre-render margin.
    const root = rootRef.current;
    const nearObs = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { root, rootMargin: "1200px 0px" });
    // A page counts as "current" once it crosses the middle of the scroll pane.
    const currentObs = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(number), { root, rootMargin: "-50% 0px -50% 0px" });
    nearObs.observe(el);
    currentObs.observe(el);
    return () => {
      nearObs.disconnect();
      currentObs.disconnect();
    };
  }, [number, onVisible, rootRef]);

  useEffect(() => {
    if (!near) return undefined;
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const viewport = entry.page.getViewport({ scale: scale * ratio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const task = entry.page.render({ canvasContext: canvas.getContext("2d"), viewport });
    task.promise.catch(() => {}); // cancelled by a newer zoom level
    return () => task.cancel();
  }, [near, scale, entry]);

  return (
    <div
      ref={wrapRef}
      id={`pdf-page-${number}`}
      data-page={number}
      className="relative shrink-0 bg-white shadow-xl"
      style={{ width, height }}
      aria-label={`Page ${number}`}
      role="img"
    >
      <canvas ref={canvasRef} className="block size-full" />
    </div>
  );
}
