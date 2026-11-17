"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button, Modal, useToast } from "@/components/ui";
import { MarkdownEditor } from "@/components/contributions/markdown-editor";
import { api } from "@/lib/api";

const MAX_LENGTH = 50000; // matches the API
const PLACEHOLDER = {
  practice: "## What we do\n\n## Ways of working\n\n## Key links\n- [Onboarding guide](https://…)\n\n## Who to ask",
  group: "## What we work on\n\n## Ways of working\n\n## Key links\n- [Onboarding guide](https://…)\n\n## Who to ask",
};

/**
 * Write a practice's Overview (Manager, Practices Admin) or a group's (`subject="group"`: its Lead too) in Markdown,
 * saved to `path`. Saving returns the whole overview. `name` = the practice's or group's name.
 */
export function EditOverviewModal({ open, path, name, subject = "practice", body, onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText(body);
      setError("");
    }
  }, [open, body]);

  const save = async () => {
    setBusy(true);
    try {
      const updated = await api(path, { method: "PUT", body: { body: text } });
      toast("Overview saved");
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit the ${name} overview`}
      description="Everyone in the practice sees this on the Overview tab."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || text.length > MAX_LENGTH}>
            {busy && <Loader2 className="animate-spin" />} Save overview
          </Button>
        </>
      }
    >
      <MarkdownEditor id={`${subject}-overview`} label="Overview" value={text} onChange={setText} rows={16} maxLength={MAX_LENGTH} placeholder={PLACEHOLDER[subject]} />
      {error && <p className="mt-2 text-xs text-rose-600" role="alert">{error}</p>}
    </Modal>
  );
}
