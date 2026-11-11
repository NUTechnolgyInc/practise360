# Practise360 Pull Request Review Guide

Use this guide for human and Copilot reviews. Claude reviews use the `pr-reviewer` skill, which expands on this.

## Required Review Focus

- Does the change match `docs/rbac.md`? New roles, permissions or scopes need a doc update in the same PR.
- Is every data-touching API route guarded server-side through the single `can()` helper?
- Is scope derived from the resource, not from client-supplied input?
- Does role assignment enforce the escalation guard and `assignableFrom`?
- Does it avoid leaking secrets, tokens, real employee data, or data from practices the caller can't see?
- Does it add or update tests, including negative authorization tests?
- Does it update `docs/tracker/TRACKER.md` and `CHANGELOG.md` where relevant?

## Auth Rules

- The hardcoded `password` login must stay behind `AUTH_MODE=dev`; reject anything that lets it run in production.
- RBAC must not depend on how the user authenticated.

## CI/CD Rules

- Pull requests run checks only.
- Production deploys come from `main` via the Vercel GitHub integration.
- Secrets live in Vercel / GitHub Actions secrets, never in the repo.

## Tracker Rules

- Don't mark a ticket Done unless every acceptance criterion is satisfied by current code.
- Use In Progress with a clear gap when a ticket is partially complete.
- Add a Change Log entry when status changes.
