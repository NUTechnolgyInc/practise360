# practise360 — Hello World monorepo

npm workspaces monorepo, both apps deployed to Vercel:

```
apps/
  web/   Next.js frontend
  api/   Express backend (Vercel serverless function)
```

## Local dev

```bash
npm install
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:4000
```

## Deploy (Vercel)

Create two Vercel projects from the same repo:

| Project | Root Directory | Notes |
|---------|----------------|-------|
| web     | `apps/web`     | Next.js auto-detected |
| api     | `apps/api`     | `api/index.js` exports the Express app; `vercel.json` routes all paths to it |

## Backend layout
- `src/app.js` — Express app (no `listen`, so it runs as a serverless function)
- `src/local.js` — local dev server
- `api/index.js` — Vercel function entry
