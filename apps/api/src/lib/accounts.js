// Accounts are keyed by email: invitations and Google sign-in both land here, so one person never ends up with two.
const { User } = require("../models");
const { uniqueId } = require("./practice-structure");
const { usernameBase, displayNameFromEmail } = require("./invites");

/**
 * The account for `email`, created with no roles if there is none. `created` tells the caller it is new.
 * `googleOnly` marks an account that proved itself through Google, so the demo password can't open it.
 * A concurrent request may create it first (unique email index) — then theirs is used.
 */
async function findOrCreateByEmail(email, displayName, { googleOnly = false } = {}) {
  const existing = await User.findOne({ email }).lean();
  if (existing) return { user: existing, created: false };
  const username = await uniqueId(usernameBase(email), async (x) => !!(await User.exists({ username: x })));
  try {
    const user = await User.create({ username, displayName: displayName?.trim() || displayNameFromEmail(email), email, googleOnly });
    return { user: user.toObject(), created: true };
  } catch (err) {
    if (err.code === 11000) return { user: await User.findOne({ email }).lean(), created: false };
    throw err;
  }
}

module.exports = { findOrCreateByEmail };
