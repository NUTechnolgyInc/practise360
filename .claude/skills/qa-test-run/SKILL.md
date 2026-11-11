---
name: qa-test-run
description: Execute an approved Practise360 test plan (from `qa-test-plan`) against a running environment — or a general smoke pass if no plan is named — and write a dated QA report under docs/qa/reports/. Use when the user approves a test plan and says to run it, or asks to "QA the app"/"run a regression pass".
---

# Practise360 QA Test Run

Black-box pass against a running app, written up as a report. Not a code review (`pr-reviewer`) and not a unit-test run.

## 0. Require an approved plan — or fall back to smoke scope

- Plan-driven: read the plan from `docs/qa/plans/`. Never run a plan still marked `DRAFT — awaiting approval` unless the user approved it in this conversation; note the approval in the report.
- No plan ("QA the app"): run the smoke scope in §2 and say so in the report.

## 1. Resolve the environment

Default to local dev:
- Web: `http://localhost:3000` (`npm run dev:web`, or `preview_start` with the `web` launch config)
- API: `http://localhost:4000` (`npm run dev:api`, or the `api` launch config)

Use a deployed URL only if the user names it or it's documented in `docs/runbooks/deployment.md`. Never guess a URL.

Skim `docs/tracker/TRACKER.md` first — known 🟡/🔴 gaps are Known Gaps, not new defects.

## 2. Default smoke scope

Login uses the dev stop-gap (seed usernames from `docs/rbac.md` §7, password `password`) on a **local** host only — that's test data for the user's own app.

1. API health: `curl -fsS -w '\n%{http_code}\n' http://localhost:4000/` (plus any documented health route).
2. Log in as `superadmin`, `practices.admin`, `de.manager`, `de.lead`, `de.dev1`, `qa.lead`, `cert.admin`, `aitracker.member`, `multi.user` — for each, confirm the app launcher shows exactly the apps `docs/rbac.md` says it should.
3. As `de.dev1`: try a Manager-only action via the API directly — expect refusal.
4. As `qa.lead`: confirm DE practitioners are not visible in Cert Tracker team view.
5. As `de.manager`: confirm Practice Manager is not offered in the role-assignment dropdown.
6. Edge paths: unknown route, deep link to a page the user can't access (expect a "No access" page, not a crash).

Skip steps for features not built yet and mark them Skipped with the reason.

## 3. Plan-driven scope

Run each scenario in order — `curl` for API scenarios, the built-in browser for UI. Don't improvise; note extra ideas under Suggested Additions. Scenarios you can't execute as written are Skipped with the blocker, never Pass.

## 4. Long runs

For ~15+ scenarios or anything slow, delegate to the `qa-runner` agent (`subagent_type: qa-runner`) in the background with: environment URLs, plan path (or "default smoke scope"), and the exact report path.

## 5. Report

Write `docs/qa/reports/QA-Report-<feature-slug-or-smoke>-<YYYY-MM-DD>.md`:

```markdown
# QA Report — Practise360 — <feature or "Smoke"> — <YYYY-MM-DD>

**Environment**: <web URL> / <api URL>
**Plan**: <path or "none — unscoped smoke pass">
**Approved by**: <user + message reference> / N/A
**Tester**: Claude (automated pass), triggered by <user>
**Build**: <`git rev-parse --short HEAD`>

## Summary
<N> run — <P> passed, <F> failed, <S> skipped

## Results
| ID | Title | User | Expected | Actual | Status |
|---|---|---|---|---|---|

## Defects Found
1. **<title>** — repro steps, expected vs actual, severity (Blocker/Major/Minor), suspected area

## Known Gaps (from TRACKER.md)
- <ticket> — <note>

## Suggested Additions
- ...

## Recommendation
Ship / Ship with caveats / Do not ship — one or two sentences.
```

## 6. After writing

Give the report path and headline counts; lead with any Blocker/Major. Don't edit `docs/tracker/TRACKER.md` — recommend the status change instead.
