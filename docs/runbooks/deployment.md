# Deployment Runbook — Practise360

## Shape

Two Vercel projects from the same repo:

| Project | Root Directory | Notes |
|---|---|---|
| `web` | `apps/web` | Next.js, auto-detected |
| `api` | `apps/api` | `api/index.js` exports the Express app; `vercel.json` rewrites all paths to it |

- Production deploys from `main` via the Vercel GitHub integration. PRs run CI only (`.github/workflows/ci.yml`).
- Production URLs: _not recorded yet — add them here once the projects are live._

## Demo deployment (rlal-nu1)

Live since 2026-11-17 on Vercel team **rlal-nu1's projects**, with seeded demo data and demo passwords on (`AUTH_MODE=dev` + `ALLOW_DEMO_LOGIN_IN_PRODUCTION=true`). Anyone with the URL can sign in as any seeded user.

| Project | Root | URL |
|---|---|---|
| `practise360-web` | `apps/web` | https://practise360-web.vercel.app |
| `practise360-api` | `apps/api` | https://practise360-api.vercel.app (Swagger at `/docs`) |

- **Database:** MongoDB Atlas, database `practise360` (seeded with `npm run seed -w api`).
- **Node:** 24.x on Vercel (Vercel has retired 20.x).
- **Not linked to GitHub:** the rlal-nu1 account has no access to `NUTechnolgyInc/practise360`, so pushes don't redeploy. Deploy from the repo root with the CLI signed in to rlal-nu1 (`.vercelignore` keeps local `.env` files out of the upload):

```bash
VERCEL_ORG_ID=team_UfgeFSA47qY2QQNgCJY5wEiy VERCEL_PROJECT_ID=prj_KBfOtIedJFbMZ2TVaXMI0eAOkaB3 vercel deploy --prod --yes
```

```bash
VERCEL_ORG_ID=team_UfgeFSA47qY2QQNgCJY5wEiy VERCEL_PROJECT_ID=prj_Vl1r8Y4JNHhkkVSp6Azx8I8BHlix vercel deploy --prod --yes
```

  The first deploys the API, the second the web app. To get auto-deploys instead, install the Vercel GitHub app for the `NUTechnolgyInc` org and connect both projects to the repo.
- Re-seeding wipes every Practise360 collection in that database: `MONGODB_URI=[REDACTED] AUTH_MODE=dev npm run seed -w api`.

## Environment variables

| Var | Project | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | web | Base URL of the API |
| `AUTH_MODE` | api | `dev` enables the hardcoded-password login. **Must not be `dev` in production** — the API refuses to start if it is on a Vercel production deploy, unless `ALLOW_DEMO_LOGIN_IN_PRODUCTION` is set. |
| `ALLOW_DEMO_LOGIN_IN_PRODUCTION` | api | `true` lets `AUTH_MODE=dev` run on a Vercel production deploy. **Only for a demo on seeded, synthetic data** — anyone with the URL can sign in as any seeded user, Super Admin included. Remove it (and `AUTH_MODE`) before real people or real data use the deployment. |
| `MONGODB_URI` | api | MongoDB connection string (e.g. Atlas) |
| `JWT_SECRET` | api | Signs session tokens. Long random value, different per environment |
| `WEB_ORIGIN` | api | Web URL(s) allowed by CORS, comma-separated |
| `WEB_URL` | api | Web app URL used in invitation links (e.g. `https://practise360.example.com`). Optional — defaults to the first `WEB_ORIGIN` |
| `SMTP_URL` | api | SMTP server for invitation emails, e.g. `smtps://[REDACTED]:[REDACTED]@smtp.example.com:465` (Google Workspace relay, SES, Resend… all work). Unset = emails are only printed to the API log |
| `MAIL_FROM` | api | Sender, e.g. `Practise360 <no-reply@example.com>`. Must be an address the SMTP provider allows |
| `GOOGLE_CLIENT_ID` | api | OAuth Client ID for Google sign-in (Google Cloud → Google Auth Platform → Clients, type Web application). Public, not a secret; the web app gets it from `/auth/config`. Unset = no Google button. Add the web URL to the client's **Authorized JavaScript origins** |
| `GOOGLE_ALLOWED_DOMAINS` | api | Optional comma-separated Workspace domains allowed to sign in with Google (set `nulogic.io` in production). Unset = any verified Google account that has a Practise360 account |
| `INVITE_EMAIL_DOMAINS` | api | Optional comma-separated allow-list of email domains that can be invited (e.g. `nulogic.io`). Unset = any domain |

Values live in Vercel project settings and local `.env` files (gitignored). Never commit them.

## After a release that adds permissions

When `apps/api/src/rbac/catalog.js` gains permissions (e.g. `practices.contribution.*`), run against the target database:

```bash
MONGODB_URI=[REDACTED] npm run sync-roles -w api
```

It adds the new permission keys, inserts missing system roles, and adds brand-new permissions to the system roles whose defaults include them. Super Admin's edits to existing permissions are kept. Until it runs, users won't see the new feature.

It also keeps each system role's scope level, `scopeId` and `assignableFrom` in step with the catalog. When a role changes level (2026-11-12: Practice Lead moved from practice to **group** scope), its permissions are reset to the defaults and assignments left at the old level are removed — practice-level ones become Practitioner so nobody drops out of their practice. The script prints those people: re-appoint them as group Leads from the Practices page.

## Verify after deploy

```bash
curl -fsS -w '\n%{http_code}\n' <api-url>/
```

Then open the web URL and confirm it loads and can reach the API.

## Rollback

Vercel dashboard → project → Deployments → pick the last good deployment → **Promote to Production**.
