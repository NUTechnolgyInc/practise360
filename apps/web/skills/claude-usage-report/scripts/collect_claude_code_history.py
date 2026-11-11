#!/usr/bin/env python3
"""Summarise one month of Claude Code sessions from local transcripts (~/.claude/projects/**/*.jsonl).

Output is a compact JSON list of sessions (project, dates, prompt count, first prompts, tools used) that
Claude then categorises. Runs fully offline — nothing is sent anywhere.

Usage: python3 collect_claude_code_history.py --month 2026-10 [--root ~/.claude/projects] [--out history.json]
"""
import argparse
import json
import sys
from collections import Counter
from pathlib import Path

PROMPT_CHARS = 280  # enough to classify a session; keeps the output small and avoids dumping whole prompts
MAX_PROMPTS_PER_SESSION = 5


def human_text(message):
    """Text the human typed — tool results and system-injected blocks are not prompts."""
    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
        return "\n".join(p for p in parts if p)
    return ""


def is_noise(text):
    t = text.lstrip()
    return not t or t.startswith(("<command-", "<local-command", "<system-reminder", "Caveat:", "[Request interrupted"))


def summarise(path, month):
    session = None
    for line in path.open(encoding="utf-8", errors="replace"):
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = rec.get("timestamp") or ""
        if not ts.startswith(month) or rec.get("isSidechain"):
            continue
        if session is None:
            session = {"session_id": rec.get("sessionId", path.stem), "project": Path(rec.get("cwd") or "").name or path.parent.name,
                       "start": ts, "end": ts, "prompts": [], "prompt_count": 0, "tools": Counter(), "models": Counter()}
        session["end"] = max(session["end"], ts)
        if rec.get("cwd") and session["project"] == path.parent.name:
            session["project"] = Path(rec["cwd"]).name  # early queue records carry no cwd
        msg = rec.get("message") or {}
        if rec.get("type") == "user" and msg.get("role") == "user":
            text = human_text(msg)
            if not is_noise(text):
                session["prompt_count"] += 1
                if len(session["prompts"]) < MAX_PROMPTS_PER_SESSION:
                    session["prompts"].append(" ".join(text.split())[:PROMPT_CHARS])
        elif rec.get("type") == "assistant":
            if msg.get("model"):
                session["models"][msg["model"]] += 1
            for block in msg.get("content") or []:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    session["tools"][block.get("name", "?")] += 1
    if not session or session["prompt_count"] == 0:
        return None
    session["tools"] = dict(session["tools"].most_common(8))
    session["models"] = sorted(session["models"])
    return session


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--month", required=True, help="YYYY-MM")
    ap.add_argument("--root", default=str(Path.home() / ".claude" / "projects"))
    ap.add_argument("--out", help="write JSON here instead of stdout")
    args = ap.parse_args()

    root = Path(args.root).expanduser()
    if not root.is_dir():
        sys.exit(f"No Claude Code history at {root}")
    sessions = [s for p in sorted(root.glob("*/*.jsonl")) if (s := summarise(p, args.month))]
    sessions.sort(key=lambda s: s["start"])
    result = {
        "month": args.month,
        "source": "Claude Code history",
        "session_count": len(sessions),
        "prompt_count": sum(s["prompt_count"] for s in sessions),
        "projects": dict(Counter(s["project"] for s in sessions).most_common()),
        "sessions": sessions,
    }
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
        print(f"{len(sessions)} sessions, {result['prompt_count']} prompts in {args.month} -> {args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
