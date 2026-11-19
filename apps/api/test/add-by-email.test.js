// Access control → Add by email (docs/rbac.md §4 "Adding someone by email"): the same escalation guard as granting,
// plus email/domain/scope validation, all decided before any account is created.
const test = require("node:test");
const assert = require("node:assert/strict");
const { addByEmailRefusal, roleAtScope } = require("../src/lib/add-by-email");
const { accessEmail } = require("../src/lib/invite-email");
const { APPS, SYSTEM_ROLES } = require("../src/rbac/catalog");
const { DE, treeWith } = require("./fixtures");

const all = Object.fromEntries(SYSTEM_ROLES.map((r) => [r._id, r]));
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: all[roleId].permissions })),
});
const TREE = { apps: APPS, ...treeWith() };
const superAdmin = userWith(["super_admin", "platform"]);
const deManager = userWith(["practice_manager", "practice", DE]);
const PLATFORM = { type: "platform", id: null };
const CERT_APP = { type: "app", id: "cert-tracker" };
const check = (actor, roleId, scope, email = "new.person@example.com") => addByEmailRefusal({ actor, email, role: all[roleId] ?? null, scope, tree: TREE });

test("Super Admin can add anyone with any role, platform roles included", () => {
  assert.equal(check(superAdmin, "super_admin", PLATFORM), null);
  assert.equal(check(superAdmin, "cert_admin", CERT_APP), null);
  assert.equal(check(superAdmin, "ai_admin", { type: "app", id: "ai-tracker" }), null);
  assert.equal(check(superAdmin, "practitioner", { type: "practice", id: DE }), null);
});

test("the escalation guard applies: a Manager can add a Practitioner to their practice but not a Cert Admin", () => {
  assert.equal(check(deManager, "practitioner", { type: "practice", id: DE }), null);
  assert.equal(check(deManager, "cert_admin", CERT_APP)?.status, 403);
  assert.equal(check(deManager, "practitioner", { type: "practice", id: "qa" })?.status, 403);
  assert.equal(check(deManager, "practice_manager", { type: "practice", id: DE })?.status, 403);
});

test("bad email, unknown role and unknown scope are refused", () => {
  assert.equal(check(superAdmin, "cert_admin", CERT_APP, "not-an-email")?.status, 400);
  assert.equal(check(superAdmin, "no_such_role", CERT_APP)?.status, 404);
  assert.equal(check(superAdmin, "practitioner", { type: "practice", id: "nowhere" })?.status, 400);
});

test("INVITE_EMAIL_DOMAINS limits who can be added", () => {
  process.env.INVITE_EMAIL_DOMAINS = "example.com";
  try {
    assert.equal(check(superAdmin, "cert_admin", CERT_APP, "a@example.com"), null);
    assert.equal(check(superAdmin, "cert_admin", CERT_APP, "a@elsewhere.test")?.status, 400);
  } finally {
    delete process.env.INVITE_EMAIL_DOMAINS;
  }
});

test("the access email names the role and scope and links to sign-in, not a token", () => {
  assert.equal(roleAtScope(all.cert_admin, CERT_APP, TREE), "Cert Admin in Certification Tracker");
  assert.equal(roleAtScope(all.super_admin, PLATFORM, TREE), "Super Admin on the platform");
  const mail = accessEmail({ inviter: "Ada <Admin>", role: "Cert Admin in Certification Tracker", url: "http://localhost:3000/login" });
  assert.match(mail.text, /Cert Admin in Certification Tracker/);
  assert.match(mail.text, /\/login/);
  assert.match(mail.html, /Ada &lt;Admin&gt;/);
});
