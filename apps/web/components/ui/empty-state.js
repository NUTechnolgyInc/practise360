import { Inbox, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-full bg-purple-50 text-nu-purple">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-bold">{title}</h3>
      {description && <p className="max-w-sm text-xs leading-relaxed text-nu-muted-teal">{description}</p>}
      {action}
    </div>
  );
}

/** Shown when a user reaches an app their assignments don't grant. UI only — the API still enforces. */
export function NoAccess({ action }) {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Access restricted"
      description="Your role assignments don't give you access to this app. Ask your Practice Manager or a platform admin."
      action={action}
      className="mx-auto mt-12 max-w-lg border-solid [&>span]:bg-rose-100 [&>span]:text-rose-600"
    />
  );
}
