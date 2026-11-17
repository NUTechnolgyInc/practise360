// PRAC-API — practices, their groups, Managers, group Leads and membership (docs/rbac.md §4 "Practices and groups").
const { test, expect, unique } = require("../../support/fixtures");
const { removePractice } = require("../../support/db");
const { makePdf } = require("../../support/files");

const DE = "digital-engineering";
const FULLSTACK = "digital-engineering-fullstack";
const DEVOPS = "digital-engineering-devops";
const MOBILE = "digital-engineering-mobile-app";

/** username → user id. */
async function ids(as) {
  const people = await (await as("practices.admin")).json("/practices/people");
  return Object.fromEntries(people.map((p) => [p.username, p.id]));
}

test.describe("Practices API — who sees what", () => {
  test("[PRAC-API-01] a Manager sees only their practice, with its Manager, groups and Leads", async ({ as }) => {
    const body = await (await as("de.manager")).json("/practices");
    expect(body.canCreate).toBe(false);
    expect(body.practices.map((p) => p.id)).toEqual([DE]);
    const [de] = body.practices;
    expect(de.managers.map((m) => m.username)).toEqual(["de.manager"]);
    expect(Object.fromEntries(de.groups.map((g) => [g.name, g.lead?.username ?? null]))).toEqual({ DevOps: "de.lead2", Fullstack: "de.lead", "Mobile App": null });
    expect(de.actions).toMatchObject({ update: true, setManager: false, createGroup: true, appointLeads: true, moveMembers: true, addMember: true });
  });

  test("[PRAC-API-02] Practices Admin sees every practice and can create; Cert Admin has no Practices view", async ({ as }) => {
    const body = await (await as("practices.admin")).json("/practices");
    expect(body.canCreate).toBe(true);
    expect(body.practices.map((p) => p.name)).toEqual(["AI", "Digital Engineering", "Platform", "QA"]);
    expect(body.practices.every((p) => p.actions.setManager)).toBe(true);
    expect((await (await as("cert.admin")).get("/practices")).status()).toBe(403);
  });

  test("[PRAC-API-10] the practices list names the Practices Admin for everyone who can see it", async ({ as }) => {
    for (const u of ["practices.admin", "de.manager", "de.dev1"]) {
      expect((await (await as(u)).json("/practices")).admins.map((a) => a.displayName), u).toEqual(["Jordan Blake"]);
    }
  });

  test("[PRAC-API-03] practitioners and Leads get a read-only view; other practices get 404", async ({ as }) => {
    for (const u of ["de.dev1", "de.lead"]) {
      const de = await (await as(u)).json(`/practices/${DE}`);
      expect(Object.values(de.actions).some(Boolean), u).toBe(false);
      expect(de.groups.every((g) => !g.actions.setLead && !g.actions.edit), u).toBe(true);
      expect(de.members.find((m) => m.username === "de.dev1").groupId).toBe(FULLSTACK);
    }
    expect((await (await as("qa.manager")).get(`/practices/${DE}`)).status()).toBe(404);
  });
});

test.describe("Practices API — practices and Managers", () => {
  test("[PRAC-API-04] Practices Admin creates a practice with its Manager, then replaces the Manager", async ({ as }) => {
    const id = await ids(as);
    const admin = await as("practices.admin");
    const name = unique("E2E Practice");
    const res = await admin.post("/practices", { name, managerId: id["de.dev2"] });
    expect(res.status()).toBe(201);
    const created = await res.json();
    try {
      expect(created.managers.map((m) => m.username)).toEqual(["de.dev2"]);
      expect((await admin.post("/practices", { name: name.toUpperCase() })).status()).toBe(400); // duplicate name

      const replaced = await (await admin.put(`/practices/${created.id}/manager`, { userId: id["platform.dev1"] })).json();
      expect(replaced.managers.map((m) => m.username)).toEqual(["platform.dev1"]);
      // keepPrevious defaults to true: the old Manager stays in the practice as a Practitioner.
      expect(replaced.members.find((m) => m.username === "de.dev2").roles).toEqual(["Practitioner"]);
    } finally {
      await removePractice(created.id);
    }
  });

  test("[PRAC-API-05] only Practices Admin creates practices or chooses Managers", async ({ as }) => {
    const id = await ids(as);
    expect((await (await as("de.manager")).post("/practices", { name: unique("Rogue") })).status()).toBe(403);
    expect((await (await as("de.manager")).put(`/practices/${DE}/manager`, { userId: id["de.lead"] })).status()).toBe(403);
  });
});

test.describe("Practices API — groups, Leads and members", () => {
  test("[PRAC-API-06] Manager creates, renames and deletes a group; duplicates and non-empty deletes are refused", async ({ as }) => {
    const manager = await as("de.manager");
    const name = unique("Data Platform");
    const created = await manager.post(`/practices/${DE}/groups`, { name });
    expect(created.status()).toBe(201);
    const group = (await created.json()).groups.find((g) => g.name === name);
    expect(group.id).toMatch(/^digital-engineering-/);
    expect((await manager.post(`/practices/${DE}/groups`, { name: "fullstack" })).status()).toBe(400);
    const renamed = await (await manager.patch(`/practices/${DE}/groups/${group.id}`, { name: `${name} 2` })).json();
    expect(renamed.groups.find((g) => g.id === group.id).name).toBe(`${name} 2`); // id unchanged
    expect((await manager.delete(`/practices/${DE}/groups/${FULLSTACK}`)).status()).toBe(409);
    expect((await manager.delete(`/practices/${DE}/groups/${group.id}`)).status()).toBe(200);
    expect((await (await as("de.lead")).post(`/practices/${DE}/groups`, { name: unique("x") })).status()).toBe(403);
  });

  test("[PRAC-API-07] Manager chooses a Lead from the practice; they join the group if they weren't in one", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    expect((await manager.put(`/practices/${DE}/groups/${MOBILE}/lead`, { userId: id["qa.tester1"] })).status()).toBe(400); // not in DE
    expect((await (await as("de.lead")).put(`/practices/${DE}/groups/${MOBILE}/lead`, { userId: id["de.dev2"] })).status()).toBe(403);
    try {
      const res = await (await manager.put(`/practices/${DE}/groups/${MOBILE}/lead`, { userId: id["de.coordinator"] })).json();
      const mobile = res.groups.find((g) => g.id === MOBILE);
      expect(mobile.lead.username).toBe("de.coordinator");
      expect(res.members.find((m) => m.username === "de.coordinator").groupId).toBe(MOBILE);
      // Replacing: de.dev2 already sits in DevOps and stays there.
      const again = await (await manager.put(`/practices/${DE}/groups/${MOBILE}/lead`, { userId: id["de.dev2"] })).json();
      expect(again.groups.find((g) => g.id === MOBILE).lead.username).toBe("de.dev2");
      expect(again.members.find((m) => m.username === "de.dev2").groupId).toBe(DEVOPS);
    } finally {
      await manager.delete(`/practices/${DE}/groups/${MOBILE}/lead`);
      await manager.put(`/practices/${DE}/members/${id["de.coordinator"]}`, { groupId: null });
    }
  });

  test("[PRAC-API-08] a Lead reaches only their group's members; moving someone hands them to the new Lead", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const people = async (u) => (await (await as(u)).json(`/certifications/people/${DE}`)).map((p) => p.username).sort();
    expect(await people("de.lead")).toEqual(["de.dev1", "de.lead"]);
    expect(await people("de.lead2")).toEqual(["de.dev2", "de.lead2"]);
    const assign = (u, who) => u.post("/certifications/assignments", { mode: "assign", practiceId: DE, userIds: [id[who]], dueDate: "2099-01-01", cert: { title: unique("E2E Reach"), type: "course" } });
    expect((await assign(await as("de.lead2"), "de.dev1")).status()).toBe(403);
    expect((await (await as("de.dev1")).put(`/practices/${DE}/members/${id["de.dev1"]}`, { groupId: DEVOPS })).status()).toBe(403);
    try {
      expect((await manager.put(`/practices/${DE}/members/${id["de.dev1"]}`, { groupId: DEVOPS })).status()).toBe(200);
      expect(await people("de.lead2")).toContain("de.dev1");
      expect(await people("de.lead")).not.toContain("de.dev1");
    } finally {
      await manager.put(`/practices/${DE}/members/${id["de.dev1"]}`, { groupId: FULLSTACK });
    }
  });

  test("[PRAC-API-09] Manager adds someone straight into a group; a Lead's last practice role can't be revoked", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const res = await manager.post(`/practices/${DE}/members`, { userId: id["qa.tester1"], groupId: FULLSTACK });
    expect(res.status()).toBe(201);
    expect((await res.json()).members.find((m) => m.username === "qa.tester1")).toMatchObject({ roles: ["Practitioner"], groupId: FULLSTACK });
    expect((await manager.post(`/practices/${DE}/members`, { userId: id["qa.tester1"] })).status()).toBe(409);

    const users = await manager.json("/rbac/users");
    const added = users.find((u) => u.username === "qa.tester1").assignments.find((a) => a.scopeId === DE);
    expect((await manager.delete(`/rbac/assignments/${added.id}`)).status()).toBe(204);
    const after = await manager.json(`/practices/${DE}`);
    expect(after.members.some((m) => m.username === "qa.tester1")).toBe(false); // left the group with the role

    const leadRole = users.find((u) => u.username === "de.lead").assignments.find((a) => a.roleId === "practitioner");
    const blocked = await manager.delete(`/rbac/assignments/${leadRole.id}`);
    expect(blocked.status()).toBe(409);
    expect((await blocked.json()).error).toMatch(/They lead Digital Engineering · Fullstack/);
  });
});

test.describe("Practices API — Overview", () => {
  test("[PRAC-API-11] Manager and Practices Admin edit the Overview and its files; members only read them", async ({ as }) => {
    const manager = await as("de.manager");
    const dev = await as("de.dev1");
    const path = `/practices/${DE}/overview`;
    const before = await manager.json(path);
    expect(before.canEdit).toBe(true);
    expect((await dev.json(path)).canEdit).toBe(false);

    let fileId;
    try {
      const saved = await (await manager.put(path, { body: "## Ways of working\n\nStand-up at 10:00." })).json();
      expect(saved).toMatchObject({ body: "## Ways of working\n\nStand-up at 10:00.", updatedBy: { username: "de.manager" } });
      expect((await (await as("practices.admin")).put(path, { body: saved.body })).status()).toBe(200);
      expect((await dev.json(path)).body).toContain("Stand-up at 10:00.");
      expect((await dev.put(path, { body: "hijacked" })).status()).toBe(403);
      expect((await (await as("de.lead")).put(path, { body: "hijacked" })).status()).toBe(403);
      expect((await manager.put(path, { body: "x".repeat(50001) })).status()).toBe(400);

      expect((await dev.upload("POST", `${path}/files?fileName=guide.pdf`, makePdf("guide"), "application/pdf")).status()).toBe(403);
      const up = await manager.upload("POST", `${path}/files?fileName=guide.pdf`, makePdf("guide"), "application/pdf");
      expect(up.status()).toBe(201);
      fileId = (await up.json()).id;
      expect((await dev.json(path)).files.map((f) => f.fileName)).toContain("guide.pdf");
      const download = await dev.get(`${path}/files/${fileId}`);
      expect(download.status()).toBe(200);
      expect(download.headers()["content-type"]).toBe("application/pdf");
      expect((await dev.delete(`${path}/files/${fileId}`)).status()).toBe(403);
      expect((await (await as("qa.manager")).get(`${path}/files/${fileId}`)).status()).toBe(404); // another practice's Manager
      expect((await manager.delete(`${path}/files/${fileId}`)).status()).toBe(204);
      expect((await manager.get(`${path}/files/${fileId}`)).status()).toBe(404);
      fileId = null;
    } finally {
      if (fileId) await manager.delete(`${path}/files/${fileId}`);
      await manager.put(path, { body: before.body });
    }
  });
});

test.describe("Practices API — a group run by its Lead", () => {
  test("[PRAC-API-12] a group's Lead, the Manager and Practices Admin edit its Overview; others only read it", async ({ as }) => {
    const lead = await as("de.lead");
    const path = `/practices/${DE}/groups/${FULLSTACK}/overview`;
    const before = await lead.json(path);
    expect(before.canEdit).toBe(true);
    for (const u of ["de.dev1", "de.lead2", "de.coordinator"]) expect((await (await as(u)).json(path)).canEdit, u).toBe(false);

    let fileId;
    try {
      const saved = await (await lead.put(path, { body: "## Fullstack\n\nPairing on Fridays." })).json();
      expect(saved).toMatchObject({ body: "## Fullstack\n\nPairing on Fridays.", updatedBy: { username: "de.lead" }, canEdit: true });
      for (const u of ["de.manager", "practices.admin"]) expect((await (await as(u)).put(path, { body: saved.body })).status(), u).toBe(200);
      expect((await (await as("de.dev1")).json(path)).body).toContain("Pairing on Fridays.");
      expect((await (await as("de.dev2")).json(path)).body).toContain("Pairing on Fridays."); // whole practice reads it
      for (const u of ["de.dev1", "de.lead2"]) expect((await (await as(u)).put(path, { body: "hijacked" })).status(), u).toBe(403);
      // A group's Overview is separate from the practice's, and other practices don't see it.
      expect((await lead.json(`/practices/${DE}/overview`)).canEdit).toBe(false);
      expect((await (await as("qa.manager")).get(path)).status()).toBe(404);
      expect((await lead.get(`/practices/${DE}/groups/qa-automation/overview`)).status()).toBe(404);

      expect((await (await as("de.lead2")).upload("POST", `${path}/files?fileName=stack.pdf`, makePdf("stack"), "application/pdf")).status()).toBe(403);
      const up = await lead.upload("POST", `${path}/files?fileName=stack.pdf`, makePdf("stack"), "application/pdf");
      expect(up.status()).toBe(201);
      fileId = (await up.json()).id;
      expect((await (await as("de.dev2")).get(`${path}/files/${fileId}`)).status()).toBe(200);
      expect((await lead.json(`/practices/${DE}/overview`)).files.map((f) => f.id)).not.toContain(fileId);
      expect((await lead.get(`/practices/${DE}/overview/files/${fileId}`)).status()).toBe(404);
      expect((await (await as("de.dev1")).delete(`${path}/files/${fileId}`)).status()).toBe(403);
      expect((await lead.delete(`${path}/files/${fileId}`)).status()).toBe(204);
      fileId = null;
    } finally {
      if (fileId) await lead.delete(`${path}/files/${fileId}`);
      await lead.put(path, { body: before.body });
    }
  });

  test("[PRAC-API-13] a Lead takes people without a group into theirs and removes members, but never touches another group", async ({ as }) => {
    const id = await ids(as);
    const manager = await as("de.manager");
    const lead = await as("de.lead");
    const move = (client, who, groupId) => client.put(`/practices/${DE}/members/${id[who]}`, { groupId });
    const groupOf = async (who) => (await manager.json(`/practices/${DE}`)).members.find((m) => m.username === who).groupId;

    const actions = Object.fromEntries((await lead.json(`/practices/${DE}`)).groups.map((g) => [g.id, g.actions]));
    expect(actions[FULLSTACK]).toMatchObject({ update: true, manageMembers: true, edit: false, setLead: false });
    expect(actions[DEVOPS]).toMatchObject({ update: false, manageMembers: false });
    try {
      expect((await move(lead, "de.dev2", FULLSTACK)).status()).toBe(403); // still in DevOps: Blair Kim's group
      expect((await move(manager, "de.dev2", null)).status()).toBe(200);
      expect((await move(lead, "de.dev2", FULLSTACK)).status()).toBe(200);
      expect(await groupOf("de.dev2")).toBe(FULLSTACK);
      expect((await move(lead, "de.dev2", DEVOPS)).status()).toBe(403);
      expect((await move(await as("de.lead2"), "de.dev2", null)).status()).toBe(403);
      expect((await move(lead, "de.dev2", null)).status()).toBe(200);
      expect(await groupOf("de.dev2")).toBe(null);
      // Members can't move anyone, and a Lead can't add people to the practice (that grants Practitioner).
      expect((await move(await as("de.dev1"), "de.dev2", FULLSTACK)).status()).toBe(403);
      expect((await lead.post(`/practices/${DE}/members`, { userId: id["qa.tester1"], groupId: FULLSTACK })).status()).toBe(403);
    } finally {
      await move(manager, "de.dev2", DEVOPS);
    }
  });

  test("[PRAC-API-14] contributions filter by group: work started by the group's current members", async ({ as }) => {
    const dev1 = await as("de.dev1");
    const dev2 = await as("de.dev2");
    const mine = await (await dev1.post("/contributions", { title: unique("E2E Fullstack work"), practiceId: DE, type: "blog", startDate: "2026-01-01", dueDate: "2099-01-01" })).json();
    const theirs = await (await dev2.post("/contributions", { title: unique("E2E DevOps work"), practiceId: DE, type: "blog", startDate: "2026-01-01", dueDate: "2099-01-01" })).json();
    const titles = async (u, query) => (await (await as(u)).json(`/contributions?${query}`)).contributions.map((c) => c.title);

    const fullstack = await titles("de.manager", `practiceId=${DE}&groupId=${FULLSTACK}`);
    expect(fullstack).toContain(mine.title);
    expect(fullstack).not.toContain(theirs.title);
    expect(await titles("de.dev1", `groupId=${DEVOPS}`)).toContain(theirs.title); // the whole practice sees contributions
    expect(await titles("de.manager", `practiceId=${DE}&groupId=qa-automation`)).toEqual([]);
    expect(await titles("qa.manager", `groupId=${FULLSTACK}`)).toEqual([]);
  });
});
