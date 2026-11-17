# Claude Development Guide — Practise360

## Project Context

**Practise360** is NULogic's internal portal that hosts several internal **apps** under one login. A user only sees the apps their roles give them access to.

| App | Purpose |
|---|---|
| **Practices** | Manage practices (Digital Engineering, Platform, QA, AI), their members and roles |
| **Certification Tracker** | Practitioners plan and track certifications/courses; Leads and Managers suggest or assign them |
| **AI Tracker** | Track AI initiatives; has its own admins and members (requirements still open) |

**Owner**: Rishav
**Status**: Pre-build. RBAC designed; working mockup being produced first (see `docs/gemini-mockup-prompt.md`).
**Branding**: NULogic — use the `nulogic-branding` skill for any UI, document or visual output.

---

## Authority & Conflict Resolution

1. **`docs/rbac.md` is the source of truth** for roles, permissions, scopes and the escalation guard. Code that disagrees with it is a bug, or a design change that needs the owner's sign-off *and* an update to `docs/rbac.md` in the same PR.
2. **`docs/tracker/TRACKER.md`** is the source of truth for implementation status.
3. If a request conflicts with the RBAC doc, flag it and ask — don't silently diverge.

---

## Architecture

npm workspaces monorepo, both apps deployed to Vercel (two projects from one repo).

```
apps/
  web/   Next.js 15 + React 19 frontend          (localhost:3000)
  api/   Express 4 backend, Vercel serverless fn (localhost:4000)
docs/
  rbac.md                  RBAC design (source of truth)
  ui-guidelines.md         UI rules: tokens, component kit, RBAC-in-UI, a11y
  gemini-mockup-prompt.md  Prompt used to generate the clickable mockup
  tracker/                 Delivery tracker + archive
  qa/                      Test plans and QA reports
  runbooks/                Operational steps (deploy, etc.)
scripts/tracker/           Tracker parser + local Kanban board
```

- `apps/api/src/app.js` exports the Express app (no `listen`); `src/local.js` is the local server; `api/index.js` is the Vercel entry.
- Node 20 (`.nvmrc`). Package manager: **npm** (not pnpm).

---

## RBAC Summary (full detail in `docs/rbac.md`)

- **Scope tree**: `platform → app (practices | cert-tracker | ai-tracker) → practice (digital-engineering | platform | qa | ai, + more created by Practices Admin) → group (e.g. digital-engineering-fullstack)`. A role granted at a parent applies to all children.
- **Assignment** = `{ userId, roleId, scopeType, scopeId }`. Users can hold many.
- **Permission keys**: `<app>.<resource>.<action>`, `:own` suffix = only on records the user owns.
- **System roles**: Super Admin, Practices Admin, Practice Manager, Practice Lead, Practitioner, Cert Admin, AI Admin, AI Member. Plus **custom roles** created inside a practice.
- **App visibility is derived** from assignments — no separate app-access table.
- **Groups**: each practice has one Manager and named groups, each with one Practice Lead (a group-scoped role). A member sits in at most one group per practice. Contributions and cert plans are checked at the owner's current group, so a **Lead only reaches their own group's members**; the Manager reaches the whole practice.
- **Cert Tracker reuses practice/group scope** — no scopes of its own.
- **Escalation guard**: to grant role R at scope S you need the assign permission at S *and* every permission in R; roles carry `assignableFrom` (Practice Manager is only grantable from app scope).
- **Enforce on the API**, always. The web app uses the same data only to hide/show UI — never as the security boundary.

### Auth (dev stop-gap)
Username + password, password hardcoded to `password` for every seeded user. This must stay behind `AUTH_MODE=dev` and never ship to production. Auth only produces a `userId`; RBAC must not depend on how login works, so SSO can replace it later.

---

## Developer Workflow

### Before Writing Code
1. Check `docs/rbac.md` if the change touches access, roles, or anything a user can see/do.
2. Check `docs/tracker/TRACKER.md` for the ticket's status and notes.
3. Check memory (see below) for decisions already made.

### During Development
- **UI**: follow `docs/ui-guidelines.md` — compose from `apps/web/components/ui` + `components/layout`, `nu-*` tokens only (no hex), one primary button per view, hide what `can()` denies. Live kit at http://localhost:3000/ui-kit.
- **One authorization helper**: every permission check goes through a single `can(user, permission, scope, resource?)` — no ad-hoc `if (user.role === 'manager')` checks anywhere.
- **Server-side enforcement**: every API route that reads or mutates practice/cert/AI data declares its required permission and scope via middleware.
- **No secrets in the repo**: env values live in Vercel / local `.env` (gitignored). Use `[REDACTED]` placeholders in docs.
- **Synthetic data only** in seeds, mocks and tests — fictional names, no real employee data.
- **Comments explain *why***, not what.

### Tracker

**`docs/tracker/TRACKER.md`** is the source of truth for implementation status — not commit messages, not "a PR merged." It has a status table per epic (Open / In Progress / Blocked / Done) with health (🟢/🟡/🔴), plus an append-only Change Log with the *why* behind each change.

Update it whenever you:
- Finish work on a ticket — only mark **Done** after checking every acceptance criterion against the actual code. Partial = `In Progress` + 🟡 with the gap in the Note.
- Hit a blocker — `Blocked`, 🔴/🟡, say what's blocking in the Note.
- Discover something marked Done is missing a piece — reopen it and log why.
- Start a ticket not yet in the table — add its row under the right epic.

Every change gets a Change Log entry (date, ticket ID, what and why). The Note column is the current one-liner; the Change Log is the history.

View it as a Kanban board: `npm run tracker` → http://localhost:4777.

### Changelog

**`CHANGELOG.md`** (repo root) records user-visible changes per release in Keep a Changelog format. Add an entry under `## [Unreleased]` in the same PR as any user-facing change (new screen, new permission, changed behavior). Tracker Change Log = delivery history; `CHANGELOG.md` = what changed for users.

### Skills & Agents (`.claude/`)
- `ui-builder` — build/change a screen or component with the NULogic kit, verify in the browser, or audit a screen against `docs/ui-guidelines.md`.
- `pr-reviewer` — review a PR/diff against RBAC rules and project conventions.
- `qa-test-plan` — draft test scenarios for a feature, stop for approval.
- `qa-test-run` — execute an approved plan (or a smoke pass) and write a report to `docs/qa/reports/`.
- `qa-runner` agent — background executor used by `qa-test-run` for long passes.

### Before Pushing
1. `npm run build` passes, `npm test -w api` passes, and `npm run test:e2e` passes (or every failure is a known, logged defect).
2. Tracker row + Change Log updated if status changed; `CHANGELOG.md` updated if user-visible.
3. One commit per atomic change; the message says *why*.

---

## Deployment

See `docs/runbooks/deployment.md`. Two Vercel projects: `web` (root `apps/web`) and `api` (root `apps/api`).

---

## Memory & Context Continuity

Project decisions and context live in `/Users/lalrishav/.claude/projects/-Users-lalrishav-personal-practise360/memory/`.

1. Read `MEMORY.md` first.
2. Check `project_*.md` for current state, `decision_*.md` before reopening settled questions.
3. Update memory when a major decision is made or a blocker appears.

---

## Open Questions (from `docs/rbac.md` §8)

1. Can a practitioner belong to more than one practice?
2. Can a Practice Manager appoint another Manager, or only Practices Admin?
3. Custom roles: per practice only, or also global templates?
4. ~~Does a Lead see all practitioners in the practice, or only direct reportees?~~ Answered 2026-11-12: Leads lead a group and act only on its members.
5. AI Tracker: entities and roles beyond Admin/Member?

---

**Last Updated**: 2026-11-11 — project Claude setup (CLAUDE.md, tracker, changelog, skills, memory).
