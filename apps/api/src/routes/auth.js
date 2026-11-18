const express = require("express");
const { connectDb } = require("../db");
const { Role, RoleAssignment, User } = require("../models");
const { signToken, isDevAuth } = require("../middleware/auth");
const { clientId, isGoogleEnabled, verifyGoogleCredential } = require("../lib/google-auth");
const { findOrCreateByEmail } = require("../lib/accounts");
const { noteActor } = require("../lib/audit");
const { applyPendingInvitations, hasOpenInvitation } = require("../lib/invite-accept");

const router = express.Router();
const DEV_PASSWORD = "password";

/**
 * Signing in with an invited email accepts its open invitations (owner's request 2026-11-18), so an invited person
 * gets access without the link. A failure here never blocks the sign-in itself.
 */
async function joinInvitedPractices(user) {
  try {
    await applyPendingInvitations(user);
  } catch (err) {
    console.error("[auth] applying invitations on sign-in failed:", err.message);
  }
}

/**
 * Tells the login page which sign-in options exist, so the dev hint never renders outside AUTH_MODE=dev.
 * The one-click demo-user list is a separate opt-in (DEMO_USERS_ENABLED=true): a deployment can keep the password
 * login without advertising every account's username and roles to anyone who opens the login page.
 */
router.get("/config", async (req, res, next) => {
  try {
    // The Client ID is public (Google shows it in the browser anyway); serving it here keeps it in one env var.
    const google = isGoogleEnabled() ? { enabled: true, clientId: clientId() } : { enabled: false };
    if (!isDevAuth()) return res.json({ devLogin: false, google });
    if (process.env.DEMO_USERS_ENABLED !== "true") return res.json({ devLogin: true, google });
    res.json({ devLogin: true, google, demoUsers: await demoUsers() });
  } catch (err) {
    next(err);
  }
});

/** Dev only: seeded accounts with a role summary, so the login page can offer one-click demo users. */
async function demoUsers() {
  await connectDb();
  const [users, assignments, roles] = await Promise.all([User.find({ isActive: true, googleOnly: { $ne: true } }).lean(), RoleAssignment.find().lean(), Role.find().lean()]);
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
    let user = await User.findOne(login.includes("@") ? { email: login } : { username: login }).lean();
    // Someone invited by email has no account until they join. Without Google sign-in (local dev) the dev login is the
    // only way in, so their first sign-in creates the account. With Google on (the demo), they sign in with Google —
    // the shared dev password must not claim an invited address for someone else.
    if (!user && login.includes("@") && password === DEV_PASSWORD && !isGoogleEnabled() && (await hasOpenInvitation(login))) {
      user = (await findOrCreateByEmail(login)).user;
    }
    // Same message for unknown user and wrong password — don't reveal which usernames exist.
    if (!user || !user.isActive || user.googleOnly || password !== DEV_PASSWORD) return res.status(401).json({ error: "Invalid username, email or password" });

    noteActor(res, user);
    await joinInvitedPractices(user);
    res.json({ token: signToken(user._id) });
  } catch (err) {
    next(err);
  }
});

/** Exchanges a Google ID token for a Practise360 session, creating the account on first sign-in. */
router.post("/google", async (req, res, next) => {
  try {
    if (!isGoogleEnabled()) return res.status(501).json({ error: "Google sign-in is not available yet" });
    const { credential } = req.body || {};
    if (!credential || typeof credential !== "string") return res.status(400).json({ error: "Google credential is required" });

    const identity = await verifyGoogleCredential(credential);
    if (identity.error) return res.status(401).json({ error: identity.error });

    await connectDb();
    // First Google sign-in creates the account with no roles (owner decision 2026-11-17, docs/rbac.md "Auth"):
    // it opens no app until someone grants a role, and the home page tells them so.
    const { user, created } = await findOrCreateByEmail(identity.email, identity.name, { googleOnly: true });
    noteActor(res, user);
    if (!user.isActive) return res.status(403).json({ error: "This account is deactivated" });

    await joinInvitedPractices(user);
    res.json({ token: signToken(user._id), created });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
