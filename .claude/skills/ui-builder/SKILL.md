---
name: ui-builder
description: Build or change Practise360 web UI (screens, components, forms, modals, tables) in apps/web using the project's NULogic-branded component kit and docs/ui-guidelines.md. Use when asked to build a page/screen, add or restyle a component, port a screen from the mockup, or "make this look like the rest of the app". Also use to audit an existing screen against the UI guidelines.
---

# Practise360 UI Builder

Build UI that looks and behaves like the rest of Practise360 by composing the existing kit — not by writing new one-off markup. `docs/ui-guidelines.md` is the rulebook; this skill is the workflow.

## 1. Load context first

Read, in this order (skip what's already in context):
1. `docs/ui-guidelines.md` — tokens, component catalogue, RBAC-in-UI rules, a11y, checklist.
2. `apps/web/components/ui/index.js` and `apps/web/components/layout/index.js` — what already exists.
3. `docs/rbac.md` if the screen shows or gates anything by role (almost always).
4. The matching section of the mockup (`docs/gemini-mockup-prompt.md`) if porting a screen from it.

If a request conflicts with `docs/rbac.md` (e.g. showing data a role can't see), stop and flag it — don't build it.

## 2. Plan the screen before writing code

Write a short plan (in chat, not a file) listing:
- **Route** and file under `apps/web/app/`.
- **Composition**: `AppShell` → `PageHeader` → which `Card`s / `Table` / `Tabs` / `StatTile`s.
- **Permissions**: each permission-gated control and the exact `can(permission, scope)` call that gates it. Note the API route that must enforce the same thing.
- **States**: empty, loading, error, no-access.
- **New primitives needed** (should be rare). If an existing one almost fits, extend it with a variant instead.

For a new screen or a big change, show the plan and wait for the user's OK. For a small tweak, just proceed.

## 3. Build

- Pages compose; feature composites go in `components/<app>/` (`practices/`, `certs/`, `ai-tracker/`, `admin/`); generic pieces go in `components/ui/`.
- Use `nu-*` tokens and the `bg-nu-primary` / `bg-nu-brand-bar` / `bg-nu-dark` utilities. **No hex values, no inline styles** (except dynamic widths).
- One `primary` button per view; secondary actions use `secondary`/`ghost`.
- Status chips always via `StatusBadge`; add new statuses to its map in `components/ui/badge.js`.
- Gate controls with `can()` and **hide** what the user can't do. Components stay permission-agnostic — the page decides and passes props.
- Feedback for every mutation via `useToast()`; destructive actions go through a confirmation `Modal` with a `danger` button.
- Respect size limits (300/file, 150/component, 100/hook) — split early.
- Synthetic data only in mocks and the UI Kit.

New primitive? Follow the `cva` + `cn` + `className`/`...props` pattern in the guidelines §4, export it from `components/ui/index.js`, and add a demo to `apps/web/app/ui-kit/page.js`.

## 4. Verify in the browser

Never ask the user to check by hand.
1. `npm run build` (root) must pass. **Stop the `web` dev server first** — `next build` and `next dev` share `apps/web/.next`, and building under a running dev server corrupts its chunks (`__webpack_modules__[moduleId] is not a function`). If that error shows up: stop the server, `rm -rf apps/web/.next`, restart.
2. Start the `web` preview (`.claude/launch.json`) and open the route.
3. Check: console has no errors; layout at desktop and 375px (no horizontal scroll); keyboard flow (Tab through controls, Escape closes modals); permission gating by viewing as at least two seeded roles that should see different things.
4. Screenshot the result for the user.

## 5. Self-review against the checklist

Run through `docs/ui-guidelines.md` §10 and fix anything that fails before reporting. Then:
- `CHANGELOG.md` → `## [Unreleased]` entry for user-visible changes.
- `docs/tracker/TRACKER.md` → update the ticket row + Change Log if this work belongs to a ticket (the owner adds tickets; don't create them unasked).

## Audit mode

When asked to audit or review a screen's UI: read the files, compare against the guidelines (tokens, primitives reused, RBAC gating, states, a11y, responsive), and report findings as a short list — `file:line`, the rule broken, the fix. Don't change code unless asked.
