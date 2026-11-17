// RBAC-API — directory, escalation guard on grant/revoke, custom roles, system-role edits (docs/rbac.md §4–§5).
const { test, expect, unique } = require("../../support/fixtures");
const { SEED_USER_COUNT } = require("../../support/users");

/** username → user id, from the Super Admin's directory view. */
async function ids(as) {
  const users = await (await as("superadmin")).json("/rbac/users");
  return Object.fromEntries(users.map((u) => [u.username, u.id]));
}

const grant = (client, userId, roleId, scopeType, scopeId) => client.post("/rbac/assignments", { userId, roleId, scopeType, scopeId });

/** Finds an assignment id on a user (as seen by superadmin). */
async function assignmentId(as, username, roleId, scopeId) {
  const users = await (await as("superadmin")).json("/rbac/users");
  return users.find((u) => u.username === username)?.assignments.find((a) => a.roleId === roleId && (a.scopeId ?? null) === (scopeId ?? null))?.id;
}

test.describe("RBAC API — directory & assignable roles", () => {
  test("[RBAC-API-01] Super Admin sees every active user and all their assignments", async ({ as }) => {
    const users = await (await as("superadmin")).json("/rbac/users");
    expect(users).toHaveLength(SEED_USER_COUNT);
    const multi = users.find((u) => u.username === "multi.user");
    expect(multi.assignments.map((a) => a.roleName).sort()).toEqual(["AI Member", "Practice Lead", "Practitioner", "Practitioner"]);
  });

  for (const username of ["cert.admin", "aitracker.admin", "aitracker.member"]) {
    test(`[RBAC-API-02] ${username} (no member/role permissions) is refused the directory → 403`, async ({ as }) => {
      const res = await (await as(username)).get("/rbac/users");
      expect(res.status()).toBe(403);
    });
  }

  test("[RBAC-API-03] a practitioner sees the directory but only assignments inside their own practice", async ({ as }) => {
    const users = await (await as("de.dev1")).json("/rbac/users");
    const by = Object.fromEntries(users.map((u) => [u.username, u]));
    expect(by["de.lead"].assignments.map((a) => a.scopeLabel)).toEqual(["Digital Engineering", "Digital Engineering · Fullstack"]);
    expect(by["qa.lead"].assignments).toEqual([]); // other practice → hidden
    expect(by["superadmin"].assignments).toEqual([]);
    expect(users.flatMap((u) => u.assignments).every((a) => a.canRevoke === false)).toBe(true);
  });

  test("[RBAC-API-04] Practice Manager can grant Practitioner / custom roles in their practice and Lead in its groups — never Practice Manager", async ({ as }) => {
    const options = await (await as("de.manager")).json("/rbac/assignable");
    const flat = options.flatMap((o) => o.scopes.map((s) => `${o.roleName}@${s.label}`)).sort();
    expect(flat).toEqual([
      "Practice Coordinator@Digital Engineering",
      "Practice Lead@Digital Engineering · DevOps",
      "Practice Lead@Digital Engineering · Fullstack",
      "Practice Lead@Digital Engineering · Mobile App",
      "Practitioner@Digital Engineering",
    ]);
  });

  test("[RBAC-API-05] Practices Admin can appoint Practice Managers in every practice but not platform/app admins", async ({ as }) => {
    const options = await (await as("practices.admin")).json("/rbac/assignable");
    const pm = options.find((o) => o.roleId === "practice_manager");
    expect(pm.scopes.map((s) => s.label).sort()).toEqual(["AI", "Digital Engineering", "Platform", "QA"]);
    expect(options.map((o) => o.roleId)).not.toEqual(expect.arrayContaining(["super_admin"]));
    for (const forbidden of ["super_admin", "practices_admin", "cert_admin", "ai_admin", "ai_member"]) {
      expect(options.map((o) => o.roleId)).not.toContain(forbidden);
    }
  });

  test("[RBAC-API-06] a Practice Lead has nothing to grant", async ({ as }) => {
    expect(await (await as("de.lead")).json("/rbac/assignable")).toEqual([]);
  });
});

test.describe("RBAC API — granting & revoking (escalation guard)", () => {
  test("[RBAC-API-07] Practice Manager grants Practitioner in their practice, then revokes it", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const res = await grant(manager, id["qa.tester1"], "practitioner", "practice", "digital-engineering");
    expect(res.status()).toBe(201);
    const { id: assignment } = await res.json();
    const seen = (await manager.json("/rbac/users")).find((u) => u.username === "qa.tester1").assignments;
    expect(seen.find((a) => a.id === assignment)).toMatchObject({ roleName: "Practitioner", scopeLabel: "Digital Engineering", canRevoke: true });
    expect((await manager.delete(`/rbac/assignments/${assignment}`)).status()).toBe(204);
  });

  test("[RBAC-API-08] granting the same role at the same scope twice → 409", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const first = await grant(manager, id["qa.tester1"], "practitioner", "practice", "digital-engineering");
    expect(first.status()).toBe(201);
    try {
      const again = await grant(manager, id["qa.tester1"], "practitioner", "practice", "digital-engineering");
      expect(again.status()).toBe(409);
      expect((await again.json()).error).toMatch(/already has Practitioner/);
    } finally {
      await manager.delete(`/rbac/assignments/${(await first.json()).id}`);
    }
  });

  test("[RBAC-API-09] Practice Manager cannot appoint another Practice Manager (assignableFrom: app)", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("de.manager"), id["de.lead"], "practice_manager", "practice", "digital-engineering");
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/practices\.roles\.assign.*app level/);
  });

  test("[RBAC-API-10] Practice Manager cannot grant roles in a different practice", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("de.manager"), id["qa.tester1"], "practitioner", "practice", "qa");
    expect(res.status()).toBe(403);
  });

  test("[RBAC-API-11] Practice Lead cannot grant anything", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("de.lead"), id["qa.tester1"], "practitioner", "practice", "digital-engineering");
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/Needs practices\.roles\.assign/);
  });

  test("[RBAC-API-12] custom-role holder with roles.assign still can't grant a role holding permissions they lack", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("de.coordinator"), id["qa.tester1"], "practitioner", "practice", "digital-engineering");
    expect(res.status()).toBe(403);
    expect((await res.json()).error).toMatch(/You don't hold: .*practices\.contribution\.view/);
  });

  test("[RBAC-API-13] one Manager per practice: a second one is refused → 409 (change it from Practices)", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("practices.admin"), id["qa.lead"], "practice_manager", "practice", "qa");
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/QA already has a Practice Manager \(Skyler Grant\)/);
  });

  test("[RBAC-API-13b] Leads are per group: one per group, from the practice's members, never practice-wide", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const second = await grant(manager, id["de.dev1"], "practice_lead", "group", "digital-engineering-fullstack");
    expect(second.status()).toBe(409);
    const outsider = await grant(manager, id["qa.tester1"], "practice_lead", "group", "digital-engineering-mobile-app");
    expect(outsider.status()).toBe(400);
    expect((await outsider.json()).error).toMatch(/Add them to Digital Engineering/);
    const practiceWide = await grant(manager, id["de.dev1"], "practice_lead", "practice", "digital-engineering");
    expect(practiceWide.status()).toBe(403);
    expect((await grant(manager, id["de.dev1"], "practice_lead", "group", "qa-automation")).status()).toBe(403);
    const ok = await grant(manager, id["de.dev2"], "practice_lead", "group", "digital-engineering-mobile-app");
    expect(ok.status()).toBe(201);
    expect((await manager.delete(`/rbac/assignments/${(await ok.json()).id}`)).status()).toBe(204);
  });

  test("[RBAC-API-14] Practices Admin cannot create a Super Admin", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("practices.admin"), id["de.dev1"], "super_admin", "platform", null);
    expect(res.status()).toBe(403);
  });

  test("[RBAC-API-15] AI Admin cannot add AI Members (needs platform.apps.assign — rbac.md §5)", async ({ as }) => {
    const id = await ids(as);
    const res = await grant(await as("aitracker.admin"), id["de.dev1"], "ai_member", "app", "ai-tracker");
    expect(res.status()).toBe(403);
  });

  test("[RBAC-API-16] a grant opens the app immediately and a revoke closes it on the very next request", async ({ as }) => {
    const id = await ids(as);
    const admin = await as("superadmin");
    const cert = await as("cert.admin"); // same token throughout — grants are resolved per request, not baked into the JWT
    expect((await cert.me()).apps.map((a) => a.id)).toEqual(["cert-tracker"]);
    const res = await grant(admin, id["cert.admin"], "ai_member", "app", "ai-tracker");
    expect(res.status()).toBe(201);
    const { id: assignment } = await res.json();
    try {
      expect((await cert.me()).apps.map((a) => a.id).sort()).toEqual(["ai-tracker", "cert-tracker"]);
      expect((await cert.get("/ai/usage-reports/mine")).status()).toBe(200);
    } finally {
      expect((await admin.delete(`/rbac/assignments/${assignment}`)).status()).toBe(204);
    }
    expect((await cert.me()).apps.map((a) => a.id)).toEqual(["cert-tracker"]);
    expect((await cert.get("/ai/usage-reports/mine")).status()).toBe(403);
  });

  test("[RBAC-API-17] a role can only be granted at its own scope type / scope", async ({ as }) => {
    const id = await ids(as);
    const admin = await as("superadmin");
    const atPlatform = await grant(admin, id["de.dev1"], "practitioner", "platform", null);
    expect(atPlatform.status()).toBe(403);
    expect((await atPlatform.json()).error).toMatch(/only be granted at practice scope/);
    const certAtPractice = await grant(admin, id["de.dev1"], "cert_admin", "practice", "qa");
    expect(certAtPractice.status()).toBe(403);
    const customElsewhere = await grant(admin, id["qa.tester1"], "de_practice_coordinator", "practice", "qa");
    expect(customElsewhere.status()).toBe(403);
    expect((await customElsewhere.json()).error).toMatch(/belongs to another scope/);
  });

  test("[RBAC-API-18] bad grant input: invalid user id, unknown user, unknown role, unknown practice", async ({ as }) => {
    const id = await ids(as);
    const admin = await as("superadmin");
    expect((await grant(admin, "not-an-id", "practitioner", "practice", "qa")).status()).toBe(400);
    expect((await grant(admin, "64b000000000000000000000", "practitioner", "practice", "qa")).status()).toBe(404);
    expect((await grant(admin, id["de.dev1"], "no_such_role", "practice", "qa")).status()).toBe(404);
    const unknownPractice = await grant(admin, id["de.dev1"], "practitioner", "practice", "mobile");
    expect(unknownPractice.status()).toBe(403);
    expect((await unknownPractice.json()).error).toBe("Unknown practice");
  });

  test("[RBAC-API-19] revoking is guarded like granting: a Manager can't remove a Manager (theirs or another practice's)", async ({ as }) => {
    const manager = await as("de.manager");
    for (const [user, scope] of [["de.manager", "digital-engineering"], ["qa.manager", "qa"]]) {
      const assignment = await assignmentId(as, user, "practice_manager", scope);
      const res = await manager.delete(`/rbac/assignments/${assignment}`);
      expect(res.status(), `${user}@${scope}`).toBe(403);
    }
    const users = await manager.json("/rbac/users");
    const own = users.find((u) => u.username === "de.manager").assignments[0];
    expect(own.canRevoke).toBe(false);
    expect(users.find((u) => u.username === "de.lead").assignments[0].canRevoke).toBe(true);
  });

  test("[RBAC-API-20] the last Super Admin assignment can't be removed", async ({ as }) => {
    const assignment = await assignmentId(as, "superadmin", "super_admin", null);
    const res = await (await as("superadmin")).delete(`/rbac/assignments/${assignment}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe("Can't remove the last Super Admin");
  });

  test("[RBAC-API-21] revoking an invalid or unknown assignment id → 404", async ({ as }) => {
    const admin = await as("superadmin");
    expect((await admin.delete("/rbac/assignments/xyz")).status()).toBe(404);
    expect((await admin.delete("/rbac/assignments/64b000000000000000000000")).status()).toBe(404);
  });
});

test.describe("RBAC API — custom roles", () => {
  test("[RBAC-API-22] Practice Manager creates, renames and deletes a custom role in their practice", async ({ as }) => {
    const manager = await as("de.manager");
    const name = unique("E2E Mentor");
    const created = await manager.post("/rbac/roles", { name, practiceId: "digital-engineering", permissions: ["practices.members.view", "cert.plan.view"] });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const role = (await manager.json("/rbac/roles")).find((r) => r.id === id);
    expect(role).toMatchObject({ name, isSystem: false, scopeType: "practice", scopeId: "digital-engineering", canManage: true, assignmentCount: 0 });
    expect((await manager.patch(`/rbac/roles/${id}`, { name: `${name} v2` })).status()).toBe(200);
    expect((await manager.json("/rbac/roles")).find((r) => r.id === id).name).toBe(`${name} v2`);
    expect((await manager.delete(`/rbac/roles/${id}`)).status()).toBe(204);
    expect((await manager.json("/rbac/roles")).find((r) => r.id === id)).toBeUndefined();
  });

  test("[RBAC-API-23] Practice Manager cannot create a custom role in another practice; a Lead can't create one at all", async ({ as }) => {
    const body = { name: "Nope", practiceId: "qa", permissions: ["practices.members.view"] };
    expect((await (await as("de.manager")).post("/rbac/roles", body)).status()).toBe(403);
    expect((await (await as("de.lead")).post("/rbac/roles", { ...body, practiceId: "digital-engineering" })).status()).toBe(403);
  });

  for (const perm of ["platform.users.manage", "practices.practice.create", "practices.practice.archive", "cert.catalog.manage"]) {
    test(`[RBAC-API-24] custom role can't contain ${perm} (outside the practice-scoped subset) → 400`, async ({ as }) => {
      const res = await (await as("practices.admin")).post("/rbac/roles", { name: "Too much", practiceId: "qa", permissions: ["practices.members.view", perm] });
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toContain(perm);
    });
  }

  for (const [label, body, message] of [
    ["blank name", { name: "   ", practiceId: "digital-engineering", permissions: ["practices.members.view"] }, "Name is required"],
    ["no permissions", { name: "Empty", practiceId: "digital-engineering", permissions: [] }, "Pick at least one permission"],
    ["unknown practice", { name: "Lost", practiceId: "mobile", permissions: ["practices.members.view"] }, "Pick a practice"],
  ]) {
    test(`[RBAC-API-25] custom role validation: ${label} → 400`, async ({ as }) => {
      const res = await (await as("de.manager")).post("/rbac/roles", body);
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe(message);
    });
  }

  test("[RBAC-API-26] a custom role that is still assigned can't be deleted (409)", async ({ as }) => {
    const res = await (await as("de.manager")).delete("/rbac/roles/de_practice_coordinator");
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toMatch(/assigned to 1 user/);
  });

  test("[RBAC-API-27] system roles can't be deleted; unknown roles → 404", async ({ as }) => {
    const admin = await as("superadmin");
    expect((await admin.delete("/rbac/roles/practitioner")).status()).toBe(400);
    expect((await admin.delete("/rbac/roles/nope")).status()).toBe(404);
    expect((await admin.patch("/rbac/roles/nope", { name: "x" })).status()).toBe(404);
  });

  test("[RBAC-API-28] custom roles are only visible inside their practice", async ({ as }) => {
    // Leads hold roles.view on their group and read their practice's roles through it.
    const deLead = (await (await as("de.lead")).json("/rbac/roles")).map((r) => r.id);
    const qaLead = (await (await as("qa.lead")).json("/rbac/roles")).map((r) => r.id);
    expect(deLead).toContain("de_practice_coordinator");
    expect(qaLead).not.toContain("de_practice_coordinator");
    expect(qaLead).toContain("practitioner"); // system roles visible to anyone who can view roles
  });

  test("[RBAC-API-29] a practitioner (no roles.view) can't list roles or the catalog", async ({ as }) => {
    const dev = await as("de.dev1");
    expect((await dev.get("/rbac/roles")).status()).toBe(403);
    expect((await dev.get("/rbac/catalog")).status()).toBe(403);
  });
});

test.describe("RBAC API — editing system roles (Super Admin only)", () => {
  test("[RBAC-API-30] only Super Admin may edit a system role", async ({ as }) => {
    for (const user of ["practices.admin", "de.manager"]) {
      const res = await (await as(user)).patch("/rbac/roles/practitioner", { description: "hijack" });
      expect(res.status(), user).toBe(403);
    }
  });

  test("[RBAC-API-31] Super Admin role itself is locked (prevents lock-out)", async ({ as }) => {
    const admin = await as("superadmin");
    const res = await admin.patch("/rbac/roles/super_admin", { permissions: ["platform.users.manage"] });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/can't be edited/);
    expect((await admin.json("/rbac/roles")).find((r) => r.id === "super_admin").canManage).toBe(false);
  });

  test("[RBAC-API-32] platform.* permissions are refused on a practice-scope system role", async ({ as }) => {
    const admin = await as("superadmin");
    const current = (await admin.json("/rbac/roles")).find((r) => r.id === "practitioner").permissions;
    const res = await admin.patch("/rbac/roles/practitioner", { permissions: [...current, "platform.users.manage"] });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/Only platform roles can hold: platform\.users\.manage/);
  });

  test("[RBAC-API-33] unknown permission keys and empty permission lists are refused", async ({ as }) => {
    const admin = await as("superadmin");
    expect((await admin.patch("/rbac/roles/ai_member", { permissions: ["ai.items.view", "ai.made.up"] })).status()).toBe(400);
    expect((await admin.patch("/rbac/roles/ai_member", { permissions: [] })).status()).toBe(400);
    expect((await admin.patch("/rbac/roles/ai_member", { name: " " })).status()).toBe(400);
  });

  test("[RBAC-API-34] Super Admin edits a system role's description (then restores it)", async ({ as }) => {
    const admin = await as("superadmin");
    const before = (await admin.json("/rbac/roles")).find((r) => r.id === "ai_member");
    try {
      expect((await admin.patch("/rbac/roles/ai_member", { description: "Edited by e2e" })).status()).toBe(200);
      expect((await admin.json("/rbac/roles")).find((r) => r.id === "ai_member").description).toBe("Edited by e2e");
    } finally {
      await admin.patch("/rbac/roles/ai_member", { description: before.description ?? "" });
    }
  });

  test("[RBAC-API-35] widening Practice Manager beyond Practices Admin stops Practices Admin appointing Managers (rbac.md §4)", async ({ as }) => {
    const admin = await as("superadmin");
    const original = (await admin.json("/rbac/roles")).find((r) => r.id === "practice_manager").permissions;
    try {
      expect((await admin.patch("/rbac/roles/practice_manager", { permissions: [...original, "cert.catalog.manage"] })).status()).toBe(200);
      const options = await (await as("practices.admin")).json("/rbac/assignable");
      expect(options.map((o) => o.roleId)).not.toContain("practice_manager");
    } finally {
      expect((await admin.patch("/rbac/roles/practice_manager", { permissions: original })).status()).toBe(200);
    }
    const restored = await (await as("practices.admin")).json("/rbac/assignable");
    expect(restored.map((o) => o.roleId)).toContain("practice_manager");
  });
});
