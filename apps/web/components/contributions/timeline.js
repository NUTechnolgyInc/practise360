"use client";

import { useState } from "react";
import { CheckCircle2, CircleHelp, Flag, Loader2, Megaphone, PenLine, Rocket, Send, UserPlus, XCircle } from "lucide-react";
import { Button, Card, CardHeader, Markdown } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { AttachButton, FileChips } from "./attachments";
import { MarkdownEditor } from "./markdown-editor";
import { cn } from "@/lib/cn";

const Subject = ({ e }) => <PersonLink person={e.subject} className="font-semibold text-nu-navy" />;
const MEMBER_TEXT = {
  invited: (e) => <>invited <Subject e={e} /></>,
  requested: () => "asked to join",
  joined: (e) => (e.subject?.id === e.author.id ? "joined as a contributor" : <>added <Subject e={e} /> as a contributor</>),
  declined_invite: () => "declined the invite",
  rejected_request: (e) => <>turned down <Subject e={e} />{"'s"} request to join</>,
  removed: (e) => <>removed <Subject e={e} /></>,
  left: () => "left the contribution",
};
const STAGE = { lead: "Lead review", manager: "Manager review" };
const DECISION = { approve: "approved", decline: "declined", clarify: "asked for clarification" };

/** Icon, tone and one-line headline per event kind. */
function describe(e) {
  switch (e.kind) {
    case "created":
      // A subject means it was added on that member's behalf.
      return { icon: Flag, tone: "bg-nu-lapis text-white", text: e.subject ? <>added this contribution for <Subject e={e} /></> : "started this contribution" };
    case "progress":
      return { icon: PenLine, tone: "bg-purple-100 text-nu-purple", text: "posted an update" };
    case "member":
      return { icon: UserPlus, tone: "bg-teal-50 text-nu-dark-teal", text: MEMBER_TEXT[e.action]?.(e) ?? e.action };
    case "submitted":
      return { icon: Send, tone: "bg-indigo-50 text-nu-lapis", text: `submitted for ${STAGE[e.stage]?.toLowerCase() ?? "review"}` };
    case "review": {
      const icon = e.decision === "approve" ? CheckCircle2 : e.decision === "decline" ? XCircle : CircleHelp;
      const tone = e.decision === "approve" ? "bg-emerald-50 text-emerald-700" : e.decision === "decline" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
      return { icon, tone, text: `${DECISION[e.decision]} (${STAGE[e.stage]})` };
    }
    case "published":
      return { icon: Rocket, tone: "bg-emerald-600 text-white", text: "published it" };
    default:
      return { icon: Megaphone, tone: "bg-gray-100 text-gray-600", text: e.kind };
  }
}

const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Composer({ contributionId, onPost }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const post = async () => {
    setBusy(true);
    const ok = await onPost({ body, fileIds: files.map((f) => f.id) });
    setBusy(false);
    if (ok) {
      setBody("");
      setFiles([]);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
      <MarkdownEditor id="progress-body" label="Log progress" value={body} onChange={setBody} rows={5} placeholder="e.g. Added the backend provider for nu shared auth" maxLength={50000} />
      <FileChips contributionId={contributionId} files={files} onRemove={(f) => setFiles((list) => list.filter((x) => x.id !== f.id))} />
      <div className="flex flex-wrap justify-end gap-2">
        <AttachButton contributionId={contributionId} onUploaded={(stored) => setFiles((list) => [...list, ...stored])} />
        <Button variant="dark" size="sm" onClick={post} disabled={busy || !body.trim()}>
          {busy && <Loader2 className="animate-spin" />} Post update
        </Button>
      </div>
    </div>
  );
}

/** Newest-first activity log: progress updates, people changes, submissions and review decisions. */
export function Timeline({ contribution, onPost }) {
  const { id, events, files, actions } = contribution;
  const fileById = new Map(files.map((f) => [f.id, f]));

  return (
    <Card>
      <CardHeader title="Progress & activity" description="Every update, membership change and review decision, newest first." />
      {actions.logProgress && <div className="mb-6"><Composer contributionId={id} onPost={onPost} /></div>}
      <ol className="relative space-y-5 border-l-2 border-gray-100 pl-6">
        {events.map((e) => {
          const { icon: Icon, tone, text } = describe(e);
          const attached = e.fileIds.map((fid) => fileById.get(fid)).filter(Boolean);
          return (
            <li key={e.id} className="relative">
              <span className={cn("absolute -left-[37px] flex size-7 items-center justify-center rounded-full ring-4 ring-white", tone)}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <PersonLink person={e.author} avatar className="font-bold text-nu-navy" />
                <span className="text-nu-muted-teal">{text}</span>
                <time dateTime={e.at} className="text-gray-400">· {when(e.at)}</time>
              </div>
              {e.body && e.kind !== "created" && (
                <div className={cn("mt-2 rounded-xl border p-3", e.kind === "review" && e.decision !== "approve" ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-white")}>
                  <Markdown>{e.body}</Markdown>
                </div>
              )}
              {attached.length > 0 && <div className="mt-2"><FileChips contributionId={id} files={attached} /></div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
