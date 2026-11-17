"use client";

import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { AttachButton, FileChips } from "@/components/contributions/attachments";
import { CERT_FILE_ACCEPT, CURRENCIES, filesPath, todayInput } from "@/lib/certifications";
import { toDateInput } from "@/lib/contributions";

const idsOf = (files, kind) => files.filter((f) => f.kind === kind).map((f) => f.id);

/** Prefilled from the last submission, so a rejected or clarified completion only needs the fix. */
const blank = (p) => {
  const c = p.completion;
  const r = c?.reimbursement;
  return {
    completedOn: toDateInput(c?.completedOn) || todayInput(),
    verificationUrl: c?.verificationUrl ?? "",
    credentialId: c?.credentialId ?? "",
    expiresOn: toDateInput(c?.expiresOn),
    certificateFileIds: c?.certificateFileIds?.length ? c.certificateFileIds : idsOf(p.files, "certificate"),
    claim: !!r,
    amount: r ? String(r.amount) : "",
    currency: r?.currency ?? "INR",
    receiptFileIds: r?.receiptFileIds?.length ? r.receiptFileIds : idsOf(p.files, "receipt"),
    note: "",
  };
};
const isUrl = (u) => /^https?:\/\/\S+$/i.test(u.trim());

/** Submit the certificate for Lead → Manager approval. After a clarification request it doubles as "reply and resubmit". */
export function CompletionModal({ open, onClose, plan: p, onSubmit, onFilesAdded }) {
  const resubmit = p.status === "clarification";
  const [form, setForm] = useState(() => blank(p));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(blank(p));
      setErrors({});
    }
    // Reset only when the modal opens, not on every refresh of the plan behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const files = (key) => p.files.filter((f) => form[key].includes(f.id));
  const added = (key) => (stored) => {
    onFilesAdded(stored);
    setForm((f) => ({ ...f, [key]: [...f[key], ...stored.map((s) => s.id)] }));
  };
  const removed = (key) => (file) => setForm((f) => ({ ...f, [key]: f[key].filter((id) => id !== file.id) }));

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.completedOn) found.completedOn = "When did you complete it?";
    else if (form.completedOn > todayInput()) found.completedOn = "Can't be in the future";
    if (!form.verificationUrl.trim()) found.verificationUrl = "Paste the link a reviewer can use to verify the certificate";
    else if (!isUrl(form.verificationUrl)) found.verificationUrl = "Use a full http(s):// link";
    if (form.expiresOn && form.expiresOn <= form.completedOn) found.expiresOn = "Must be after the completion date";
    if (!form.certificateFileIds.length) found.certificate = "Upload the certificate (PDF or image)";
    if (form.claim) {
      if (!(Number(form.amount) > 0)) found.amount = "Enter the amount you paid";
      if (!form.receiptFileIds.length) found.receipt = "Upload the payment receipt";
    }
    if (resubmit && !form.note.trim()) found.note = "Answer the reviewer's question";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    const { claim, amount, currency, receiptFileIds, ...rest } = form;
    const ok = await onSubmit({ ...rest, expiresOn: form.expiresOn || undefined, reimbursement: claim ? { amount: Number(amount), currency, receiptFileIds } : null });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl"
      title={resubmit ? "Reply and resubmit" : "Submit completion"}
      description="Your Practice Lead reviews it first, then your Practice Manager. Approval marks it completed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="completion-form" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} {resubmit ? "Resubmit" : "Submit for approval"}
          </Button>
        </>
      }
    >
      <form id="completion-form" onSubmit={submit} className="space-y-4" noValidate>
        {resubmit && (
          <Field id="completion-note" label="Your reply *" error={errors.note}>
            {(f) => <Textarea {...f} rows={3} maxLength={10000} value={form.note} onChange={set("note")} />}
          </Field>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="completion-date" label="Completed on *" error={errors.completedOn}>
            {(f) => <Input {...f} type="date" required max={todayInput()} value={form.completedOn} onChange={set("completedOn")} />}
          </Field>
          <Field id="completion-expires" label="Expires on" hint="If the certificate has an expiry date" error={errors.expiresOn}>
            {(f) => <Input {...f} type="date" min={form.completedOn || undefined} value={form.expiresOn} onChange={set("expiresOn")} />}
          </Field>
        </div>
        <Field id="completion-url" label="Verification link *" hint="Credly, the provider's verification page, etc." error={errors.verificationUrl}>
          {(f) => <Input {...f} type="url" required maxLength={500} value={form.verificationUrl} onChange={set("verificationUrl")} placeholder="https://" />}
        </Field>
        <Field id="completion-credential" label="Credential ID">
          {(f) => <Input {...f} maxLength={120} value={form.credentialId} onChange={set("credentialId")} className="font-mono" />}
        </Field>
        <FileField label="Certificate *" error={errors.certificate} plan={p} files={files("certificateFileIds")} onRemove={removed("certificateFileIds")} onUploaded={added("certificateFileIds")} kind="certificate" />
        <label className="flex items-center gap-2 text-sm font-semibold text-nu-navy">
          <input type="checkbox" checked={form.claim} onChange={set("claim")} className="size-4 accent-nu-purple" /> Claim reimbursement
        </label>
        {form.claim && (
          <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <Field id="completion-currency" label="Currency *">
                {(f) => <Select {...f} value={form.currency} onChange={set("currency")}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>}
              </Field>
              <Field id="completion-amount" label="Amount *" error={errors.amount}>
                {(f) => <Input {...f} type="number" inputMode="decimal" min="0" step="0.01" required value={form.amount} onChange={set("amount")} />}
              </Field>
            </div>
            <FileField label="Payment receipt *" error={errors.receipt} plan={p} files={files("receiptFileIds")} onRemove={removed("receiptFileIds")} onUploaded={added("receiptFileIds")} kind="receipt" />
          </div>
        )}
      </form>
    </Modal>
  );
}

function FileField({ label, error, plan, files, onRemove, onUploaded, kind }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-nu-navy">{label}</span>
        <AttachButton filesPath={filesPath(plan.id)} query={`kind=${kind}`} accept={CERT_FILE_ACCEPT} label="Upload" onUploaded={onUploaded} />
      </div>
      {files.length ? <FileChips filesPath={filesPath(plan.id)} files={files} onRemove={onRemove} /> : <p className="text-[11px] text-gray-400">PDF or image, up to 4 MB.</p>}
      {error && <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>}
    </div>
  );
}
