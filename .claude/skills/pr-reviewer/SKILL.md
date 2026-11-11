---
name: pr-reviewer
description: Review a Practise360 pull request, branch, or the current diff against this project's RBAC design (docs/rbac.md), security rules and conventions in CLAUDE.md. Use when asked to review a PR, review a diff/branch, or check code against Practise360 conventions before merge.
---

# Practise360 PR Reviewer

Review changed code against this project's confirmed design, not generic style preferences. The general `code-review` skill covers correctness bugs — this skill adds the Practise360-specific checks a generic reviewer would miss: RBAC correctness, server-side enforcement, escalation guard, tracker/changelog hygiene.

## 1. Determine the target

In this order:
1. An explicit PR number / branch / path the user gave.
2. Otherwise, the current branch's diff against `main` (`git diff main...HEAD`).
3. Otherwise, uncommitted working-tree changes (`git status` + `git diff`).

```bash
gh pr diff <number> --name-only   # or: git diff --name-only main...HEAD
gh pr diff <number>                # or: git diff main...HEAD
```

If the PR/branch name contains a ticket ID, look it up in `docs/tracker/TRACKER.md` — the PR should satisfy that ticket's scope, not more.

## 2. Scope & design check (before line-by-line)

- **RBAC alignment**: does anything touching roles, permissions, scopes, or visibility match `docs/rbac.md`? A new permission key, role, or scope type that isn't in the doc must come with a doc update in the same PR — otherwise flag it.
- **Auth stop-gap**: the hardcoded `password` login must stay behind `AUTH_MODE=dev`. Flag any path where it could run in production, and any RBAC code that depends on *how* the user logged in.
- **Open questions** (`CLAUDE.md` → Open Questions): flag code that silently answers one of them (e.g. hard-limits users to one practice) without the owner deciding.

## 3. Code-level checklist

### Authorization
- Every API route that reads/mutates practice, cert, AI-tracker or admin data declares a required permission + scope via middleware. No unguarded routes.
- All checks go through the single `can(user, permission, scope, resource?)` helper — no `user.role === '...'` comparisons, no hardcoded usernames.
- Scope is derived from the **resource** being touched (e.g. the target practitioner's practice), not from a client-supplied field the caller controls.
- `:own` permissions verify ownership server-side.
- Role assignment endpoints enforce the **escalation guard**: actor holds assign permission at the scope *and* every permission in the granted role; `assignableFrom` respected (Practice Manager only from app scope).
- Custom roles are created only within their practice and only from the allowed permission subset.
- UI hiding is never the only control — if a button is hidden, the API must also refuse.

### Data & privacy
- No secrets, tokens or real credentials committed or logged. Env values only via Vercel / local `.env`.
- Seeds, fixtures and mocks use fictional data only.
- Responses don't leak data from practices the caller can't see (check list endpoints and filters, not just detail endpoints).

### Certification Tracker rules
- Assigned plans can't be declined/dropped by the practitioner; suggested plans can.
- Status transitions follow `docs/rbac.md` §6 (SUGGESTED → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED, plus DECLINED/DROPPED/EXPIRED).
- Verify is limited to `cert.plan.verify` holders.

### Tests
- Behavior changes have tests that would fail without the change.
- Authorization changes have **negative** tests (wrong practice, missing permission, escalation attempt), not just happy-path.

### Hygiene
- `docs/tracker/TRACKER.md` row + Change Log updated if a ticket's status changed.
- `CHANGELOG.md` → Unreleased updated for user-visible changes.
- Comments justify *why*, not *what*. No speculative abstraction.
- UI follows NULogic branding (Montserrat/Open Sans, brand palette).

## 4. Output

Group findings by severity with `file:line`, one-line description, and the rule violated (cite `docs/rbac.md` § or CLAUDE.md section). Use `ReportFindings` if available; otherwise:

```
## PR Review: <target>

### Scope
- Ticket: <id or "none found">
- RBAC alignment: OK | DIVERGES — <what>

### Findings
🔴 Blocking
- path/file.js:42 — <issue> (violates <rule>)

🟠 Should fix
- ...

🟡 Minor / nit
- ...

### Tests
- Gaps: <list or "none">

### Verdict
Ready to merge | Needs changes — <short reason>
```

Only report violations and risks. Omit categories with nothing to say.
