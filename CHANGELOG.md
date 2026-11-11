# Changelog

All notable user-visible changes to Practise360 are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Add entries under **Unreleased** in the same PR as the change, grouped as Added / Changed / Fixed / Removed / Security. Move them under a version heading when releasing.

## [Unreleased]

### Added
- Super Admin can edit system roles (name, description, permissions) from Access control → Roles, via the new `platform.roles.manage` permission. Super Admin itself stays read-only; `platform.*` permissions are limited to platform roles.
- AI Tracker → Claude usage reports (`/ai-tracker`): download the `claude-usage-report` Claude skill, generate a NULogic-branded monthly PDF from your Claude history, and upload it (one per month, re-upload replaces). Managers get a Team reports tab with Submitted/Pending status per person and month.
- In-app PDF viewer: page navigation, page-number jump, zoom with fit-to-width, download, keyboard shortcuts (←/→, Esc).
- API: `/ai/usage-reports` routes (own upload/list/delete, team view, PDF download), documented in Swagger; `npm run sync-roles -w api` to apply catalog changes without reseeding.
- API docs: Swagger UI at `/docs` and the OpenAPI 3 spec at `/openapi.json` on the API, covering every route (a test fails if a route is undocumented).
- Sign-in page with username + password (dev mode only; every seeded account uses `password`) and a one-click demo-user list. "Continue with Google" is shown but not implemented yet.
- Home page showing the apps your roles give you, plus links to Settings and Access control.
- Settings page with your account, role assignments and effective permissions.
- Access control portal (`/access-control`): grant and revoke roles per user (pickers only offer what the escalation guard allows), create/edit/delete custom practice roles, and a read-only permission matrix.
- MongoDB-backed API: dev login, `/me`, and `/rbac/*` routes with server-side permission checks; seed script `npm run seed -w api`.
- Hello-world monorepo: Next.js web (`apps/web`) and Express API (`apps/api`), deployable to Vercel.
- NULogic-branded UI kit in `apps/web` (Tailwind v4 tokens; Button, Badge/StatusBadge, Card, form fields, Modal, Tabs, Table, StatTile, Progress, Avatar, EmptyState/NoAccess, Toast; AppShell with sidebar, top bar and user menu) with a live gallery at `/ui-kit`.
- UI guidelines (`docs/ui-guidelines.md`) and `ui-builder` project skill.
- Initial RBAC design (`docs/rbac.md`) and mockup generation prompt (`docs/gemini-mockup-prompt.md`).
- Project workflow: `CLAUDE.md`, delivery tracker with Kanban board (`npm run tracker`), QA plan/report folders, review guide and CI.

### Changed
- Access control → Grant a role: pick the scope first (grouped Platform / Apps / Practices), then a role grantable there — previously role came first and the scope list was hard to read.
- `npm run sync-roles -w api` only inserts missing system roles so Super Admin edits survive; pass `-- --reset` to restore the defaults.
- New permissions `ai.usage.manage:own` (all practice roles, AI Member) and `ai.usage.view` (Practice Manager, Practices Admin, AI Admin) — AI Tracker now appears for every practice member.
- Home page app tile for AI Tracker now opens the app instead of showing "Coming soon".
- Practices Admin now also holds `cert.catalog.view` and all `cert.plan.*` permissions, so it can appoint Practice Managers under the escalation guard (see `docs/rbac.md`).
