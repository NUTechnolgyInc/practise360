import { Badge } from "@/components/ui";

/** Dev-only list of seeded accounts (rendered only when the API reports AUTH_MODE=dev). Clicking one fills the form. */
export function DemoUsers({ users, onPick }) {
  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-nu-navy">Demo users</div>
      <p className="mb-3 text-[11px] text-gray-400">Dev mode — every account uses the password <span className="font-mono">password</span>.</p>
      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {users.map((u) => (
          <li key={u.username}>
            <button
              type="button"
              onClick={() => onPick(u.username)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple"
            >
              <span className="min-w-0">
                <span className="block font-mono text-xs font-semibold text-nu-lapis">{u.username}</span>
                <span className="block text-[11px] text-gray-500">{u.displayName}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} variant="primary" className="text-[10px]">{r}</Badge>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
