const express = require("express");
const { connectDb } = require("../db");
const { Role, RoleAssignment, User } = require("../models");
const { signToken, isDevAuth } = require("../middleware/auth");
const { clientId, isGoogleEnabled, verifyGoogleCredential } = require("../lib/google-auth");

const router = express.Router();
const DEV_PASSWORD = "password";

/** Tells the login page which sign-in options exist, so the dev hint never renders outside AUTH_MODE=dev. */
router.get("/config", async (req, res, next) => {
  try {
    // The Client ID is public (Google shows it in the browser anyway); serving it here keeps it in one env var.
    const google = isGoogleEnabled() ? { enabled: true, clientId: clientId() } : { enabled: false };
    if (!isDevAuth()) return res.json({ devLogin: false, google });
    res.json({ devLogin: true, google, demoUsers: await demoUsers() });
  } catch (err) {
    next(err);
  }
});

/** Dev only: seeded accounts with a role summary, so the login page can offer one-click demo users. */
async function demoUsers() {
  await connectDb();
  const [users, assignments, roles] = await Promise.all([User.find({ isActive: true }).lean(), RoleAssignment.find().lean(), Role.find().lean()]);
  const roleName = new Map(roles.map((r) => [r._id, r.name]));
  return users.map((u) => ({
    username: u.username,
    displayName: u.displayName,
    roles: [...new Set(assignments.filter((a) => String(a.userId) === String(u._id)).map((a) => roleName.get(a.roleId)))],
  }));
}

router.post("/login", async (req, res, next) => {
  try {
    if (!isDevAuth()) return res.status(404).json({ error: "Password login is disabled" });
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username or email and password are required" });

    await connectDb();
    // People who joined from an invitation sign in with their email; seeded users with their username.
    const login = String(username).toLowerCase().trim();
    const user = await User.findOne(login.includes("@") ? { email: login } : { username: login }).lean();
    // Same message for unknown user and wrong password — don't reveal which usernames exist.
    if (!user || !user.isActive || password !== DEV_PASSWORD) return res.status(401).json({ error: "Invalid username, email or password" });

    res.json({ token: signToken(user._id) });
  } catch (err) {
    next(err);
  }
});

/** Exchanges a Google ID token for a Practise360 session. Only people who already have an account get in. */
router.post("/google", async (req, res, next) => {
  try {
    if (!isGoogleEnabled()) return res.status(501).json({ error: "Google sign-in is not available yet" });
    const { credential } = req.body || {};
    if (!credential || typeof credential !== "string") return res.status(400).json({ error: "Google credential is required" });

    const identity = await verifyGoogleCredential(credential);
    if (identity.error) return res.status(401).json({ error: identity.error });

    await connectDb();
    const user = await User.findOne({ email: identity.email }).lean();
    // No self-sign-up: accounts come from invitations (docs/rbac.md §4), so access always starts from someone who can grant it.
    if (!user) return res.status(403).json({ error: `There's no Practise360 account for ${identity.email}. Ask your Practice Manager to invite you.` });
    if (!user.isActive) return res.status(403).json({ error: "This account is deactivated" });

    res.json({ token: signToken(user._id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
