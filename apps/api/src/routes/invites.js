// Public invitation links (docs/rbac.md §4 "Invitations"). No session needed: the token from the email is the proof
// that the person owns that mailbox. Accepting creates the account (or reuses the one with that email), applies what
// the invitation grants — re-checked against the inviter's grants right now — and signs them in. Signing in with the
// invited email does the same (lib/invite-accept.js), so the link is a shortcut, not the only way in.
const express = require("express");
const { connectDb } = require("../db");
const { Invitation, User } = require("../models");
const { loadTree, loadUser } = require("../rbac/load");
const { signToken } = require("../middleware/auth");
const { bad, wrap, str } = require("../lib/http");
const structure = require("../lib/practice-structure");
const inv = require("../lib/invites");
const { findOrCreateByEmail } = require("../lib/accounts");
const { applyInvitation, staleReason } = require("../lib/invite-accept");

const router = express.Router();

/** The invitation behind `token` if it can still be used, or { status, error } explaining why not. */
async function usable(token) {
  await connectDb();
  const invite = typeof token === "string" && token.length <= 100 ? await Invitation.findOne({ tokenHash: inv.hashToken(token) }).lean() : null;
  if (!invite) return { status: 404, error: "This invitation link isn't valid. Check you copied the whole link from the email." };
  if (invite.status === "accepted") return { status: 410, error: "This invitation has already been used. Sign in with your email instead." };
  if (invite.status === "cancelled") return { status: 410, error: "This invitation was withdrawn. Ask whoever invited you to send a new one." };
  if (inv.isExpired(invite)) return { status: 410, error: "This invitation has expired. Ask whoever invited you to send it again." };
  return { invite };
}

/**
 * Everything accepting needs, or { status, error }: the inviter must still be active and still able to make this
 * appointment, and the practice (and group, for a Lead) must still exist.
 */
async function prepare(token) {
  const found = await usable(token);
  if (found.error) return found;
  const { invite } = found;
  const [tree, inviter, roles, account] = await Promise.all([loadTree(), loadUser(invite.invitedBy), structure.structureRoles(), User.findOne({ email: invite.email }).lean()]);
  const stale = staleReason(invite, { tree, inviter, roles });
  if (stale) return stale;
  return { invite, tree, inviter, roles, account };
}

/** What the join page shows before they accept. */
router.get(
  "/:token",
  wrap(async (req, res) => {
    const ready = await prepare(req.params.token);
    if (ready.error) return bad(res, ready.error, ready.status);
    const { invite, tree, inviter, account } = ready;
    const practice = tree.practices.find((p) => p._id === invite.practiceId);
    res.json({
      email: invite.email,
      kind: invite.kind,
      role: inv.roleText(invite, tree),
      practice: { id: practice._id, name: practice.name },
      invitedBy: inviter.displayName,
      expiresAt: invite.expiresAt,
      hasAccount: !!account,
      suggestedName: account?.displayName ?? inv.displayNameFromEmail(invite.email),
    });
  }),
);

router.post(
  "/:token/accept",
  wrap(async (req, res) => {
    const ready = await prepare(req.params.token);
    if (ready.error) return bad(res, ready.error, ready.status);
    const { invite, tree, inviter, roles, account } = ready;
    if (account && !account.isActive) return bad(res, "Your Practise360 account is deactivated. Ask an admin to restore it.", 403);
    const displayName = str(req.body?.displayName, 80, "Name");

    const user = account ?? (await findOrCreateByEmail(invite.email, displayName)).user;
    const clash = await applyInvitation(invite, String(user._id), { tree, inviter, roles });
    if (clash) return bad(res, clash.error, clash.status);
    res.json({ token: signToken(user._id), practiceId: invite.practiceId, username: user.username });
  }),
);

module.exports = router;
