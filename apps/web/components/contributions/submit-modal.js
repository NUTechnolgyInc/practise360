"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Send, X } from "lucide-react";
import { Button, Field, Input, Modal, Textarea } from "@/components/ui";
import { AttachButton, FileChips } from "./attachments";

const blank = (c) => ({
  summary: c.submission?.summary ?? "",
  impact: c.submission?.impact ?? "",
  repoUrl: c.submission?.repoUrl ?? "",
  demoUrl: c.submission?.demoUrl ?? "",
  links: c.submission?.links?.length ? c.submission.links : [],
  fileIds: c.submission?.fileIds?.length ? c.submission.fileIds : c.files.map((f) => f.id),
  note: "",
});
const isUrl = (u) => !u || /^https?:\/\/\S+$/i.test(u.trim());

/**
 * Hand the contribution in for review. Required: description (on the page), summary, impact, ≥ 1 document.
 * Repo/demo/other links are optional. After a clarification request it doubles as "reply and resubmit".
 */
export function SubmitModal({ open, onClose, contribution, onSubmit, onFilesAdded }) {
  const c = contribution;
  const resubmit = c.status === "clarification";
  const [form, setForm] = useState(() => blank(c));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(c));
      setErrors({});
    }
    // Reset only when the modal opens, not on every refresh of the contribution behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const files = c.files.filter((f) => form.fileIds.includes(f.id));
  const unused = c.files.filter((f) => !form.fileIds.includes(f.id));

  const submit = async () => {
    const e = {};
    if (!c.description.trim()) e.description = "Add a description to the contribution first (Edit details).";
    if (!form.summary.trim()) e.summary = "Summarise what was built or achieved";
    if (!form.impact.trim()) e.impact = "Describe the impact";
    if (!form.fileIds.length) e.files = "Attach at least one document";
    if (!isUrl(form.repoUrl)) e.repoUrl = "Use a full http(s):// link";
    if (!isUrl(form.demoUrl)) e.demoUrl = "Use a full http(s):// link";
    if (form.links.some((l) => !isUrl(l.url))) e.links = "Every link needs a full http(s):// URL";
    if (resubmit && !form.note.trim()) e.note = "Answer the reviewer's question";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const ok = await onSubmit(form);
    setBusy(false);
    if (ok) onClose();
  };

  const setLink = (i, key, val) => setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [key]: val } : l)) }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={resubmit ? "Reply and resubmit" : "Submit for review"}
      description={resubmit ? "It goes back to the reviewer who asked for clarification." : "Your Practice Lead reviews it first, then your Practice Manager approves and publishes it."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} {resubmit ? "Resubmit" : "Submit"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.description && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700" role="alert">{errors.description}</p>}
        {resubmit && (
          <Field id="s-note" label="Your reply to the reviewer *" error={errors.note}>
            {(p) => <Textarea {...p} rows={3} value={form.note} onChange={set("note")} />}
          </Field>
        )}
        <Field id="s-summary" label="Summary *" error={errors.summary} hint="What was built or achieved, in a few sentences (Markdown ok)">
          {(p) => <Textarea {...p} rows={3} value={form.summary} onChange={set("summary")} />}
        </Field>
        <Field id="s-impact" label="Impact *" error={errors.impact} hint="Who benefits and how — time saved, revenue, reuse across projects…">
          {(p) => <Textarea {...p} rows={3} value={form.impact} onChange={set("impact")} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="s-repo" label="Repository link" error={errors.repoUrl}>
            {(p) => <Input {...p} type="url" placeholder="https://" value={form.repoUrl} onChange={set("repoUrl")} />}
          </Field>
          <Field id="s-demo" label="Demo link" error={errors.demoUrl}>
            {(p) => <Input {...p} type="url" placeholder="https://" value={form.demoUrl} onChange={set("demoUrl")} />}
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-nu-navy">Other links</legend>
          {form.links.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
              <Input aria-label={`Link ${i + 1} label`} placeholder="Label (e.g. Blog post)" value={l.label} onChange={(e) => setLink(i, "label", e.target.value)} />
              <Input aria-label={`Link ${i + 1} URL`} type="url" placeholder="https://" value={l.url} onChange={(e) => setLink(i, "url", e.target.value)} />
              <Button variant="ghost" size="icon" aria-label={`Remove link ${i + 1}`} onClick={() => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }))}>
                <X />
              </Button>
            </div>
          ))}
          {errors.links && <p className="text-xs text-rose-600">{errors.links}</p>}
          <Button variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, links: [...f.links, { label: "", url: "" }] }))}>
            <Plus /> Add link
          </Button>
        </fieldset>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-nu-navy">Documents *</p>
          <p className="mb-2 text-[11px] text-gray-400">Design docs, slides, write-ups, screenshots — up to 4 MB each.</p>
          <FileChips contributionId={c.id} files={files} onRemove={(f) => setForm((s) => ({ ...s, fileIds: s.fileIds.filter((id) => id !== f.id) }))} />
          {unused.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {unused.map((f) => (
                <Button key={f.id} variant="ghost" size="sm" onClick={() => setForm((s) => ({ ...s, fileIds: [...s.fileIds, f.id] }))}>
                  <Plus /> {f.fileName}
                </Button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <AttachButton
              contributionId={c.id}
              label="Upload documents"
              onUploaded={(stored) => {
                setForm((s) => ({ ...s, fileIds: [...s.fileIds, ...stored.map((f) => f.id)] }));
                onFilesAdded(stored);
              }}
            />
          </div>
          {errors.files && <p className="mt-1 text-xs text-rose-600">{errors.files}</p>}
        </div>
      </div>
    </Modal>
  );
}
