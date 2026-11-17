"use client";

import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise;

/** Loads Google Identity Services once per page, however many times the button mounts. */
function loadGsi() {
  gsiPromise ||= new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => {
      gsiPromise = null; // let a later mount retry
      reject(new Error("Couldn't load Google sign-in. Check your connection."));
    };
    document.head.appendChild(s);
  });
  return gsiPromise;
}

/**
 * Google's own "Continue with Google" button (its branding rules require their rendering).
 * Calls onCredential with the ID token; the API verifies it — nothing here is trusted.
 */
export function GoogleButton({ clientId, onCredential, onError }) {
  const ref = useRef(null);
  // Refs, not effect deps: inline callbacks from the parent would otherwise re-render Google's button every render.
  const handler = useRef(onCredential);
  handler.current = onCredential;
  const errorHandler = useRef(onError);
  errorHandler.current = onError;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGsi()
      .then((google) => {
        if (cancelled || !ref.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => handler.current(res.credential),
          ux_mode: "popup",
          use_fedcm_for_button: true,
        });
        // Google caps the button at 400px; match the card's width so it lines up with the form above.
        const width = Math.min(400, Math.round(ref.current.getBoundingClientRect().width)) || 320;
        google.accounts.id.renderButton(ref.current, { theme: "outline", size: "large", text: "continue_with", shape: "pill", width });
        setReady(true);
      })
      .catch((err) => !cancelled && errorHandler.current?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return <div ref={ref} className="flex min-h-11 w-full justify-center" aria-busy={!ready} />;
}
