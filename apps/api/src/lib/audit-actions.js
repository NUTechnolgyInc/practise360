// Every write route the API has, with the name the audit log shows for it. test/audit.test.js fails when a write
// route is added without an entry here, so the log can't silently miss an action.
// Matching runs on the request URL (not Express's req.route) because the error handler runs after the router has
// reset req.baseUrl — a failed request must still be named correctly.

const CATEGORIES = ["Sign-in", "Access control", "Practices", "Invitations", "Contributions", "Certifications", "AI Tracker"];

// [method, pattern, action key, label, category]. Literal segments must come before a :param in the same position.
const ACTIONS = [
  ["POST", "/auth/login", "auth.login", "Signed in with password", "Sign-in"],
  ["POST", "/auth/google", "auth.google", "Signed in with Google", "Sign-in"],
  ["POST", "/invites/:token/accept", "invite.accept", "Accepted an invitation", "Invitations"],

  ["POST", "/rbac/roles", "rbac.role.create", "Created a role", "Access control"],
  ["PATCH", "/rbac/roles/:id", "rbac.role.update", "Edited a role", "Access control"],
  ["DELETE", "/rbac/roles/:id", "rbac.role.delete", "Deleted a role", "Access control"],
  ["POST", "/rbac/assignments", "rbac.assignment.grant", "Granted a role", "Access control"],
  ["DELETE", "/rbac/assignments/:id", "rbac.assignment.revoke", "Revoked a role", "Access control"],

  ["PUT", "/ai/usage-reports/mine/:period", "ai.usage.upload", "Uploaded a Claude usage report", "AI Tracker"],
  ["DELETE", "/ai/usage-reports/mine/:period", "ai.usage.delete", "Deleted a Claude usage report", "AI Tracker"],

  ["POST", "/practices", "practices.practice.create", "Created a practice", "Practices"],
  ["PATCH", "/practices/:id", "practices.practice.update", "Edited a practice", "Practices"],
  ["PUT", "/practices/:id/manager", "practices.manager.set", "Chose a practice Manager", "Practices"],
  ["POST", "/practices/:id/members", "practices.member.add", "Added a practice member", "Practices"],
  ["PUT", "/practices/:id/members/:userId", "practices.member.move", "Moved a member between groups", "Practices"],
  ["PUT", "/practices/:id/overview", "practices.overview.update", "Edited a practice overview", "Practices"],
  ["POST", "/practices/:id/overview/files", "practices.overview.file.upload", "Uploaded a practice file", "Practices"],
  ["DELETE", "/practices/:id/overview/files/:fileId", "practices.overview.file.delete", "Deleted a practice file", "Practices"],
  ["POST", "/practices/:id/groups", "practices.group.create", "Created a group", "Practices"],
  ["PATCH", "/practices/:id/groups/:groupId", "practices.group.update", "Edited a group", "Practices"],
  ["DELETE", "/practices/:id/groups/:groupId", "practices.group.delete", "Deleted a group", "Practices"],
  ["PUT", "/practices/:id/groups/:groupId/lead", "practices.lead.set", "Chose a group Lead", "Practices"],
  ["DELETE", "/practices/:id/groups/:groupId/lead", "practices.lead.remove", "Removed a group Lead", "Practices"],
  ["PUT", "/practices/:id/groups/:groupId/overview", "practices.group.overview.update", "Edited a group overview", "Practices"],
  ["POST", "/practices/:id/groups/:groupId/overview/files", "practices.group.file.upload", "Uploaded a group file", "Practices"],
  ["DELETE", "/practices/:id/groups/:groupId/overview/files/:fileId", "practices.group.file.delete", "Deleted a group file", "Practices"],
  ["POST", "/practices/:id/invites/bulk", "invite.send.bulk", "Invited several people by email", "Invitations"],
  ["POST", "/practices/:id/invites", "invite.send", "Invited someone by email", "Invitations"],
  ["DELETE", "/practices/:id/invites/:inviteId", "invite.cancel", "Withdrew an invitation", "Invitations"],
  ["POST", "/practices/:id/invites/:inviteId/resend", "invite.resend", "Resent an invitation", "Invitations"],

  ["POST", "/contributions", "contribution.create", "Started a contribution", "Contributions"],
  ["PATCH", "/contributions/:id", "contribution.update", "Edited a contribution", "Contributions"],
  ["POST", "/contributions/:id/files", "contribution.file.upload", "Attached a file to a contribution", "Contributions"],
  ["DELETE", "/contributions/:id/files/:fileId", "contribution.file.delete", "Removed a contribution file", "Contributions"],
  ["POST", "/contributions/:id/updates", "contribution.progress", "Logged contribution progress", "Contributions"],
  ["POST", "/contributions/:id/invites/respond", "contribution.invite.respond", "Answered a contribution invite", "Contributions"],
  ["POST", "/contributions/:id/invites", "contribution.invite.send", "Invited a contributor", "Contributions"],
  ["DELETE", "/contributions/:id/invites/:userId", "contribution.invite.cancel", "Withdrew a contributor invite", "Contributions"],
  ["POST", "/contributions/:id/join-requests", "contribution.join.request", "Asked to join a contribution", "Contributions"],
  ["DELETE", "/contributions/:id/join-requests/mine", "contribution.join.withdraw", "Withdrew a join request", "Contributions"],
  ["POST", "/contributions/:id/join-requests/:userId", "contribution.join.respond", "Answered a join request", "Contributions"],
  ["DELETE", "/contributions/:id/contributors/:userId", "contribution.contributor.remove", "Removed a contributor", "Contributions"],
  ["POST", "/contributions/:id/submit", "contribution.submit", "Submitted a contribution for review", "Contributions"],
  ["POST", "/contributions/:id/review", "contribution.review", "Reviewed a contribution", "Contributions"],

  ["POST", "/certifications/catalog", "cert.catalog.create", "Added a catalog entry", "Certifications"],
  ["PATCH", "/certifications/catalog/:id", "cert.catalog.update", "Edited a catalog entry", "Certifications"],
  ["POST", "/certifications/plans", "cert.plan.create", "Planned a certification", "Certifications"],
  ["POST", "/certifications/assignments", "cert.plan.assign", "Recommended or assigned a certification", "Certifications"],
  ["PATCH", "/certifications/plans/:id", "cert.plan.update", "Edited a certification plan", "Certifications"],
  ["POST", "/certifications/plans/:id/accept", "cert.plan.accept", "Accepted a recommended certification", "Certifications"],
  ["POST", "/certifications/plans/:id/decline", "cert.plan.decline", "Declined a recommended certification", "Certifications"],
  ["POST", "/certifications/plans/:id/drop", "cert.plan.drop", "Dropped a certification plan", "Certifications"],
  ["POST", "/certifications/plans/:id/withdraw", "cert.plan.withdraw", "Withdrew a recommendation", "Certifications"],
  ["POST", "/certifications/plans/:id/files", "cert.file.upload", "Uploaded a certificate or receipt", "Certifications"],
  ["DELETE", "/certifications/plans/:id/files/:fileId", "cert.file.delete", "Removed a certificate or receipt", "Certifications"],
  ["POST", "/certifications/plans/:id/submit", "cert.plan.submit", "Submitted a completed certification", "Certifications"],
  ["POST", "/certifications/plans/:id/review", "cert.plan.review", "Reviewed a completed certification", "Certifications"],
].map(([method, pattern, action, label, category]) => {
  const names = [];
  const source = pattern.replace(/:(\w+)/g, (_, name) => {
    names.push(name);
    return "([^/]+)";
  });
  return { method, pattern, action, label, category, names, regexp: new RegExp(`^${source}/?$`) };
});

/** The action a write request performs, with its path params — or null for a URL no route serves. */
function describeRequest(method, url) {
  const path = String(url).split("?")[0];
  for (const a of ACTIONS) {
    if (a.method !== method) continue;
    const m = a.regexp.exec(path);
    if (!m) continue;
    const params = Object.fromEntries(a.names.map((n, i) => [n, safeDecode(m[i + 1])]));
    return { action: a.action, label: a.label, category: a.category, route: a.pattern, params };
  }
  return null;
}

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

module.exports = { ACTIONS, CATEGORIES, describeRequest };
