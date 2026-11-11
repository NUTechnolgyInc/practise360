---
name: claude-usage-report
description: Generate the monthly NULogic "Claude Usage Report" — an executive PDF that analyses how you used Claude in a given month (use cases, time saved, recurring work worth turning into skills, insights) for upload to Practise360 → AI Tracker. Use when the user asks for their Claude usage report, monthly AI usage report, "how effectively am I using Claude", or mentions the Practise360 usage report.
---

# Claude Usage Report (NULogic · Practise360)

Produces **one PDF** per person per month, in a fixed NULogic-branded layout so leadership can compare reports side by side. The user uploads the PDF in Practise360 → AI Tracker → Claude usage.

The workflow is: **collect** history for the month → **analyse** it into `report.json` (schema in `references/report-schema.md`) → **render** the PDF with `scripts/build_report.py`. Never hand-write the PDF layout; always go through the script so every report looks the same.

## Step 0 — Confirm the basics

Ask only for what you can't infer:
- **Reporting month** — default to the previous calendar month (`YYYY-MM`).
- **Name** and **practice/team** for the cover (e.g. "Digital Engineering").

## Step 1 — Collect the month's conversations

Use whichever sources exist in this environment, and say which ones you used (they go into `meta.sources`):

| Environment | How |
|---|---|
| **Claude Code** (CLI / desktop Code tab) | `python3 scripts/collect_claude_code_history.py --month YYYY-MM --out /tmp/claude-history.json`. Reads `~/.claude/projects/**/*.jsonl` locally; nothing leaves the machine. |
| **Claude.ai / Desktop chat** with past-chat search | Use the chat history tools (e.g. `recent_chats` with date bounds, `conversation_search` by topic) to list every conversation in the month. Page through until you reach the month start. |
| Neither available | Ask the user to paste or export a list of the month's conversation titles + one-line purpose. Don't invent conversations. |

Count **conversations/sessions**, not messages. If sampling was needed (very large month), say so in `meta.coverage_note`.

## Step 2 — Analyse

Build `report.json` exactly as `references/report-schema.md` describes. Guidance:

1. **Primary use cases** — classify every conversation into one category. Prefer this standard list so reports roll up across the company: `Coding`, `Debugging`, `Architecture & design`, `Code review`, `Testing & QA`, `Documentation`, `Project management`, `Emails & communication`, `Proposals & presales`, `Research & learning`, `Data & analysis`, `Brainstorming`, `Other`. Give count and a one-line example per category.
2. **Productivity** — per category estimate typical *manual* minutes vs *with-Claude* minutes for one task. Use conservative, defensible numbers (state assumptions in `productivity.assumptions`). The script computes hours saved and % improvement — don't pre-compute them differently.
3. **Highest ROI** — the 3 tasks with the biggest time saved per task, with why.
4. **Recurring work** — tasks seen ≥ 3 times in the month. For each, say whether it should become a reusable Claude Skill and the expected benefit.
5. **Insights** — working patterns, strengths, and 3–5 concrete prompting/automation improvements.
6. **Executive summary** — 3–5 sentences a leader can read in 20 seconds, plus 4 headline KPIs.

### Privacy rules (mandatory)
- Describe work at **category / task level**. Never quote client names, credentials, keys, personal data, or confidential code in the report.
- Use generic phrasing: "Built an RBAC API for an internal portal", not the client or repo name, unless the user explicitly says it's fine.
- Show the user the draft `report.json` summary (categories + KPIs) and ask them to confirm before rendering.

## Step 3 — Render the PDF

```bash
pip install --quiet reportlab matplotlib   # once, if missing
python3 scripts/build_report.py report.json --out "Claude-Usage-<Name>-<YYYY-MM>.pdf"
```

The script validates the JSON, draws the charts, applies NULogic branding (Lapis Blue headings, brand gradient bar, wordmark from `assets/`), and writes the PDF. Fix any validation error it prints and re-run.

In Claude.ai, run the same script with the code-execution tool and offer the PDF as a download.

## Step 4 — Hand off

Tell the user:
- the PDF path / download,
- the 4 headline KPIs,
- "Upload it in **Practise360 → AI Tracker → Claude usage** for <Month YYYY>." (one report per month; re-uploading replaces it).
