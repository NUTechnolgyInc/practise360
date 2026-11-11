"use client";

import { useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { Button, Card, CardHeader, Field, Select, useToast } from "@/components/ui";
import { apiUpload } from "@/lib/api";
import { formatBytes, formatDate, monthLabel, recentMonths } from "@/lib/format";
import { cn } from "@/lib/cn";

const MAX_BYTES = 4 * 1024 * 1024; // matches the API limit (Vercel caps bodies at 4.5 MB)

/** Step 2: pick the month and upload the PDF. One report per month; uploading again replaces it. */
export function UploadCard({ period, onPeriodChange, existing, onUploaded }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const replacing = existing.find((r) => r.period === period);

  const pick = (f) => {
    setError("");
    setFile(null);
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return setError("Choose a PDF file.");
    if (f.size > MAX_BYTES) return setError(`That file is ${formatBytes(f.size)} — the limit is 4 MB.`);
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError("Choose the PDF your skill generated.");
    setBusy(true);
    try {
      const pdf = file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf" });
      await apiUpload(`/ai/usage-reports/mine/${period}?fileName=${encodeURIComponent(file.name)}`, pdf);
      toast(`Report for ${monthLabel(period)} uploaded`);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="2. Upload the PDF" description="Your Practice Manager and the AI Tracker admins can view it. Only PDFs, up to 4 MB." />
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-start">
        <Field id="usage-period" label="Month" hint={replacing ? `Replaces the report uploaded ${formatDate(replacing.uploadedAt)}` : "One report per month"}>
          {(p) => (
            <Select {...p} value={period} onChange={(e) => onPeriodChange(e.target.value)} required>
              {recentMonths(12).map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="usage-file" label="Report PDF" error={error} className="min-w-0">
          {(p) => (
            <label
              htmlFor={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-2 text-sm transition focus-within:ring-2 focus-within:ring-nu-purple hover:border-nu-purple",
                error ? "border-rose-300" : "border-gray-300",
              )}
            >
              <FileUp className="size-5 shrink-0 text-nu-purple" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {file ? <><span className="font-semibold text-nu-navy">{file.name}</span> <span className="text-gray-400">· {formatBytes(file.size)}</span></> : <span className="text-gray-400">Choose a PDF…</span>}
              </span>
              <input {...p} ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}
        </Field>
        <Button type="submit" disabled={busy} className="md:mt-5">
          <Upload aria-hidden="true" /> {busy ? "Uploading…" : replacing ? "Replace report" : "Upload report"}
        </Button>
      </form>
    </Card>
  );
}
