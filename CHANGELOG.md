# Changelog

All notable user-visible changes to Practise360 are recorded here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Add entries under **Unreleased** in the same PR as the change, grouped as Added / Changed / Fixed / Removed / Security. Move them under a version heading when releasing.

## [Unreleased]

### Added
- Hello-world monorepo: Next.js web (`apps/web`) and Express API (`apps/api`), deployable to Vercel.
- NULogic-branded UI kit in `apps/web` (Tailwind v4 tokens; Button, Badge/StatusBadge, Card, form fields, Modal, Tabs, Table, StatTile, Progress, Avatar, EmptyState/NoAccess, Toast; AppShell with sidebar, top bar and user menu) with a live gallery at `/ui-kit`.
- UI guidelines (`docs/ui-guidelines.md`) and `ui-builder` project skill.
- Initial RBAC design (`docs/rbac.md`) and mockup generation prompt (`docs/gemini-mockup-prompt.md`).
- Project workflow: `CLAUDE.md`, delivery tracker with Kanban board (`npm run tracker`), QA plan/report folders, review guide and CI.
