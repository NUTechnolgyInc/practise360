# Deployment Runbook — Practise360

## Shape

Two Vercel projects from the same repo:

| Project | Root Directory | Notes |
|---|---|---|
| `web` | `apps/web` | Next.js, auto-detected |
| `api` | `apps/api` | `api/index.js` exports the Express app; `vercel.json` rewrites all paths to it |

- Production deploys from `main` via the Vercel GitHub integration. PRs run CI only (`.github/workflows/ci.yml`).
- Production URLs: _not recorded yet — add them here once the projects are live._

## Environment variables

| Var | Project | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | web | Base URL of the API |
| `AUTH_MODE` | api | `dev` enables the hardcoded-password login. **Must not be `dev` in production.** |

Values live in Vercel project settings and local `.env` files (gitignored). Never commit them.

## Verify after deploy

```bash
curl -fsS -w '\n%{http_code}\n' <api-url>/
```

Then open the web URL and confirm it loads and can reach the API.

## Rollback

Vercel dashboard → project → Deployments → pick the last good deployment → **Promote to Production**.
