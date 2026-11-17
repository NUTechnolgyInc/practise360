// Invitations into a practice (docs/rbac.md §4 "Invitations"). An invitation is a deferred grant: the inviter must be
// able to make the same appointment directly today, and that's checked again — with the inviter's grants at that
// moment — when the link is used, so losing the right to appoint also voids the invitations you sent.
const crypto = require("crypto");
const { Invitation } = require("../models");
const { checkGrant } = require("../rbac/engine");
const { canMoveMember } = require("../rbac/group-access");
const { sendMail } = require("./mailer");
const { inviteEmail } = require("./invite-email");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const isEmail = (v) => typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);

/** INVITE_EMAIL_DOMAINS (comma-separated, e.g. "nulogic.io") limits who can be invited. Unset = any domain. */
const allowedDomains = () =>
  (process.env.INVITE_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
const domainAllowed = (email) => {
  const list = allowedDomains();
  return !list.length || list.includes(email.split("@").pop());
};

const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
/** A fresh link token. Only its hash is stored; the token itself exists in the email (and in the dev response). */
function newToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Base URL of the web app, for links in emails. WEB_URL wins; otherwise the first CORS origin. */
const webUrl = () => (process.env.WEB_URL || (process.env.WEB_ORIGIN || "http://localhost:3000").split(",")[0]).trim().replace(/\/+$/, "");
const acceptUrl = (token) => `${webUrl()}/invite/${token}`;

/** "Jane.Doe+x@nulogic.io" → "jane.doe-x": the base for a new username (made unique by the caller). */
const usernameBase = (email) =>
  email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 40) || "user";

/** "jane.doe_smith@x" → "Jane Doe Smith" — prefilled on the join page, where they can change it. */
const displayNameFromEmail = (email) =>
  email
    .split("@")[0]
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || email;

const practiceScope = (id) => ({ type: "practice", id });
const groupScope = (id) => ({ type: "group", id });

/** What accepting grants, as [role, scope] pairs. A Lead is also a practice member, so they get Practitioner too. */
function grantsFor(invite, roles) {
  const practice = practiceScope(invite.practiceId);
  if (invite.kind === "manager") return [[roles.manager, practice]];
  if (invite.kind === "lead") return [[roles.practitioner, practice], [roles.lead, groupScope(invite.groupId)]];
  return [[roles.practitioner, practice]];
}

/** Why `actor` couldn't make this appointment directly — the same guard as the Practices screen — or null if they can. */
function inviteRefusal(actor, invite, roles, tree) {
  for (const [role, scope] of grantsFor(invite, roles)) {
    if (!role) return "That role doesn't exist";
    const verdict = checkGrant(actor, role, scope, tree);
    if (!verdict.ok) return verdict.reason;
  }
  // Placing a new member straight into a group is a move, which needs its own permission (as when adding someone).
  if (invite.kind === "member" && invite.groupId && !canMoveMember(actor, invite.practiceId, null, invite.groupId, tree)) {
    return "Missing permission practices.members.manage";
  }
  return null;
}

/** What the invitee will be, in words: "Manager of Digital Engineering", "Lead of Fullstack in Digital Engineering"… */
function roleText(invite, tree) {
  const practice = tree.practices.find((p) => p._id === invite.practiceId)?.name ?? invite.practiceId;
  const group = invite.groupId ? tree.groups.find((g) => g._id === invite.groupId)?.name : null;
  if (invite.kind === "manager") return `Manager of ${practice}`;
  if (invite.kind === "lead") return `Lead of ${group ?? "a group"} in ${practice}`;
  return group ? `a member of ${practice} (${group})` : `a member of ${practice}`;
}

const isExpired = (invite, now = Date.now()) => new Date(invite.expiresAt).getTime() <= now;

/** Emails the link and records how it went on the invitation. Returns the delivery ({ status, error? }). */
async function deliver(invite, token, inviterName, tree) {
  const { subject, html, text } = inviteEmail({ inviter: inviterName, role: roleText(invite, tree), url: acceptUrl(token), expiresAt: invite.expiresAt });
  const result = await sendMail({ to: invite.email, subject, html, text });
  const delivery = { status: result.status, error: result.error, at: new Date() };
  await Invitation.updateOne({ _id: invite._id }, { delivery });
  return delivery;
}

/** Most addresses one bulk invite takes — keeps a request (and its emails) inside a serverless function's time limit. */
const BULK_INVITE_MAX = 50;

/**
 * A list of addresses from an array or a "a@x, b@x; c@x" string: trimmed, lower-cased, blanks and repeats dropped,
 * order kept. Doesn't validate — invalid ones come back so the caller can say which.
 */
function parseEmailList(input) {
  const parts = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[,;\s]+/) : [];
  return [...new Set(parts.map(normalizeEmail).filter(Boolean))];
}

/**
 * What a bulk member invite does with each address (rbac.md §4 "Invitations"), decided without the DB so it can be
 * tested. Each address gets the same checks as a single invite or a direct add: valid, an allowed domain, and the
 * escalation guard (which doesn't depend on the address, but is asked per address so no path skips it).
 * `accounts` = Map(email → { _id, displayName, isActive }); `memberIds` = Set of user ids already in the practice.
 * Returns [{ email, action: "invite" | "add" | "member" | "refused", reason?, user? }] in input order.
 */
function planBulkInvite(emails, { actor, practiceId, practiceName, groupId = null, roles, tree, accounts = new Map(), memberIds = new Set() }) {
  return emails.map((email) => {
    if (!isEmail(email)) return { email, action: "refused", reason: "Not a valid email address" };
    if (!domainAllowed(email)) return { email, action: "refused", reason: `Only ${allowedDomains().join(", ")} addresses can be invited` };
    const refusal = inviteRefusal(actor, { email, kind: "member", practiceId, groupId }, roles, tree);
    if (refusal) return { email, action: "refused", reason: refusal };
    const user = accounts.get(email);
    if (!user) return { email, action: "invite" };
    if (!user.isActive) return { email, action: "refused", reason: "Belongs to a deactivated account", user };
    if (memberIds.has(String(user._id))) return { email, action: "member", reason: `${user.displayName} is already in ${practiceName ?? "this practice"}`, user };
    // Already on Practise360: an invitation would only be refused ("pick them instead"), so add them directly — the same
    // appointment, checked by the same guard above.
    return { email, action: "add", user };
  });
}

/** Cancels every pending invitation matching `filter` (e.g. the Manager slot was filled another way). */
const cancelPending = (filter, actorId, reason) =>
  Invitation.updateMany({ ...filter, status: "pending" }, { status: "cancelled", cancelledBy: actorId, cancelledAt: new Date(), cancelReason: reason });

module.exports = {
  INVITE_TTL_MS,
  RESEND_COOLDOWN_MS,
  normalizeEmail,
  isEmail,
  domainAllowed,
  hashToken,
  newToken,
  acceptUrl,
  usernameBase,
  displayNameFromEmail,
  grantsFor,
  inviteRefusal,
  roleText,
  isExpired,
  deliver,
  cancelPending,
  BULK_INVITE_MAX,
  parseEmailList,
  planBulkInvite,
};
