// Records every write request (POST/PUT/PATCH/DELETE) and sign-in in the audit log — docs/rbac.md §4 "Audit log".
// One app-level middleware instead of a call in every route, so a new route is covered as soon as it has an entry
// in lib/audit-actions.js (the test enforces that). Denied and failed attempts are logged too: they're often the
// interesting ones.
const { connectDb } = require("../db");
const { AuditLog } = require("../models");
const { describeRequest } = require("./audit-actions");

const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Never stored, at any depth: passwords, Google credentials, invite-link tokens and the like.
const SECRET_KEY = /pass|token|credential|secret|authorization|cookie|otp/i;
const MAX_TEXT = 200;
const MAX_ITEMS = 20;
const MAX_DEPTH = 3;
// The response is held until the entry is written (a Vercel function may freeze once it has answered), but a slow
// or unreachable database must not hold it for long.
const WRITE_TIMEOUT_MS = 3000;

/** A copy of `value` safe to keep: no secret keys, no file bytes, long text cut short. */
function sanitize(value, depth = 0) {
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.length > MAX_TEXT ? `${value.slice(0, MAX_TEXT)}…` : value;
  if (Buffer.isBuffer(value) || depth >= MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => sanitize(v, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `…${value.length - MAX_ITEMS} more`] : items;
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY.test(k)) continue;
      const clean = sanitize(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return undefined;
}

const outcomeOf = (status) => (status < 400 ? "success" : status === 401 || status === 403 ? "denied" : "failed");

/** Sign-in and invitation routes have no req.user yet: they name who they signed in with this. */
function noteActor(res, user) {
  res.locals.auditActor = { id: String(user._id ?? user.id), displayName: user.displayName, username: user.username };
}

/**
 * Extra fields for this request's entry, for deletes whose target is gone once they succeed (the log would
 * otherwise only show a dangling id). Merged over the request body's fields.
 */
function noteDetails(res, details) {
  res.locals.auditDetails = { ...res.locals.auditDetails, ...details };
}

/** The entry for a finished request, or null when the URL isn't an audited action. Pure — tested without a DB. */
function buildEntry(req, res) {
  const described = describeRequest(req.method, req.originalUrl);
  if (!described) return null;
  const actor = res.locals.auditActor ?? (req.user ? { id: req.user.id, displayName: req.user.displayName, username: req.user.username } : null);
  const body = res.locals.auditBody;
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return {
    at: new Date(),
    actorId: actor?.id ?? null,
    actorName: actor?.displayName ?? null,
    actorUsername: actor?.username ?? null,
    action: described.action,
    label: described.label,
    category: described.category,
    method: req.method,
    route: described.route,
    params: sanitize(described.params),
    // File uploads send raw bytes as the body; their query (fileName, kind) says what was uploaded.
    details:
      sanitize({
        ...req.query,
        ...(!Buffer.isBuffer(req.body) && req.body && typeof req.body === "object" ? req.body : {}),
        ...res.locals.auditDetails,
      }) ?? {},
    resultId: res.statusCode < 400 && body && typeof body.id === "string" ? body.id : null,
    status: res.statusCode,
    outcome: outcomeOf(res.statusCode),
    error: res.statusCode >= 400 && body && typeof body.error === "string" ? body.error.slice(0, 300) : null,
    ip: forwarded || req.socket?.remoteAddress || undefined,
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300) || undefined,
  };
}

async function write(entry) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), WRITE_TIMEOUT_MS);
  });
  try {
    await Promise.race([connectDb().then(() => AuditLog.create(entry)), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Unit tests that POST to the app set AUDIT_LOG=off, so they neither need a database nor write into the developer's.
// Never honoured on Vercel production: there the log can't be switched off by an env var.
const auditDisabled = () => process.env.AUDIT_LOG === "off" && process.env.VERCEL_ENV !== "production";

/** App-level middleware: holds res.end of a write request until its audit entry is stored. */
function auditTrail(req, res, next) {
  if (!WRITES.has(req.method) || auditDisabled()) return next();
  const json = res.json.bind(res);
  res.json = (body) => {
    res.locals.auditBody = body;
    return json(body);
  };
  const end = res.end;
  let recorded = false;
  res.end = function auditedEnd(...args) {
    if (recorded) return end.apply(this, args);
    recorded = true;
    const entry = buildEntry(req, res);
    if (!entry) return end.apply(this, args);
    // The action already happened: a failed audit write is logged, never turned into an error for the caller.
    write(entry)
      .catch((err) => console.error(`Audit log write failed for ${entry.action}: ${err.message}`))
      .finally(() => end.apply(this, args));
    return this;
  };
  next();
}

module.exports = { auditTrail, buildEntry, sanitize, outcomeOf, noteActor, noteDetails };
