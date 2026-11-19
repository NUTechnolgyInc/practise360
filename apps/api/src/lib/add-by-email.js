// Access control → "Add by email" (docs/rbac.md §4 "Adding someone by email"): give a role to someone who has never
// signed in. The account is created up front with that one role, so their first sign-in already has it. It's an
// ordinary grant to a new account — same escalation guard, same Manager/Lead slot rules — not a deferred invitation,
// so it shows (and can be revoked) on Access control straight away.
const { allScopes, checkGrant } = require("../rbac/engine");
const { describeScope } = require("../rbac/present");
const { sendMail } = require("./mailer");
const { accessEmail } = require("./invite-email");
const inv = require("./invites");

const refused = (status, error) => ({ status, error });

/**
 * Why `actor` can't add `email` with `role` at `scope`, or null. Pure (no DB) so it can be tested: the account lookup
 * and the Manager/Lead slot checks happen in the route. `role` = the Role document or null if the id was unknown.
 */
function addByEmailRefusal({ actor, email, role, scope, tree }) {
  if (!inv.isEmail(email)) return refused(400, "Enter a valid email address");
  if (!inv.domainAllowed(email)) return refused(400, `Only ${process.env.INVITE_EMAIL_DOMAINS} addresses can be added`);
  if (!role) return refused(404, "Role not found");
  const { apps = [], practices = [], groups = [] } = tree;
  if (!allScopes(apps, practices, groups).some((s) => s.type === scope.type && (s.id ?? null) === (scope.id ?? null))) return refused(400, "Unknown scope");
  const verdict = checkGrant(actor, role, scope, tree);
  return verdict.ok ? null : refused(403, verdict.reason);
}

/** "Cert Admin in Certification Tracker", "Super Admin on the platform" — what the email says they'll be. */
function roleAtScope(role, scope, tree) {
  if (scope.type === "platform") return `${role.name} on the platform`;
  return `${role.name} in ${describeScope({ scopeType: scope.type, scopeId: scope.id }, tree)}`;
}

/** Tells the new person they have access. Best effort: a mail failure never undoes the grant. Returns the delivery status. */
async function notifyAccess({ email, inviterName, role, scope, tree }) {
  try {
    const { subject, html, text } = accessEmail({ inviter: inviterName, role: roleAtScope(role, scope, tree), url: `${inv.webUrl()}/login` });
    return (await sendMail({ to: email, subject, html, text })).status;
  } catch (err) {
    console.error(`[add-by-email] notifying ${email} failed:`, err.message);
    return "failed";
  }
}

module.exports = { addByEmailRefusal, roleAtScope, notifyAccess };
