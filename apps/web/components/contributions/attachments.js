"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { apiBlob, apiUpload } from "@/lib/api";
import { MAX_FILE_BYTES } from "@/lib/contributions";
import { formatBytes } from "@/lib/format";

// Shared by Contributions and the Certification Tracker: `filesPath` is the API collection the files live in
// (defaults to the contribution's). Kept here rather than in components/ui because it talks to the API.
const pathFor = (contributionId, filesPath) => filesPath ?? `/contributions/${contributionId}/files`;

/** Fetches a file with the auth header, then opens PDFs/images in a new tab and downloads everything else. */
export async function openFile(filesPath, file) {
  const blob = await apiBlob(`${filesPath}/${file.id}`);
  const url = URL.createObjectURL(blob);
  if (/^(application\/pdf|image\/)/.test(blob.type)) {
    window.open(url, "_blank", "noopener");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.fileName;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** A row of file chips; click opens/downloads. `onRemove` adds an ✕ per chip. */
export function FileChips({ contributionId, filesPath, files, onRemove }) {
  const toast = useToast();
  if (!files.length) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id} className="flex max-w-full items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 pl-2 text-xs">
          <button
            type="button"
            onClick={() => openFile(pathFor(contributionId, filesPath), f).catch((err) => toast(err.message, "error"))}
            className="flex min-w-0 items-center gap-1.5 py-1 font-semibold text-nu-navy hover:text-nu-purple"
            title={`Open ${f.fileName}`}
          >
            <FileText className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{f.fileName}</span>
            <span className="shrink-0 font-normal text-gray-400">{formatBytes(f.size)}</span>
            <Download className="size-3 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
          {onRemove ? (
            <button type="button" onClick={() => onRemove(f)} aria-label={`Remove ${f.fileName}`} className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-rose-600">
              <X className="size-3.5" />
            </button>
          ) : (
            <span className="pr-1" />
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Attach files" button: uploads straight away (≤ 4 MB each) and reports the stored files via onUploaded.
 * `query` adds parameters to the upload (e.g. `kind=receipt`); `accept` limits the file picker.
 */
export function AttachButton({ contributionId, filesPath, query = "", accept, multiple = true, onUploaded, label = "Attach files", size = "sm", variant = "secondary" }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const upload = async (list) => {
    const files = [...(list || [])];
    const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(", ")}: over the 4 MB limit`, "error");
    const ok = files.filter((f) => f.size <= MAX_FILE_BYTES);
    if (!ok.length) return;
    setBusy(true);
    try {
      const stored = [];
      for (const f of ok) stored.push(await apiUpload(`${pathFor(contributionId, filesPath)}?fileName=${encodeURIComponent(f.name)}${query ? `&${query}` : ""}`, f, { method: "POST" }));
      onUploaded(stored);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" multiple={multiple} accept={accept} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => upload(e.target.files)} />
      <Button variant={variant} size={size} onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Paperclip />} {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}
