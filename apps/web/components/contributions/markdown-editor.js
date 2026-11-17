"use client";

import { useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button, Label, Markdown, Tabs, Textarea, useToast } from "@/components/ui";
import { documentToMarkdown } from "@/lib/contributions";

const VIEWS = [
  { value: "write", label: "Write" },
  { value: "preview", label: "Preview" },
];

/**
 * Markdown textarea with a preview tab. "Import document" converts a .docx/.md/.txt into Markdown
 * (in the browser) and replaces the text — so a Word write-up keeps its headings, lists and tables.
 */
/** `maxLength` matches the API limit: a counter appears near it, so a long import doesn't fail as a surprise on save. */
export function MarkdownEditor({ id, label, value, onChange, rows = 12, placeholder, hint, allowImport = true, maxLength }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [view, setView] = useState("write");
  const [importing, setImporting] = useState(false);
  const nearLimit = !!maxLength && value.length > maxLength * 0.9;
  const tooLong = !!maxLength && value.length > maxLength;

  const importFile = async (file) => {
    if (!file) return;
    if (value.trim() && !window.confirm("Replace the current text with the imported document?")) return;
    setImporting(true);
    try {
      onChange(await documentToMarkdown(file));
      setView("preview");
      toast(`Imported ${file.name}`);
    } catch (err) {
      toast(err.message || "Couldn't read that document", "error");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        {label && <Label htmlFor={id} className="mb-0">{label}</Label>}
        <div className="flex flex-wrap items-center gap-2">
          {allowImport && (
            <>
              <input ref={inputRef} type="file" accept=".docx,.md,.markdown,.txt" className="sr-only" id={`${id}-import`} onChange={(e) => importFile(e.target.files?.[0])} />
              <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="animate-spin" /> : <FileText />} Import .docx / .md
              </Button>
            </>
          )}
          <Tabs aria-label="Editor view" tabs={VIEWS} value={view} onChange={setView} />
        </div>
      </div>
      {view === "write" ? (
        <Textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-invalid={tooLong} className="font-mono text-xs leading-relaxed" />
      ) : (
        <div className="min-h-32 rounded-xl border border-gray-200 bg-white p-4">
          {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-xs text-gray-400">Nothing to preview yet.</p>}
        </div>
      )}
      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[11px]">
        <p className="text-gray-400">{hint ?? "Markdown supported: # headings, **bold**, - lists, | tables |, [links](https://…)."}</p>
        {nearLimit && (
          <p className={tooLong ? "font-semibold text-rose-600" : "text-gray-400"} aria-live="polite">
            {value.length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")} characters{tooLong ? " — shorten it to save" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
