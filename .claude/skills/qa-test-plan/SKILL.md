---
name: qa-test-plan
description: Draft a test plan (test case scenarios) for a named Practise360 feature or ticket, grounded in docs/rbac.md and the tracker, and stop for the user's approval. Use when asked to "write test cases for X", "plan QA for this feature", "what should we test for <ticket>", or before any QA execution pass. Pairs with `qa-test-run`, which executes an approved plan.
---

# Practise360 QA Test Plan

Produce a reviewable test-case document — not a live run. This skill only reads code/docs and writes a plan. Execution happens in `qa-test-run`, only after approval.

## 1. Scope the feature

1. A ticket ID → read its row and notes in `docs/tracker/TRACKER.md`.
2. A feature description → map it to `docs/rbac.md` sections and the actual code (routes, pages) so the plan tests what's built.
3. A PR/branch → read the diff and scope the plan to that surface.

If the ticket is flagged 🟡/🔴, include a scenario that probes the known gap. If scope is still ambiguous, ask.

## 2. Write scenarios

Cover:
- **Happy path** per role that should succeed.
- **Role matrix** — for any permission-gated action, test it as each relevant seed user (see `docs/rbac.md` §7): the role that should succeed, a role one level below, a same-level role in a **different practice**, and a user with no access. RBAC bugs live here.
- **Escalation attempts** — assigning a role with more permissions than the actor has; a Practice Manager trying to appoint a Manager; direct API calls bypassing hidden UI.
- **Edge cases** — user in multiple practices, custom roles, empty states, deactivated users.
- **Negative cases** — invalid input, unknown IDs, unauthenticated requests.
- **Regression** — adjacent screens/routes this change could break, app launcher visibility.

Each scenario: ID, title, preconditions (which seed user), numbered steps, expected result (cite `docs/rbac.md` §), priority (P0 blocks ship / P1 should fix / P2 nice to have). Keep them black-box — drivable via `curl` or the browser tool.

## 3. Save as a draft

Write `docs/qa/plans/<feature-slug>-<YYYY-MM-DD>.md`:

```markdown
# Test Plan — <feature/ticket> — <YYYY-MM-DD>

**Status**: DRAFT — awaiting approval
**Ticket(s)**: <id(s) or "none">
**Scope**: what this covers and deliberately excludes
**References**: docs/rbac.md §..., tracker notes

## Scenarios

### <ID> — <title> (P0/P1/P2)
- Preconditions: logged in as `<seed user>` ...
- Steps:
  1. ...
- Expected: ... (cite source)

## Known Gaps to Probe
- <ticket> — <tracker note> — scenario <ID> targets this

## Out of Scope
- ...
```

## 4. Stop and ask

Don't execute anything. End with the file path, a count of scenarios by priority, and: "Approve this plan to run it with `qa-test-run`, or tell me what to change."
