"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Field, Modal, Textarea } from "@/components/ui";
import { DetailsFields, validateDetails } from "./details-fields";
import { MarkdownEditor } from "./markdown-editor";
import { toDateInput } from "@/lib/contributions";

const fromContribution = (c) => ({ title: c.title, type: c.type, customType: c.customType ?? "", startDate: toDateInput(c.startDate), dueDate: toDateInput(c.dueDate) });

/** Edit title/type/dates, or the description (`part` = "details" | "description"). */
export function EditModal({ open, part, onClose, contribution, onSave }) {
  const [form, setForm] = useState(() => fromContribution(contribution));
  const [description, setDescription] = useState(contribution.description);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(fromContribution(contribution));
      setDescription(contribution.description);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    let body = { description };
    if (part === "details") {
      const found = validateDetails(form);
      setErrors(found);
      if (Object.keys(found).length) return;
      body = form;
    }
    setBusy(true);
    const ok = await onSave(body);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      className={part === "description" ? "max-w-3xl" : undefined}
      title={part === "description" ? "Edit description" : "Edit details"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save</Button>
        </>
      }
    >
      {part === "description" ? (
        <MarkdownEditor id="edit-description" value={description} onChange={setDescription} rows={16} maxLength={200000} />
      ) : (
        <DetailsFields value={form} onChange={setForm} errors={errors} />
      )}
    </Modal>
  );
}

/** Ask the owner to join, with an optional note. */
export function JoinModal({ open, onClose, onSend }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setMessage("");
  }, [open]);

  const send = async () => {
    setBusy(true);
    const ok = await onSend(message);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ask to join"
      description="The owner, your Practice Lead or Manager can accept you as a contributor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={send} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Send request</Button>
        </>
      }
    >
      <Field id="join-message" label="Message (optional)" hint="What you'd like to help with">
        {(p) => <Textarea {...p} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} />}
      </Field>
    </Modal>
  );
}
