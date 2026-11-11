"use client";

import { useEffect, useState } from "react";

let pdfjsPromise = null;

/** pdf.js is ~1 MB, so it's loaded only when a viewer opens, and only in the browser. */
function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return pdfjs;
  });
  return pdfjsPromise;
}

/**
 * Opens a PDF from a Blob and reads every page's size up front, so the viewer can lay out
 * placeholders of the right height and render pages lazily as they scroll into view.
 */
export function usePdfDocument(blob) {
  const [state, setState] = useState({ doc: null, pages: [], error: "" });

  useEffect(() => {
    if (!blob) return undefined;
    let cancelled = false;
    let doc = null;
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        // Fonts come from public/pdfjs (copied at dev/build); reports use non-embedded Helvetica.
        doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), standardFontDataUrl: "/pdfjs/standard_fonts/" }).promise;
        const pages = await Promise.all(
          Array.from({ length: doc.numPages }, async (_, i) => {
            const page = await doc.getPage(i + 1);
            const { width, height } = page.getViewport({ scale: 1 });
            return { page, width, height };
          }),
        );
        if (!cancelled) setState({ doc, pages, error: "" });
      } catch (err) {
        if (!cancelled) setState({ doc: null, pages: [], error: err?.message || "Couldn't open this PDF" });
      }
    })();
    return () => {
      cancelled = true;
      doc?.destroy();
    };
  }, [blob]);

  return state;
}
