const express = require("express");
const { authenticate } = require("../middleware/auth");
const { visibleApps } = require("../rbac/engine");
const { describeScope } = require("../rbac/present");

const router = express.Router();

/**
 * The signed-in user, their grants and visible apps. The web app uses grants only to hide/show UI —
 * every API route still enforces on its own.
 */
router.get("/", authenticate, (req, res) => {
  const { user, tree } = req;
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    grants: user.grants.map((g) => ({ ...g, scopeLabel: describeScope(g, tree) })),
    apps: visibleApps(user, tree.apps).map(({ _id, name }) => ({ id: _id, name })),
    practices: tree.practices.map(({ _id, appId, name }) => ({ id: _id, appId, name })),
  });
});

module.exports = router;
