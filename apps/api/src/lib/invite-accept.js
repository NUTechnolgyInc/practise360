// Applying an invitation (docs/rbac.md §4 "Invitations"): through its link, or — since 2026-11-18, owner's request —
// by signing in with the invited email, so nobody has to pass a link on. Either way the grant is re-checked against
// the inviter's grants right now (it's a deferred grant), so an inviter who lost the right can't still let people in.
const { GroupMembership, Invitation, RoleAssignment } = require("../models");
const { loadTree, loadUser } = require("../rbac/load");
const structure = require("./practice-structure");
const inv = require("./invites");

/**
 * Why `invite` can't be applied any more ({ status, error }), or null. `tree`, `inviter`, `roles` = current state.
 * Wording is for the person who was invited.
 */
function staleReason(invite, { tree, inviter, roles }) {
  if (!tree.practices.some((p) => p._id === invite.practiceId)) return { status: 410, error: "The practice you were invited to no longer exists." };
  if (!inviter?.isActive || inv.inviteRefusal(inviter, invite, roles, tree)) {
    return { status: 410, error: "Whoever invited you can no longer make this appointment. Ask someone in the practice to invite you again." };
  }
  return null;
}

/**
 * Grants what `invite` grants to the account `userId` and marks it accepted. Returns null, or { status, error } when
 * the slot it was for (Manager, Lead) can't be filled — then the invitation stays open.
 */
async function applyInvitation(invite, userId, { tree, inviter, roles }) {
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
  if (clash) return clash;
  await Invitation.updateOne({ _id: invite._id, status: "pending" }, { status: "accepted", acceptedBy: userId, acceptedAt: new Date() });
  return null;
}

/**
 * On sign-in: applies every open, unexpired invitation for the account's email. Signing in proves the email the same
 * way the link does (Google verifies it; dev login is dev only). One that can't be applied any more is left as it is
 * and the rest still go through. Returns the number applied.
 */
async function applyPendingInvitations(user) {
  if (!user?.email || !user.isActive) return 0;
  const invites = await Invitation.find({ email: user.email.toLowerCase(), status: "pending", expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean();
  if (!invites.length) return 0;
  const [tree, roles] = await Promise.all([loadTree(), structure.structureRoles()]);
  let applied = 0;
  for (const invite of invites) {
    try {
      const inviter = await loadUser(invite.invitedBy);
      if (staleReason(invite, { tree, inviter, roles })) continue;
      if (!(await applyInvitation(invite, String(user._id), { tree, inviter, roles }))) applied += 1;
    } catch (err) {
      console.error(`[invites] applying invitation ${invite._id} on sign-in failed:`, err.message);
    }
  }
  return applied;
}

/** Is there an open, unexpired invitation for this email? */
const hasOpenInvitation = (email) => Invitation.exists({ email: String(email).toLowerCase(), status: "pending", expiresAt: { $gt: new Date() } });

module.exports = { staleReason, applyInvitation, applyPendingInvitations, hasOpenInvitation };
