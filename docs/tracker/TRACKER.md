# Practise360 Delivery Tracker

Source of truth for **implementation status**. Scope and design live in `docs/rbac.md` (and future spec docs); this file is what "is it actually done" means for this repo.

**Do not mark a ticket Done just because a commit referencing it landed.** Done means every acceptance criterion was checked against the actual code.

## How to use this file

- **Status**: `Open` (not started) · `In Progress` · `Blocked` · `Done` (every acceptance criterion verified against code, not just "a PR merged")
- **Health**: 🟢 on track / no concerns · 🟡 works but has a known gap, deferred risk, or needs follow-up · 🔴 broken, missing a required piece, or blocking other work
- **Note**: one line — current blocker, what's missing, or the next concrete step. Not a changelog entry.
- **Change Log** (bottom of file): append-only, reverse-chronological. One entry per status/health change, dated, with *why*. The table only shows the current snapshot.

Update this file (table row + a Change Log entry) whenever you: finish work on a ticket, discover a gap before marking it Done, hit a blocker, or change your assessment of a ticket already marked Done. See `CLAUDE.md` → Developer Workflow → Tracker.

### Adding epics

Each epic is a `## <EPIC-ID> — <Title>` heading followed by a table with the columns `ID | Title | Status | Health | Last Updated | Note`. Add an epic only when work on it starts — don't pre-populate. Suggested epic IDs: `P360-E1 Platform & Auth`, `P360-E2 RBAC`, `P360-E3 Practices`, `P360-E4 Certification Tracker`, `P360-E5 AI Tracker`, `P360-E6 Admin`.

### Compressing the Change Log

Compress when the Change Log passes ~150–200 lines, or when a milestone closes. Move older entries verbatim into `docs/tracker/archive/<milestone-or-date-range>.md` and replace them here with one line: `Entries before <date> archived to archive/<file>.md`. Never touch the status tables when compressing.

---

*(No epics yet — tasks will be added when planning starts.)*

---

## Change Log

### 2026-11-11 — UI kit, guidelines and ui-builder skill
Added the NULogic-branded component kit to `apps/web` (Tailwind v4 tokens, `components/ui`, `components/layout`, `components/brand`, `/ui-kit` gallery), `docs/ui-guidelines.md`, and the `ui-builder` skill, so screens built from the mockup share one look and one set of RBAC-in-UI rules. Foundation only — no ticket; real screens (launcher, practices, certs, AI tracker, admin) are still to be built. Logo uses the official SVGs because the bundled PNGs have an opaque white background that breaks on the navy sidebar.

### 2026-11-11 — Tracker created
Project Claude setup: tracker, changelog, skills and memory added, mirroring the quizzy workflow. No tickets yet — the owner will add tasks later.
