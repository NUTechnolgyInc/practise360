require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { authenticate, requirePermission } = require("./middleware/auth");
const { auditTrail } = require("./lib/audit");

// Dev password login must never reach a real production (CLAUDE.md → Auth). A demo deployment on seeded,
// synthetic data can opt in explicitly, so the guard can't be switched off by setting AUTH_MODE alone.
if (process.env.AUTH_MODE === "dev" && process.env.VERCEL_ENV === "production" && process.env.ALLOW_DEMO_LOGIN_IN_PRODUCTION !== "true") {
  throw new Error("AUTH_MODE=dev is not allowed in production (set ALLOW_DEMO_LOGIN_IN_PRODUCTION=true only for a demo on seeded data)");
}

const app = express();
const origins = (process.env.WEB_ORIGIN || "http://localhost:3000").split(",").map((o) => o.trim());
app.use(cors({ origin: origins }));
// 1 MB: contribution descriptions converted from .docx can pass the 100 KB default. File-upload routes read
// the raw body themselves, so an uploaded .json attachment must not be parsed here.
const isFileUpload = (req) => /\/files(\?|$)/.test(req.url);
app.use(express.json({ limit: "1mb", type: (req) => !isFileUpload(req) && /json/.test(req.headers["content-type"] || "") }));

// Reads may sit in the browser's private cache but are revalidated every time: Express's ETag turns an unchanged
// response into a bodyless 304. Vary keeps one person's copy from answering another's request in a shared browser.
// Routes that must never be stored (file downloads) set their own no-store after this.
app.use((req, res, next) => {
  if (req.method === "GET") {
    res.set("Cache-Control", "private, no-cache");
    res.vary("Authorization");
  }
  next();
});

// Before every router: each write request and sign-in is recorded, including the refused ones.
app.use(auditTrail);

app.get("/", (req, res) => res.json({ name: "practise360-api" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// API docs: the spec only describes routes (no data), and the UI is useless without a valid token.
const { buildSpec, docsHtml } = require("./openapi");
app.get("/openapi.json", (req, res) => res.json(buildSpec()));
app.get("/docs", (req, res) => res.type("html").send(docsHtml("/openapi.json")));

app.use("/auth", require("./routes/auth"));
app.use("/me", require("./routes/me"));
// Public: the link in an invitation email is the credential (routes/invites.js).
app.use("/invites", require("./routes/invites"));
app.use("/rbac", authenticate, require("./routes/rbac-roles"), require("./routes/rbac-users"));
app.use("/ai/usage-reports", authenticate, require("./routes/ai-usage-reports"));
app.use("/practices", authenticate, require("./routes/practices"));
app.use("/contributions", authenticate, require("./routes/contributions"));
app.use("/certifications", authenticate, require("./routes/certifications"));
app.use("/people", authenticate, require("./routes/people"));
app.use("/audit-log", authenticate, requirePermission("platform.audit.view"), require("./routes/audit-log"));

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "Too large (files max 4 MB, text max 1 MB)" });
  // A truncated or invalid JSON body is the caller's mistake, not a server fault — don't log it as a 500.
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Request body isn't valid JSON" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
