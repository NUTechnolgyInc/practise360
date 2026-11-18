// INV-API — inviting people who aren't on Practise360 yet (docs/rbac.md §4 "Invitations"): who may invite whom as
// what, the public join link, and what accepting grants. The e2e API has no SMTP_URL, so it returns the join link.
const { test, expect, unique } = require("../../support/fixtures");
const { removeInvited, removePractice } = require("../../support/db");

const DE = "digital-engineering";
const MOBILE = "digital-engineering-mobile-app";
const FULLSTACK = "digital-engineering-fullstack";

const used = [];
/** A fresh, never-seen email for this run (cleaned up after the file). */
const newEmail = (label) => {
  const email = `${label}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@example.org`;
  used.push(email);
  return email;
};
const tokenOf = (invite) => invite.acceptUrl.split("/invite/")[1];

test.afterAll(async () => removeInvited(used));

test.describe("Invitations — who may invite", () => {
  test("[INV-API-01] invitations follow the escalation guard of the direct appointment", async ({ as }) => {
    const manager = await as("de.manager");
    const lead = await as("de.lead");
    const dev = await as("de.dev1");
    // A Manager can't appoint a Manager, so can't invite one either. A Lead invites members into their own group only
    // (owner's decision 2026-11-18); practitioners can't bring anyone in.
    expect((await manager.post(`/practices/${DE}/invites`, { email: newEmail("x"), kind: "manager" })).status()).toBe(403);
    expect((await lead.post(`/practices/${DE}/invites`, { email: newEmail("x") })).status()).toBe(403);
    expect((await lead.post(`/practices/${DE}/invites`, { email: newEmail("x"), groupId: "digital-engineering-devops" })).status()).toBe(403);
    expect((await lead.post(`/practices/${DE}/invites`, { email: newEmail("x"), groupId: "digital-engineering-fullstack" })).status()).toBe(201);
    expect((await dev.post(`/practices/${DE}/invites`, { email: newEmail("x") })).status()).toBe(403);
    // Another practice isn't visible to the DE Manager.
    expect((await manager.post("/practices/qa/invites", { email: newEmail("x") })).status()).toBe(404);
    // Only people who could invite see the open invitations.
    expect(await manager.json(`/practices/${DE}`)).toHaveProperty("invites");
    expect(await dev.json(`/practices/${DE}`)).not.toHaveProperty("invites");
  });

  test("[INV-API-02] bad input is refused, and an email that already has an account must be picked instead", async ({ as }) => {
    const manager = await as("de.manager");
    const post = (body) => manager.post(`/practices/${DE}/invites`, body);
    expect((await post({ email: "not-an-email" })).status()).toBe(400);
    expect((await post({ email: newEmail("x"), kind: "owner" })).status()).toBe(400);
    expect((await post({ email: newEmail("x"), kind: "lead" })).status()).toBe(400); // which group?
    expect((await post({ email: newEmail("x"), groupId: "qa-automation" })).status()).toBe(400); // not this practice's group
    // The message fits the picker: already a member, or (Lead picker lists members only) add them first.
    const member = await post({ email: "DE.Dev1@Example.com" });
    expect(member.status()).toBe(409);
    expect((await member.json()).error).toBe("Riley Patel (de.dev1@example.com) is already in Digital Engineering");
    const outsider = await post({ email: "qa.tester1@example.com", kind: "lead", groupId: "digital-engineering-mobile-app" });
    expect(outsider.status()).toBe(409);
    expect((await outsider.json()).error).toContain("add them to Digital Engineering, then choose them as Lead");
  });
});

test.describe("Invitations — joining", () => {
  test("[INV-API-03] a member invitation: the link shows the role, accepting creates the account in that group", async ({ as }) => {
    const email = newEmail("nova");
    const res = await (await as("de.manager")).post(`/practices/${DE}/invites`, { email, kind: "member", groupId: FULLSTACK });
    expect(res.status()).toBe(201);
    const { invite, invites } = await res.json();
    expect(invite).toMatchObject({ email, delivery: "logged" });
    expect(invites.find((i) => i.email === email)).toMatchObject({ kind: "member", groupId: FULLSTACK, role: "a member of Digital Engineering (Fullstack)", expired: false });

    const anon = await as();
    const details = await anon.json(`/invites/${tokenOf(invite)}`);
    expect(details).toMatchObject({ email, kind: "member", invitedBy: "Morgan Reyes", hasAccount: false, practice: { id: DE, name: "Digital Engineering" } });

    const accepted = await anon.post(`/invites/${tokenOf(invite)}/accept`, { displayName: "Nova Tester" });
    expect(accepted.status()).toBe(200);
    expect(await accepted.json()).toMatchObject({ practiceId: DE });
    // The link works once.
    expect((await anon.post(`/invites/${tokenOf(invite)}/accept`, {})).status()).toBe(410);
    expect((await anon.get(`/invites/${tokenOf(invite)}`)).status()).toBe(410);

    // They sign in with their email and the dev password, and sit in Fullstack as a Practitioner.
    const login = await anon.post("/auth/login", { username: email.toUpperCase(), password: "password" });
    expect(login.status()).toBe(200);
    const de = await (await as("de.manager")).json(`/practices/${DE}`);
    expect(de.members.find((m) => m.email === email)).toMatchObject({ displayName: "Nova Tester", roles: ["Practitioner"], groupId: FULLSTACK });
    expect(de.invites.some((i) => i.email === email)).toBe(false);
  });

  test("[INV-API-04] a Lead invitation: they join the practice, lead the group and sit in it", async ({ as }) => {
    const email = newEmail("kai");
    const { invite } = await (await (await as("de.manager")).post(`/practices/${DE}/invites`, { email, kind: "lead", groupId: MOBILE })).json();
    expect((await (await as()).post(`/invites/${tokenOf(invite)}/accept`, { displayName: "Kai Tester" })).status()).toBe(200);
    const de = await (await as("de.manager")).json(`/practices/${DE}`);
    expect(de.groups.find((g) => g.id === MOBILE).lead).toMatchObject({ displayName: "Kai Tester", email });
    expect(de.members.find((m) => m.email === email)).toMatchObject({ roles: ["Practitioner"], groupId: MOBILE, leads: [MOBILE] });
    await removeInvited([email]); // gives Mobile App its "no Lead" state back for later specs
  });

  test("[INV-API-05] a Manager invitation replaces the pending one; choosing a Manager directly cancels it", async ({ as }) => {
    const admin = await as("practices.admin");
    const practice = await (await admin.post("/practices", { name: unique("E2E Invite Practice") })).json();
    try {
      const first = newEmail("orion");
      const second = newEmail("lyra");
      const a = (await (await admin.post(`/practices/${practice.id}/invites`, { email: first, kind: "manager" })).json()).invite;
      const b = await (await admin.post(`/practices/${practice.id}/invites`, { email: second, kind: "manager" })).json();
      expect(b.invites.map((i) => i.email)).toEqual([second]);
      expect((await admin.get(`/invites/${tokenOf(a)}`)).status()).toBe(410);

      expect((await (await as()).post(`/invites/${tokenOf(b.invite)}/accept`, { displayName: "Lyra Tester" })).status()).toBe(200);
      const after = await admin.json(`/practices/${practice.id}`);
      expect(after.managers.map((m) => m.email)).toEqual([second]);

      // A new invitation, then the slot is filled directly — the invitation is withdrawn.
      const c = (await (await admin.post(`/practices/${practice.id}/invites`, { email: newEmail("zed"), kind: "manager" })).json()).invite;
      const people = await admin.json("/practices/people");
      const dev2 = people.find((p) => p.username === "de.dev2").id;
      expect((await admin.put(`/practices/${practice.id}/manager`, { userId: dev2 })).status()).toBe(200);
      expect((await admin.get(`/invites/${tokenOf(c)}`)).status()).toBe(410);
    } finally {
      await removePractice(practice.id);
    }
  });

  test("[INV-API-06] cancel and resend: only someone who could send it, and a resend retires the old link", async ({ as }) => {
    const admin = await as("practices.admin");
    const manager = await as("de.manager");
    const email = newEmail("mira");
    const { invite } = await (await admin.post(`/practices/${DE}/invites`, { email, kind: "manager" })).json();
    // The DE Manager sees it but can't touch an invitation for their own replacement.
    const seen = (await manager.json(`/practices/${DE}`)).invites.find((i) => i.email === email);
    expect(seen.actions).toEqual({ cancel: false, resend: false });
    expect((await manager.delete(`/practices/${DE}/invites/${invite.id}`)).status()).toBe(403);

    const resent = await admin.post(`/practices/${DE}/invites/${invite.id}/resend`);
    expect(resent.status()).toBe(200);
    const fresh = (await resent.json()).invite;
    expect((await admin.get(`/invites/${tokenOf(invite)}`)).status()).toBe(404);
    expect((await admin.get(`/invites/${tokenOf(fresh)}`)).status()).toBe(200);

    expect((await admin.delete(`/practices/${DE}/invites/${invite.id}`)).status()).toBe(200);
    expect((await admin.get(`/invites/${tokenOf(fresh)}`)).status()).toBe(410);
    expect((await admin.delete(`/practices/${DE}/invites/${invite.id}`)).status()).toBe(404);
  });

  test("[INV-API-07] a made-up token gets 404 and accepting needs no session", async ({ as }) => {
    const anon = await as();
    expect((await anon.get("/invites/not-a-real-token")).status()).toBe(404);
    expect((await anon.post("/invites/not-a-real-token/accept", { displayName: "x" })).status()).toBe(404);
  });
});
