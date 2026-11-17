"use client";

import { useRef, useState } from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEPARATORS = /[,;\s]+/;

/** Same shape check as the API (apps/api/src/lib/invites.js) — the API still has the final say. */
export const isEmailAddress = (v) => typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);

/** "Ana@x.com, ben@x.com; cara@x.com" → ["ana@x.com", "ben@x.com", "cara@x.com"]. */
export const splitEmails = (text) => String(text).split(SEPARATORS).map((s) => s.trim().toLowerCase()).filter(Boolean);

const chipVariants = cva("inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-0.5 text-xs font-medium", {
  variants: {
    tone: {
      valid: "border-purple-200 bg-purple-50 text-nu-purple",
      invalid: "border-rose-200 bg-rose-50 text-rose-700",
    },
  },
  defaultVariants: { tone: "valid" },
});

/** One address as a pill with a remove button. `error` styles it red and is read out with it. */
export function EmailChip({ email, error, onRemove, disabled, className, ...props }) {
  return (
    <span className={cn(chipVariants({ tone: error ? "invalid" : "valid" }), className)} title={error || undefined} {...props}>
      <span className="truncate">{email}</span>
      {error && <span className="sr-only">({error})</span>}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${email}`}
          className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nu-purple disabled:opacity-50"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/**
 * Type several email addresses: a comma (or semicolon), Enter, leaving the field, or pasting a list turns the text into
 * chips. Backspace in the empty field removes the last chip. Repeats are ignored; addresses `validate` rejects (by
 * default anything that isn't an email) stay as red chips so the person can see and remove them.
 * Controlled: `value` = string[] of lower-cased addresses, `onChange(next)`. Use inside `Field` as a render child so
 * `id`, `aria-describedby` and `aria-invalid` reach the text box.
 */
export function EmailChipsInput({
  id,
  value,
  onChange,
  validate = (email) => (isEmailAddress(email) ? null : "Not a valid email address"),
  max,
  disabled,
  placeholder = "name@example.com, another@example.com",
  className,
  ...props
}) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);
  const full = max != null && value.length >= max;

  /** Adds new addresses after the current ones, skipping repeats and anything past `max`. */
  const commit = (emails) => {
    const seen = new Set(value);
    const added = [];
    for (const e of emails) {
      if (seen.has(e) || (max != null && value.length + added.length >= max)) continue;
      seen.add(e);
      added.push(e);
    }
    if (added.length) onChange([...value, ...added]);
  };

  const type = (text) => {
    // Whatever comes before the last separator is finished; the rest is still being typed.
    if (!/[,;]/.test(text)) return setDraft(text);
    const parts = text.split(/[,;]/);
    commit(splitEmails(parts.slice(0, -1).join(",")));
    setDraft(parts.at(-1).trimStart());
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && draft.trim()) {
      e.preventDefault();
      commit(splitEmails(draft));
      setDraft("");
    } else if (e.key === "Backspace" && !draft && value.length) {
      e.preventDefault();
      onChange(value.slice(0, -1));
    }
  };

  // A single-line input drops line breaks from pasted text, so a pasted column of addresses would run together.
  const onPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (!SEPARATORS.test(text.trim())) return;
    e.preventDefault();
    commit(splitEmails(`${draft} ${text}`));
    setDraft("");
  };

  const onBlur = () => {
    if (!draft.trim()) return;
    commit(splitEmails(draft));
    setDraft("");
  };

  const remove = (email) => {
    onChange(value.filter((v) => v !== email));
    inputRef.current?.focus();
  };

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2 py-1.5 focus-within:ring-2 focus-within:ring-nu-purple",
        props["aria-invalid"] && "border-rose-300 ring-rose-200",
        disabled && "cursor-not-allowed bg-gray-50",
        className,
      )}
    >
      {value.length > 0 && (
        <ul className="contents" aria-label="Email addresses">
          {value.map((email) => (
            <li key={email} className="max-w-full">
              <EmailChip email={email} error={validate(email)} disabled={disabled} onRemove={() => remove(email)} />
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        disabled={disabled || full}
        placeholder={value.length ? (full ? `That's the maximum of ${max}` : "Add another…") : placeholder}
        onChange={(e) => type(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        onBlur={onBlur}
        className="min-w-[14ch] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-nu-dark-teal placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed"
        {...props}
      />
    </div>
  );
}
