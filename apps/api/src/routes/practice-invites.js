// Practices → invite someone who isn't on Practise360 yet (docs/rbac.md §4 "Invitations"): as a member (optionally
// straight into a group), as the practice's Manager, or as a group's Lead. Sending one needs exactly what the direct
// appointment needs. Registered on the practices router (like the Overview) so `load` resolves :id first.
const mongoose = require("mongoose");
const { Invitation, INVITE_KINDS, User } = require("../models");
const { can, canWithin } = require("../rbac/engine");
const { isDevAuth } = require("../middleware/auth");
const { mailConfigured } = require("../lib/mailer");
const { bad, wrap, usersById, person } = require("../lib/http");
const { addPracticeMember, isPracticeMember, structureRoles } = require("../lib/practice-structure");
const inv = require("../lib/invites");

const canAssignHere = (user, practiceId, tree) => can(user, "practices.roles.assign", { type: "practice", id: practiceId }, undefined, tree);

/**
 * Who sees a practice's open invitations: people who could send one — practices.roles.assign there, or running one
 * of its groups (a Lead, who sees only the invitations into their group).
 */
const canSeeInvites = (user, practiceId, tree) => canAssignHere(user, practiceId, tree) || canWithin(user, "practices.group.update", practiceId, tree);

/** Open invitations of a practice, newest first, with what the caller may do to each. */
async function listInvites(user, practiceId, tree) {
  const [found, roles] = await Promise.all([Invitation.find({ practiceId, status: "pending" }).sort({ createdAt: -1 }).lean(), structureRoles()]);
  // Without practices.roles.assign (a Lead) only the invitations the caller could have sent — into their own group.
  const invites = canAssignHere(user, practiceId, tree) ? found : found.filter((i) => !inv.inviteRefusal(user, i, roles, tree));
  const people = await usersById(invites.map((i) => i.invitedBy));
  return invites.map((i) => {
    const allowed = !inv.inviteRefusal(user, i, roles, tree);
    return {
      id: String(i._id),
      email: i.email,
      kind: i.kind,
      groupId: i.groupId,
      role: inv.roleText(i, tree),
      invitedBy: person(people, i.invitedBy),
      sentAt: i.delivery?.at ?? i.createdAt,
      expiresAt: i.expiresAt,
      expired: inv.isExpired(i),
      delivery: i.delivery?.status ?? null,
      actions: { cancel: allowed, resend: allowed },
    };
  });
}

/**
 * Why an email that already has an account can't be invited, phrased for the picker it was typed into. `canAdd` =
 * the caller could add them directly (a Lead who may only invite can't, so "pick them" would lead nowhere).
 */
async function alreadyOnPractise360(user, email, kind, practice, canAdd = true) {
  if (!user.isActive) return `${email} belongs to a deactivated account`;
  const member = await isPracticeMember(user._id, practice._id);
  if (kind === "member" && member) return `${user.displayName} (${email}) is already in ${practice.name}`;
  if (kind === "member" && !canAdd) return `${user.displayName} already has an account (${email}) — ask the Practice Manager to add them to ${practice.name}`;
  // The Lead picker only lists practice members, so "pick them" wouldn't find someone from outside.
  if (kind === "lead" && !member) return `${user.displayName} (${email}) already has an account — add them to ${practice.name}, then choose them as Lead`;
  return `${user.displayName} already has an account (${email}) — pick them from the list instead`;
}

/**
 * Locally, with no SMTP server, the email only reaches the API console — so the inviter also gets the link to pass on.
 * Never when mail is configured or outside dev auth: then the email is the only way to the link.
 */
const linkForInviter = (token) => (isDevAuth() && !mailConfigured() ? { acceptUrl: inv.acceptUrl(token) } : {});

/**
 * Creates and emails one invitation, replacing any open one for the same person here (and, for Manager/Lead, for the
 * same slot). The caller has already run the guard. Returns { created, token, delivery }.
 */
async function issueInvite(req, invite) {
  const { practiceId, email, kind, groupId } = invite;
  await inv.cancelPending({ practiceId, email }, req.user.id, "Replaced by a newer invitation");
  if (kind === "manager") await inv.cancelPending({ practiceId, kind }, req.user.id, "Someone else was invited as Manager");
  if (kind === "lead") await inv.cancelPending({ practiceId, kind, groupId }, req.user.id, "Someone else was invited as Lead");
  const { token, tokenHash } = inv.newToken();
  const created = await Invitation.create({ ...invite, tokenHash, invitedBy: req.user.id, expiresAt: new Date(Date.now() + inv.INVITE_TTL_MS) });
  const delivery = await inv.deliver(created, token, req.user.displayName, req.tree);
  return { created, token, delivery };
}

/** Runs `fn` over `items` a few at a time: SMTP is slow, but dozens of parallel connections would trip rate limits. */
async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

function inviteRoutes(router, { load, detail }) {
  const loadInvite = wrap(async (req, res, next) => {
    const { inviteId } = req.params;
    const invite = mongoose.isValidObjectId(inviteId) ? await Invitation.findOne({ _id: inviteId, practiceId: req.practice._id, status: "pending" }).lean() : null;
    if (!invite) return bad(res, "Invitation not found", 404);
    const refusal = inv.inviteRefusal(req.user, invite, await structureRoles(), req.tree);
    if (refusal) return bad(res, refusal, 403);
    req.invite = invite;
    next();
  });

  const reply = async (req, res, status, invite, token, delivery) =>
    res.status(status).json({ ...(await detail(req)), invite: { id: String(invite._id), email: invite.email, delivery: delivery.status, ...linkForInviter(token) } });

  /** Invite an email address. A new invitation replaces an open one for the same person here, or for the same Manager/Lead slot. */
  router.post(
    "/:id/invites",
    load,
    wrap(async (req, res) => {
      const b = req.body || {};
      const practiceId = req.practice._id;
      const email = inv.normalizeEmail(b.email);
      if (!inv.isEmail(email)) return bad(res, "Enter a valid email address");
      if (!inv.domainAllowed(email)) return bad(res, `Only ${process.env.INVITE_EMAIL_DOMAINS} addresses can be invited`);
      const kind = b.kind ?? "member";
      if (!INVITE_KINDS.includes(kind)) return bad(res, `kind must be one of ${INVITE_KINDS.join(", ")}`);
      const groupId = kind === "manager" ? null : b.groupId || null;
      if (kind === "lead" && !groupId) return bad(res, "Pick the group they'll lead");
      if (groupId && !req.tree.groups.some((g) => g._id === groupId && g.practiceId === practiceId)) return bad(res, "Unknown group");

      const invite = { email, kind, practiceId, groupId, keepPrevious: b.keepPrevious !== false };
      const roles = await structureRoles();
      const refusal = inv.inviteRefusal(req.user, invite, roles, req.tree);
      if (refusal) return bad(res, refusal, 403);
      const existing = await User.findOne({ email }, "displayName isActive").lean();
      if (existing) return bad(res, await alreadyOnPractise360(existing, email, kind, req.practice, !inv.appointRefusal(req.user, invite, roles, req.tree)), 409);

      const { created, token, delivery } = await issueInvite(req, invite);
      await reply(req, res, 201, created, token, delivery);
    }),
  );

  /**
   * Bulk "add by email" as members (optionally into one group). Every address gets the single invite's checks; someone
   * already on Practise360 is added directly (the same appointment), someone already here is reported, not changed.
   * Replies with the updated practice plus `results`, one per distinct address, in the order given.
   */
  router.post(
    "/:id/invites/bulk",
    load,
    wrap(async (req, res) => {
      const b = req.body || {};
      const practiceId = req.practice._id;
      const emails = inv.parseEmailList(b.emails);
      if (!emails.length) return bad(res, "Enter at least one email address");
      if (emails.length > inv.BULK_INVITE_MAX) return bad(res, `Invite at most ${inv.BULK_INVITE_MAX} people at a time`);
      const groupId = b.groupId || null;
      if (groupId && !req.tree.groups.some((g) => g._id === groupId && g.practiceId === practiceId)) return bad(res, "Unknown group");

      const roles = await structureRoles();
      // Refuse callers who can't add anyone here before saying which addresses already have accounts.
      const refusal = inv.inviteRefusal(req.user, { kind: "member", practiceId, groupId }, roles, req.tree);
      if (refusal) return bad(res, refusal, 403);

      const users = await User.find({ email: { $in: emails.filter(inv.isEmail) } }, "displayName email isActive").lean();
      const accounts = new Map(users.map((u) => [u.email.toLowerCase(), u]));
      const memberIds = new Set();
      await Promise.all(users.map(async (u) => (await isPracticeMember(u._id, practiceId)) && memberIds.add(String(u._id))));
      const plan = inv.planBulkInvite(emails, { actor: req.user, practiceId, practiceName: req.practice.name, groupId, roles, tree: req.tree, accounts, memberIds });

      const results = await inBatches(plan, 5, async ({ email, action, reason, user }) => {
        const name = user?.displayName;
        try {
          if (action === "add") {
            await addPracticeMember(practiceId, user._id, groupId, req.user.id);
            return { email, status: "added", name };
          }
          if (action === "invite") {
            const { created, token, delivery } = await issueInvite(req, { email, kind: "member", practiceId, groupId, keepPrevious: true });
            return { email, status: "invited", inviteId: String(created._id), delivery: delivery.status, ...linkForInviter(token) };
          }
          return { email, status: action === "member" ? "member" : "refused", reason, ...(name && { name }) };
        } catch (err) {
          console.error(`[invites] bulk ${action} for ${email} failed:`, err.message);
          return { email, status: "refused", reason: "Something went wrong — try this one again" };
        }
      });
      res.json({ ...(await detail(req)), results });
    }),
  );

  /** Withdraw an open invitation — the link stops working. */
  router.delete(
    "/:id/invites/:inviteId",
    load,
    loadInvite,
    wrap(async (req, res) => {
      await inv.cancelPending({ _id: req.invite._id }, req.user.id, "Cancelled");
      res.json(await detail(req));
    }),
  );

  /** Send it again with a fresh link and expiry (the old link stops working). The resender becomes the inviter. */
  router.post(
    "/:id/invites/:inviteId/resend",
    load,
    loadInvite,
    wrap(async (req, res) => {
      const last = req.invite.delivery?.at ? new Date(req.invite.delivery.at).getTime() : 0;
      if (req.invite.delivery?.status === "sent" && Date.now() - last < inv.RESEND_COOLDOWN_MS) return bad(res, "It was just sent — wait a minute before sending it again", 429);
      const { token, tokenHash } = inv.newToken();
      const invite = await Invitation.findByIdAndUpdate(req.invite._id, { tokenHash, invitedBy: req.user.id, expiresAt: new Date(Date.now() + inv.INVITE_TTL_MS) }, { returnDocument: "after" }).lean();
      const delivery = await inv.deliver(invite, token, req.user.displayName, req.tree);
      await reply(req, res, 200, invite, token, delivery);
    }),
  );
}

module.exports = { inviteRoutes, listInvites, canSeeInvites, issueInvite, linkForInviter };
