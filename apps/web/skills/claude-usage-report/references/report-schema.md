# report.json schema

`scripts/build_report.py` validates this. All fields are required unless marked optional.

```json
{
  "meta": {
    "name": "Riley Patel",
    "practice": "Digital Engineering",
    "month": "2026-10",
    "sources": ["Claude Code history", "Claude.ai past chats"],
    "conversations_analyzed": 84,
    "coverage_note": "All sessions in the month were analysed."
  },
  "executive_summary": {
    "summary": "3–5 sentences for leadership.",
    "highlights": ["Up to 4 short bullet points"]
  },
  "use_cases": [
    { "category": "Coding", "count": 31, "example": "Built REST endpoints with validation and tests" }
  ],
  "productivity": {
    "assumptions": "Manual estimates assume a mid-level engineer without AI assistance.",
    "by_category": [
      { "category": "Coding", "manual_minutes": 120, "claude_minutes": 40 }
    ]
  },
  "top_roi": [
    { "task": "Writing API integration tests", "why": "Boilerplate-heavy; Claude drafts 80% correctly first time" }
  ],
  "recurring_work": [
    {
      "task": "Weekly status email",
      "frequency_per_month": 4,
      "make_skill": true,
      "benefit": "Consistent format, ~20 min saved each week"
    }
  ],
  "insights": {
    "patterns": ["Short bullet sentences"],
    "strengths": ["..."],
    "improvements": ["Concrete prompting or automation suggestions"]
  }
}
```

Rules:
- `month` is `YYYY-MM`.
- `use_cases[].category` values should come from the standard list in `SKILL.md` so reports roll up.
- Every `productivity.by_category[].category` must also appear in `use_cases` — the script multiplies minutes by that category's `count` to get hours saved.
- Minutes are **per task**; `claude_minutes` must be ≤ `manual_minutes`.
- Keep strings short; the PDF wraps text but long paragraphs make it unreadable for leadership.
