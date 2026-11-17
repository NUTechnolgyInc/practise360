"use client";

import { useState } from "react";
import { FileText, Paperclip, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, useToast } from "@/components/ui";
import { AttachButton, openFile } from "@/components/contributions/attachments";
import { ConfirmModal } from "@/components/certs/confirm-modal";
import { PersonLink } from "@/components/people/person-link";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";

/**
 * Files on a practice's or group's Overview (`subject`), newest first, served from `filesPath`. Everyone in the
 * practice opens them; `canEdit` (from the API) adds upload and remove. `setFiles` takes an updater so parallel
 * uploads don't overwrite each other.
 */
export function OverviewFiles({ filesPath, subject = "practice", files, canEdit, setFiles }) {
  const toast = useToast();
  const [removing, setRemoving] = useState(null);

  const uploaded = (stored) => {
    setFiles((list) => [...[...stored].reverse(), ...list]);
    toast(stored.length === 1 ? `Uploaded ${stored[0].fileName}` : `Uploaded ${stored.length} files`);
  };

  const remove = async () => {
    try {
      await api(`${filesPath}/${removing.id}`, { method: "DELETE" });
      setFiles((list) => list.filter((f) => f.id !== removing.id));
      toast(`Removed ${removing.fileName}`);
      return true;
    } catch (err) {
      toast(err.message, "error");
      return false;
    }
  };

  return (
    <Card>
      {/* Stacked: this card sits in the narrow column beside "About this practice/group". */}
      <CardHeader
        className="sm:flex-col sm:items-start"
        title="Files"
        description={`Guides, templates and decks for this ${subject}.`}
        actions={canEdit && <AttachButton filesPath={filesPath} label="Upload files" onUploaded={uploaded} />}
      />
      {files.length === 0 ? (
        <EmptyState
          icon={Paperclip}
          title="No files yet"
          description={canEdit ? "Upload onboarding guides, templates or decks — up to 4 MB each." : subject === "group" ? "Files the group's Lead shares show up here." : "Files your Manager shares show up here."}
          className="border-none p-6"
        />
      ) : (
        <ul className="divide-y divide-gray-100" aria-label={subject === "group" ? "Group files" : "Practice files"}>
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2.5">
              {/* Only the name opens the file: the uploader below is a profile link, and links can't sit inside a button. */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-nu-purple">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <button
                    type="button"
                    onClick={() => openFile(filesPath, f).catch((err) => toast(err.message, "error"))}
                    className="block max-w-full truncate rounded-sm text-left text-xs font-bold text-nu-navy hover:text-nu-purple hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple"
                    title={`Open ${f.fileName}`}
                  >
                    {f.fileName}
                  </button>
                  <span className="block truncate text-[11px] text-gray-400">
                    {formatBytes(f.size)} · <PersonLink person={f.uploadedBy} /> · {formatDate(f.uploadedAt)}
                  </span>
                </span>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" aria-label={`Remove ${f.fileName}`} onClick={() => setRemoving(f)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.fileName}?`}
        body="People in the practice won't be able to open it any more. This can't be undone."
        confirmLabel="Remove file"
        onConfirm={remove}
      />
    </Card>
  );
}
