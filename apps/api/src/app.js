require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { authenticate } = require("./middleware/auth");

if (process.env.AUTH_MODE === "dev" && process.env.VERCEL_ENV === "production") {
  // Dev password login must never reach production (CLAUDE.md → Auth).
  throw new Error("AUTH_MODE=dev is not allowed in production");
}

const app = express();
const origins = (process.env.WEB_ORIGIN || "http://localhost:3000").split(",").map((o) => o.trim());
app.use(cors({ origin: origins }));
app.use(express.json());

app.get("/", (req, res) => res.json({ name: "practise360-api" }));
app.get("/health", (req, res) => res.json({ status: "ok" }));

// API docs: the spec only describes routes (no data), and the UI is useless without a valid token.
const { buildSpec, docsHtml } = require("./openapi");
app.get("/openapi.json", (req, res) => res.json(buildSpec()));
app.get("/docs", (req, res) => res.type("html").send(docsHtml("/openapi.json")));

app.use("/auth", require("./routes/auth"));
app.use("/me", require("./routes/me"));
app.use("/rbac", authenticate, require("./routes/rbac-roles"), require("./routes/rbac-users"));
app.use("/ai/usage-reports", authenticate, require("./routes/ai-usage-reports"));

app.use((req, res) => res.status(404).json({ error: "Not found" }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "File is too large (max 4 MB)" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

module.exports = app;
