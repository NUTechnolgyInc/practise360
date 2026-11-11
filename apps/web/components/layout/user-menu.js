"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

/** `user` = { name, username, assignments: [{ role, scope }] } (display labels, not ids). */
export function UserMenu({ user, onSignOut, extraItems }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-3 rounded-full border border-gray-200 p-1.5 transition-all hover:bg-gray-100"
      >
        <Avatar name={user.name} />
        <span className="hidden pr-2 text-left lg:block">
          <span className="block text-xs font-bold leading-tight text-nu-navy">{user.name}</span>
          <span className="block text-[10px] text-nu-muted-teal">{user.username}</span>
        </span>
        <ChevronDown className="mr-1 size-4 text-gray-400" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-72 animate-fade-in rounded-2xl border border-gray-100 bg-white py-2 shadow-xl">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="text-sm font-bold text-nu-lapis">{user.name}</div>
            <div className="mb-2 font-mono text-xs text-gray-500">{user.username}</div>
            <div className="flex flex-wrap gap-1">
              {user.assignments?.map((a) => (
                <Badge key={`${a.role}@${a.scope}`} variant="primary">
                  {a.role} @ {a.scope}
                </Badge>
              ))}
            </div>
          </div>
          <div className="py-1">
            {extraItems}
            <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut?.(); }} className="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-nu-navy hover:bg-gray-50">
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
