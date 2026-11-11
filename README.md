# practise360 — Hello World monorepo

npm workspaces monorepo, both apps deployed to Vercel:

```
apps/
  web/   Next.js frontend
  api/   Express backend (Vercel serverless function)
```

## Local dev

Needs Node 20 and a local MongoDB (`mongodb://localhost:27017`).

```bash
npm install
cp apps/api/.env.example apps/api/.env   # set JWT_SECRET to any long random string
npm run seed -w api                      # wipes + seeds RBAC data (AUTH_MODE=dev only)
npm run dev:api   # http://localhost:4000  (API docs: http://localhost:4000/docs)
npm run dev:web   # http://localhost:3000 — sign in as any seeded user, password "password"
npm test -w api   # RBAC engine tests
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
