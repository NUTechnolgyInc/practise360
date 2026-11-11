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

## P360-E1 — Platform & Auth

| ID | Title | Status | Health | Last Updated | Note |
|---|---|---|---|---|---|
| P360-1 | Dev login (username + password) with seeded users | Done | 🟢 | 2026-11-11 | Behind `AUTH_MODE=dev`; API refuses to boot with it on Vercel production |
| P360-2 | Google sign-in | Open | 🟡 | 2026-11-11 | Button + `POST /auth/google` stub (501) only |
| P360-3 | Home page (visible apps, quick links) | In Progress | 🟡 | 2026-11-11 | App cards are "Coming soon" until the apps exist |
| P360-4 | Settings page (account, assignments, permissions) | Done | 🟢 | 2026-11-11 | Read-only |
| P360-8 | Swagger / OpenAPI docs for the API | Done | 🟢 | 2026-11-12 | `/docs` + `/openapi.json`; `test/openapi.test.js` checks spec ↔ routes |

## P360-E2 — RBAC

| ID | Title | Status | Health | Last Updated | Note |
|---|---|---|---|---|---|
| P360-5 | MongoDB RBAC schema + seed | Done | 🟢 | 2026-11-11 | `npm run seed -w api`; rbac.md §2 updated to Mongo collections |
| P360-6 | RBAC engine (`can`, escalation guard, visible apps) + API enforcement | Done | 🟡 | 2026-11-11 | 9 unit tests; Practices Admin perms widened — needs owner sign-off |
| P360-7 | Access control portal (assign/revoke, custom roles, matrix) | Done | 🟢 | 2026-11-12 | Grant role is now scope → role; no user create/disable yet (`platform.users.manage`) |
| P360-10 | Super Admin edits system roles (`platform.roles.manage`) | Done | 🟢 | 2026-11-12 | Super Admin role itself locked; sync-roles no longer overwrites edits (`--reset` to restore) |

## P360-E5 — AI Tracker

| ID | Title | Status | Health | Last Updated | Note |
|---|---|---|---|---|---|
| P360-9 | Claude usage reports: skill, PDF upload, team view, PDF viewer | In Progress | 🟡 | 2026-11-12 | Built + verified locally; needs owner sign-off on RBAC (Lead visibility, rbac.md §8 Q6) and a Vercel deploy check |

---

## Change Log

### 2026-11-12 — P360-7 / P360-10: Grant role order, editable system roles
Owner feedback: the Grant role form asked for a role before the scope, which was confusing since roles are tied to a scope level — it now lists grantable scopes first (grouped Platform / Apps / Practices) and then only the roles grantable there. Owner also asked that Super Admin can change system roles and their permissions: added `platform.roles.manage` (held only via Super Admin's `*`) and let `PATCH /rbac/roles/:id` edit system roles' name/description/permissions; scope and `assignableFrom` stay fixed, Super Admin itself is locked to prevent lockout, and `platform.*` is limited to platform roles. `sync-roles` switched to insert-only so it doesn't silently undo admin edits. rbac.md §3/§4 updated. Verified: 18 API tests (1 new); in browser as superadmin — edit + save Practitioner (reverted), guards return 400/403 as expected, scope → role filtering for QA and AI Tracker.

### 2026-11-12 — P360-9: Claude usage reports
AI Tracker's first (and for now only) feature. Added the `claude-usage-report` skill (`apps/web/skills/`, zipped to `/skills/claude-usage-report.zip` at dev/build) that collects a month of Claude history and renders a fixed NULogic-branded PDF via reportlab, so reports are comparable across people. API stores one PDF per user per month in Mongo (`usage_reports`, ≤ 4 MB to fit Vercel's 4.5 MB body cap) and enforces visibility by the owner's practice scope (new `ai.usage.*` permissions, rbac.md §4). Web: `/ai-tracker` with My reports / Team reports tabs and a pdf.js viewer. Verified: 6 new unit tests, API role matrix via curl, UI as de.dev1 and de.manager incl. 375px. Left 🟡 because the RBAC change (and Leads not seeing reports) needs owner sign-off, and production upload size hasn't been tested on Vercel.

### 2026-11-12 — P360-8: Swagger docs
Added a hand-written OpenAPI 3 spec (`apps/api/src/openapi.js`) served at `/openapi.json`, with Swagger UI at `/docs` loaded from a pinned CDN build so nothing extra is bundled into the Vercel function. A test walks the Express router and fails if the spec and routes drift. Verified: 15 operations render and dev login + `/me` work from the docs page.

### 2026-11-11 — P360-1…7: login, home, settings, RBAC portal on MongoDB
Built the first slice end to end: Mongoose models + seed (rbac.md §7 users), dev JWT login, `/me`, `/rbac/*` routes enforced server-side, and the web login / home / settings / `/access-control` screens. Practices Admin was given the cert.plan.* permissions because without them rbac.md §5 (Practices Admin appoints Managers) contradicts the escalation guard — flagged for sign-off, so P360-6 is 🟡. Google sign-in is a visible stub only (P360-2 open). App cards on Home stay "Coming soon" until the apps are built (P360-3 in progress).

### 2026-11-11 — UI kit, guidelines and ui-builder skill
Added the NULogic-branded component kit to `apps/web` (Tailwind v4 tokens, `components/ui`, `components/layout`, `components/brand`, `/ui-kit` gallery), `docs/ui-guidelines.md`, and the `ui-builder` skill, so screens built from the mockup share one look and one set of RBAC-in-UI rules. Foundation only — no ticket; real screens (launcher, practices, certs, AI tracker, admin) are still to be built. Logo uses the official SVGs because the bundled PNGs have an opaque white background that breaks on the navy sidebar.

### 2026-11-11 — Tracker created
Project Claude setup: tracker, changelog, skills and memory added, mirroring the quizzy workflow. No tickets yet — the owner will add tasks later.
