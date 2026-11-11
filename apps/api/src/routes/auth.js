const express = require("express");
const { connectDb } = require("../db");
const { Role, RoleAssignment, User } = require("../models");
const { signToken, isDevAuth } = require("../middleware/auth");

const router = express.Router();
const DEV_PASSWORD = "password";

/** Tells the login page which sign-in options exist, so the dev hint never renders outside AUTH_MODE=dev. */
router.get("/config", async (req, res, next) => {
  try {
    if (!isDevAuth()) return res.json({ devLogin: false, google: { enabled: false } });
    res.json({ devLogin: true, google: { enabled: false }, demoUsers: await demoUsers() });
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
    if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

    await connectDb();
    const user = await User.findOne({ username: String(username).toLowerCase().trim() }).lean();
    // Same message for unknown user and wrong password — don't reveal which usernames exist.
    if (!user || !user.isActive || password !== DEV_PASSWORD) return res.status(401).json({ error: "Invalid username or password" });

    res.json({ token: signToken(user._id) });
  } catch (err) {
    next(err);
  }
});

// Placeholder so the button has a real endpoint to call once Google SSO is wired up.
router.post("/google", (req, res) => {
  res.status(501).json({ error: "Google sign-in is not available yet" });
});

module.exports = router;
