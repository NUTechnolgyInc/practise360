const jwt = require("jsonwebtoken");
const { connectDb } = require("../db");
const { loadTree, loadUser } = require("../rbac/load");
const { can } = require("../rbac/engine");

const isDevAuth = () => process.env.AUTH_MODE === "dev";

function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: "8h" });
}

/** Resolves the bearer token to req.user (with grants) and req.tree. Auth only yields a userId. */
async function authenticate(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /, "");
    if (!token) return res.status(401).json({ error: "Not signed in" });
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Session expired" });
    }
    await connectDb();
    const [user, tree] = await Promise.all([loadUser(payload.sub), loadTree()]);
    if (!user || !user.isActive) return res.status(401).json({ error: "Account not available" });
    req.user = user;
    req.tree = tree;
    next();
  } catch (err) {
    next(err);
  }
}

/** Route guard: `scopeOf(req)` returns the scope the request touches. */
function requirePermission(permission, scopeOf = () => ({ type: "platform", id: null })) {
  return (req, res, next) => {
    if (can(req.user, permission, scopeOf(req), undefined, req.tree.practices)) return next();
    res.status(403).json({ error: `Missing permission ${permission}` });
  };
}

/** Guard for list endpoints: the user holds one of `permissions` at some scope (results are filtered per scope after). */
function requireAnyScope(...permissions) {
  return (req, res, next) => {
    const ok = req.user.grants.some((g) => g.permissions.includes("*") || permissions.some((p) => g.permissions.includes(p)));
    if (ok) return next();
    res.status(403).json({ error: `Missing one of ${permissions.join(", ")}` });
  };
}

module.exports = { authenticate, requirePermission, requireAnyScope, signToken, isDevAuth };
