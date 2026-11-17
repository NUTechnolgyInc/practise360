"use client";

import { useState } from "react";
import { Mail, Search } from "lucide-react";
import { Avatar, Input } from "@/components/ui";
import { cn } from "@/lib/cn";

// A picked invitation is stored in the same `value` as a picked person, so modals keep one piece of state.
const INVITE = "invite:";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The email of a picked invitation (`value` from PersonSelect), or "" when a person (or nobody) is picked. */
export const invitedEmail = (value) => (typeof value === "string" && value.startsWith(INVITE) ? value.slice(INVITE.length) : "");

/**
 * Pick one person from `people` ({ id, username, displayName, email }) with search by name, username or email.
 * `value` = selected id. `note(person)` adds a short hint after a name (e.g. "current Lead", "in DevOps").
 * With `allowInvite`, typing an email nobody in `people` has offers "Invite <email>" — picking it sets `value`
 * to an invitation (read it back with `invitedEmail`). The API decides whether that email may be invited.
 */
export function PersonSelect({ id, label, people, loading, error, value, onChange, note, emptyText = "Nobody to pick", allowInvite = false }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = (p, text) => !text || `${p.displayName} ${p.username} ${p.email ?? ""}`.toLowerCase().includes(text);
  const shown = people.filter((p) => matches(p, needle));
  const canInvite = allowInvite && EMAIL_RE.test(needle) && !people.some((p) => p.email?.toLowerCase() === needle);
  const invited = invitedEmail(value);
  const showSearch = allowInvite || people.length > 6;

  // The pick must stay visible: otherwise the dialog's button acts on someone the search has hidden (e.g. a person
  // picked before typing an email to invite). An invitation follows the text it came from.
  const search = (text) => {
    setQ(text);
    const next = text.trim().toLowerCase();
    if (invited ? invited !== next : value && !people.some((p) => p.id === value && matches(p, next))) onChange("");
  };

  return (
    <fieldset aria-labelledby={`${id}-label`} aria-describedby={error ? `${id}-error` : undefined}>
      <span id={`${id}-label`} className="mb-1 block text-xs font-bold uppercase tracking-wider text-nu-navy">{label}</span>
      {showSearch && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <Input
            type="search"
            aria-label={`Search ${label.toLowerCase()}${allowInvite ? " or enter an email to invite" : ""}`}
            placeholder={allowInvite ? "Search by name or email, or enter an email to invite" : "Search people"}
            value={q}
            onChange={(e) => search(e.target.value)}
            className="pl-9"
          />
        </div>
      )}
      <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
        {canInvite && (
          <li>
            <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50", invited === needle && "bg-purple-50/60")}>
              <input type="radio" name={id} checked={invited === needle} onChange={() => onChange(INVITE + needle)} className="size-4 accent-nu-purple" />
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-50 text-nu-purple" aria-hidden="true">
                <Mail className="size-4" />
              </span>
              <span className="min-w-0 text-xs">
                <span className="block truncate font-bold text-nu-navy">Invite {needle}</span>
                <span className="block text-[11px] text-nu-muted-teal">Not on Practise360 yet — they'll get an email to join</span>
              </span>
            </label>
          </li>
        )}
        {loading && !people.length ? (
          <li className="p-3 text-xs text-nu-muted-teal" role="status">Loading people…</li>
        ) : shown.length === 0 ? (
          !canInvite && (
            <li className="p-3 text-xs text-gray-400">
              {people.length ? "Nobody matches" : emptyText}
              {allowInvite && " — type their full email to invite them"}
            </li>
          )
        ) : (
          shown.map((p) => (
            <li key={p.id}>
              <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50", value === p.id && "bg-purple-50/60")}>
                <input type="radio" name={id} checked={value === p.id} onChange={() => onChange(p.id)} className="size-4 accent-nu-purple" />
                <Avatar name={p.displayName} size="sm" />
                <span className="min-w-0 text-xs">
                  <span className="block font-bold text-nu-navy">
                    {p.displayName}
                    {note?.(p) && <span className="ml-1 font-normal text-nu-muted-teal">· {note(p)}</span>}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-gray-400">{p.email || p.username}</span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-rose-600">{error}</p>}
    </fieldset>
  );
}
