# Practise360 Copilot Review Instructions

Use these instructions for automated code review on every pull request.

## Review Posture

- Prioritize correctness, authorization, security, and missing tests over style nits.
- Use `REVIEW.md` as the checklist.
- Treat `docs/rbac.md` as the source of truth for roles, permissions, scopes and the escalation guard.
- Treat `docs/tracker/TRACKER.md` as the implementation-status source of truth.
- Leave actionable comments tied to specific lines. No generic praise, no unrelated refactor requests.

## Architecture Checks

- npm workspaces monorepo: `apps/web` (Next.js) and `apps/api` (Express on Vercel serverless).
- Authorization is enforced in the API through one `can(user, permission, scope, resource?)` helper. UI hiding is cosmetic only.
- No role-name string comparisons or hardcoded usernames in authorization logic.
- The hardcoded dev password must stay behind `AUTH_MODE=dev`.
- Never log credentials, tokens, auth headers, or secret env values.

## Test Expectations

- Behavior changes need focused tests that fail without the change.
- Authorization changes need negative tests: wrong practice, missing permission, escalation attempt.

## Product Scope

- Apps: Practices, Certification Tracker, AI Tracker. AI Tracker requirements are still open — flag speculative work there.
- UI follows NULogic branding (Montserrat headings, Open Sans body, Lapis Blue primary palette).
