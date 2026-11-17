// Invitations (docs/rbac.md §4 "Invitations"): who may invite whom as what, and the email itself. No DB needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const inv = require("../src/lib/invites");
const { inviteEmail } = require("../src/lib/invite-email");
const { SYSTEM_ROLES } = require("../src/rbac/catalog");
const { CUSTOM_ROLES } = require("../src/seed/data");
const { DE, FULLSTACK, QA_AUTO, treeWith } = require("./fixtures");

const all = Object.fromEntries([...SYSTEM_ROLES, ...CUSTOM_ROLES].map((r) => [r._id, r]));
const roles = { manager: all.practice_manager, lead: all.practice_lead, practitioner: all.practitioner };
const userWith = (...assignments) => ({
  id: "u1",
  grants: assignments.map(([roleId, scopeType, scopeId = null]) => ({ scopeType, scopeId, permissions: all[roleId].permissions })),
});
const TREE = treeWith();
const refusal = (actor, invite) => inv.inviteRefusal(actor, { practiceId: DE, groupId: null, ...invite }, roles, TREE);

const practicesAdmin = userWith(["practices_admin", "app", "practices"]);
const deManager = userWith(["practice_manager", "practice", DE]);
const deLead = userWith(["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]);
const coordinator = userWith(["de_practice_coordinator", "practice", DE]);

test("inviting needs exactly what the direct appointment needs", () => {
  // Manager: only from app scope (Practices Admin), as when choosing one directly.
  assert.equal(refusal(practicesAdmin, { kind: "manager" }), null);
  assert.match(refusal(deManager, { kind: "manager" }), /practices\.roles\.assign/);
  // Members and Leads: the practice's Manager and Practices Admin.
  for (const actor of [practicesAdmin, deManager]) {
    assert.equal(refusal(actor, { kind: "member" }), null);
    assert.equal(refusal(actor, { kind: "member", groupId: FULLSTACK }), null);
    assert.equal(refusal(actor, { kind: "lead", groupId: FULLSTACK }), null);
  }
  // A Lead can't bring people in; a Manager can't invite into another practice.
  assert.ok(refusal(deLead, { kind: "member" }));
  assert.ok(inv.inviteRefusal(deManager, { kind: "member", practiceId: "qa", groupId: null }, roles, TREE));
  assert.ok(inv.inviteRefusal(deManager, { kind: "lead", practiceId: "qa", groupId: QA_AUTO }, roles, TREE));
});

test("placing an invited member into a group also needs practices.members.manage", () => {
  const assignOnly = { id: "u2", grants: [{ scopeType: "practice", scopeId: DE, permissions: [...roles.practitioner.permissions, "practices.roles.assign"] }] };
  assert.equal(refusal(assignOnly, { kind: "member" }), null);
  assert.match(refusal(assignOnly, { kind: "member", groupId: FULLSTACK }), /practices\.members\.manage/);
  // The coordinator custom role moves members but can't grant Practitioner — so no invites either way.
  assert.ok(refusal(coordinator, { kind: "member" }));
});

test("a Lead invitation grants Practitioner and the group's Lead role", () => {
  const grants = inv.grantsFor({ kind: "lead", practiceId: DE, groupId: FULLSTACK }, roles);
  assert.deepEqual(grants.map(([r, s]) => [r._id, s.type, s.id]), [["practitioner", "practice", DE], ["practice_lead", "group", FULLSTACK]]);
  assert.deepEqual(inv.grantsFor({ kind: "manager", practiceId: DE }, roles).map(([r]) => r._id), ["practice_manager"]);
});

test("role text names the practice and group", () => {
  assert.equal(inv.roleText({ kind: "manager", practiceId: DE }, TREE), "Manager of Digital Engineering");
  assert.equal(inv.roleText({ kind: "lead", practiceId: DE, groupId: FULLSTACK }, TREE), "Lead of Fullstack in Digital Engineering");
  assert.equal(inv.roleText({ kind: "member", practiceId: DE, groupId: FULLSTACK }, TREE), "a member of Digital Engineering (Fullstack)");
  assert.equal(inv.roleText({ kind: "member", practiceId: DE, groupId: null }, TREE), "a member of Digital Engineering");
});

test("emails are normalised and validated; the domain allow-list is optional", () => {
  assert.equal(inv.normalizeEmail("  Jane.Doe@Example.COM "), "jane.doe@example.com");
  assert.ok(inv.isEmail("jane.doe@example.com"));
  for (const bad of ["", "jane", "jane@", "@example.com", "jane doe@example.com", `${"a".repeat(250)}@example.com`]) assert.ok(!inv.isEmail(bad), bad);

  const before = process.env.INVITE_EMAIL_DOMAINS;
  try {
    delete process.env.INVITE_EMAIL_DOMAINS;
    assert.ok(inv.domainAllowed("x@anything.org"));
    process.env.INVITE_EMAIL_DOMAINS = "example.com, @example.org";
    assert.ok(inv.domainAllowed("x@example.com"));
    assert.ok(inv.domainAllowed("x@example.org"));
    assert.ok(!inv.domainAllowed("x@evil-example.com"));
  } finally {
    if (before === undefined) delete process.env.INVITE_EMAIL_DOMAINS;
    else process.env.INVITE_EMAIL_DOMAINS = before;
  }
});

test("usernames and display names come from the email's local part", () => {
  assert.equal(inv.usernameBase("Jane.Doe+work@example.com"), "jane.doe-work");
  assert.equal(inv.usernameBase("...@example.com"), "user");
  assert.equal(inv.displayNameFromEmail("jane.doe_smith@example.com"), "Jane Doe Smith");
});

test("tokens are random and only their hash is stored", () => {
  const a = inv.newToken();
  const b = inv.newToken();
  assert.notEqual(a.token, b.token);
  assert.equal(a.tokenHash, inv.hashToken(a.token));
  assert.ok(!a.tokenHash.includes(a.token));
  assert.ok(a.token.length >= 40);
});

test("the invitation email links to the join page and escapes names", () => {
  const before = process.env.WEB_URL;
  process.env.WEB_URL = "https://portal.example.com/";
  try {
    const url = inv.acceptUrl("tok123");
    assert.equal(url, "https://portal.example.com/invite/tok123");
    const mail = inviteEmail({ inviter: "<b>Mallory</b>", role: "Manager of Digital Engineering", url, expiresAt: new Date("2026-11-20T00:00:00Z") });
    assert.equal(mail.subject, "<b>Mallory</b> invited you to Practise360");
    assert.ok(mail.html.includes(`href="${url}"`));
    assert.ok(mail.html.includes("&lt;b&gt;Mallory&lt;/b&gt;"));
    assert.ok(!mail.html.includes("<b>Mallory</b>"));
    assert.ok(mail.text.includes(url) && mail.text.includes("20 November 2026"));
  } finally {
    if (before === undefined) delete process.env.WEB_URL;
    else process.env.WEB_URL = before;
  }
});

test("an invitation expires at its expiry time", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  assert.ok(!inv.isExpired({ expiresAt: new Date(now + 1000) }, now));
  assert.ok(inv.isExpired({ expiresAt: new Date(now) }, now));
});
