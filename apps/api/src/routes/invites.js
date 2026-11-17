// Public invitation links (docs/rbac.md §4 "Invitations"). No session needed: the token from the email is the proof
// that the person owns that mailbox. Accepting creates the account (or reuses the one with that email), applies what
// the invitation grants — re-checked against the inviter's grants right now — and signs them in.
const express = require("express");
const { connectDb } = require("../db");
const { GroupMembership, Invitation, RoleAssignment, User } = require("../models");
const { loadTree, loadUser } = require("../rbac/load");
const { signToken } = require("../middleware/auth");
const { bad, wrap, str } = require("../lib/http");
const structure = require("../lib/practice-structure");
const inv = require("../lib/invites");

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
  if (!tree.practices.some((p) => p._id === invite.practiceId)) return { status: 410, error: "The practice you were invited to no longer exists." };
  if (!inviter?.isActive || inv.inviteRefusal(inviter, invite, roles, tree)) {
    return { status: 410, error: "Whoever invited you can no longer make this appointment. Ask someone in the practice to invite you again." };
  }
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

/** Find or create the account for the invited email. A concurrent accept may create it first — then use theirs. */
async function accountFor(invite, displayName) {
  const existing = await User.findOne({ email: invite.email }).lean();
  if (existing) return existing;
  const username = await structure.uniqueId(inv.usernameBase(invite.email), async (x) => !!(await User.exists({ username: x })));
  try {
    return (await User.create({ username, displayName: displayName || inv.displayNameFromEmail(invite.email), email: invite.email })).toObject();
  } catch (err) {
    if (err.code === 11000) return User.findOne({ email: invite.email }).lean();
    throw err;
  }
}

router.post(
  "/:token/accept",
  wrap(async (req, res) => {
    const ready = await prepare(req.params.token);
    if (ready.error) return bad(res, ready.error, ready.status);
    const { invite, tree, inviter, roles, account } = ready;
    if (account && !account.isActive) return bad(res, "Your Practise360 account is deactivated. Ask an admin to restore it.", 403);
    const displayName = str(req.body?.displayName, 80, "Name");

    const user = account ?? (await accountFor(invite, displayName));
    const userId = String(user._id);
    const { practiceId, groupId } = invite;
    const actor = { user: inviter, tree };
    const grantedBy = { $setOnInsert: { grantedBy: inviter.id, grantedAt: new Date() } };

    let clash = null;
    if (invite.kind === "manager") {
      clash = await structure.replaceHolder(actor, roles.manager, { type: "practice", id: practiceId }, userId, { keepPrevious: invite.keepPrevious });
    } else {
      // Member and Lead both join the practice as a Practitioner (a Lead must already be in the practice).
      if (!(await structure.isPracticeMember(userId, practiceId))) {
        await RoleAssignment.updateOne({ userId, roleId: roles.practitioner._id, scopeType: "practice", scopeId: practiceId }, grantedBy, { upsert: true });
      }
      if (invite.kind === "lead") {
        clash = await structure.replaceHolder(actor, roles.lead, { type: "group", id: groupId }, userId);
      } else if (groupId && tree.groups.some((g) => g._id === groupId)) {
        // Someone already in a group of this practice stays where they are.
        await GroupMembership.updateOne({ practiceId, userId }, { $setOnInsert: { practiceId, groupId, userId, addedBy: inviter.id, addedAt: new Date() } }, { upsert: true });
      }
    }
    if (clash) return bad(res, clash.error, clash.status);

    await Invitation.updateOne({ _id: invite._id, status: "pending" }, { status: "accepted", acceptedBy: user._id, acceptedAt: new Date() });
    res.json({ token: signToken(user._id), practiceId, username: user.username });
  }),
);

module.exports = router;
