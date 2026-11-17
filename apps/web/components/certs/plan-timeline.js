import { Award, CheckCircle2, CircleHelp, Flag, Megaphone, PenLine, Send, Sparkles, Undo2, XCircle } from "lucide-react";
import { Card, CardHeader, Markdown } from "@/components/ui";
import { PersonLink } from "@/components/people/person-link";
import { FileChips } from "@/components/contributions/attachments";
import { filesPath } from "@/lib/certifications";
import { cn } from "@/lib/cn";

const STAGE = { lead: "Lead review", manager: "Manager review" };
const DECISION = { approve: "approved", reject: "rejected", clarify: "asked for clarification" };

/** Icon, tone and one-line headline per event kind. */
function describe(e) {
  switch (e.kind) {
    case "created":
      return { icon: Flag, tone: "bg-nu-lapis text-white", text: "added this plan" };
    case "suggested":
      return { icon: Sparkles, tone: "bg-teal-50 text-nu-dark-teal", text: "recommended this" };
    case "assigned":
      return { icon: Flag, tone: "bg-indigo-50 text-nu-lapis", text: "assigned this" };
    case "accepted":
      return { icon: CheckCircle2, tone: "bg-teal-50 text-nu-dark-teal", text: "accepted the recommendation" };
    case "declined":
      return { icon: XCircle, tone: "bg-gray-100 text-gray-600", text: "declined the recommendation" };
    case "updated":
      return { icon: PenLine, tone: "bg-purple-100 text-nu-purple", text: "updated the plan" };
    case "submitted":
      return { icon: Send, tone: "bg-indigo-50 text-nu-lapis", text: `submitted the completion for ${STAGE[e.stage]?.toLowerCase() ?? "review"}` };
    case "review": {
      const icon = e.decision === "approve" ? CheckCircle2 : e.decision === "reject" ? XCircle : CircleHelp;
      const tone = e.decision === "approve" ? "bg-emerald-50 text-emerald-700" : e.decision === "reject" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700";
      return { icon, tone, text: `${DECISION[e.decision]} (${STAGE[e.stage]})` };
    }
    case "completed":
      return { icon: Award, tone: "bg-emerald-600 text-white", text: "marked it completed" };
    case "dropped":
      return { icon: Undo2, tone: "bg-gray-100 text-gray-600", text: "dropped the plan" };
    case "withdrawn":
      return { icon: Undo2, tone: "bg-gray-100 text-gray-600", text: "withdrew it" };
    default:
      return { icon: Megaphone, tone: "bg-gray-100 text-gray-600", text: e.kind };
  }
}

const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Newest-first log of everything that happened to the plan, with comments and submitted files. */
export function PlanTimeline({ plan: p }) {
  const fileById = new Map(p.files.map((f) => [f.id, f]));
  return (
    <Card>
      <CardHeader title="Timeline" description="Every change and review decision, newest first." />
      <ol className="relative space-y-5 border-l-2 border-gray-100 pl-6">
        {p.events.map((e) => {
          const { icon: Icon, tone, text } = describe(e);
          const attached = e.fileIds.map((id) => fileById.get(id)).filter(Boolean);
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
              {e.body && (
                <div className={cn("mt-2 rounded-xl border p-3", e.kind === "review" && e.decision !== "approve" ? "border-amber-200 bg-amber-50/40" : "border-gray-100 bg-white")}>
                  <Markdown>{e.body}</Markdown>
                </div>
              )}
              {attached.length > 0 && <div className="mt-2"><FileChips filesPath={filesPath(p.id)} files={attached} /></div>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
