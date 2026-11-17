// PEOPLE-API — person profiles (docs/rbac.md §4 "People profiles"): each part follows the screen it comes from.
// Read-only: uses the seeded people and changes nothing.
const { test, expect } = require("../../support/fixtures");

const DE = "digital-engineering";

/** username → user id. */
async function ids(as) {
  const people = await (await as("practices.admin")).json("/practices/people");
  return Object.fromEntries(people.map((p) => [p.username, p.id]));
}

const roleNames = (profile) => profile.appRoles.map((r) => r.roleName);

test.describe("People API — profiles", () => {
  test("[PEOPLE-API-01] a practitioner sees a peer's practice, group, roles and contributions — not their plans or reports", async ({ as }) => {
    const id = await ids(as);
    const p = await (await as("de.dev1")).json(`/people/${id["de.dev2"]}`);
    expect(p).toMatchObject({ username: "de.dev2", displayName: "Jesse Monroe", isSelf: false, isActive: true });
    expect(p.practices).toEqual([{ id: DE, name: "Digital Engineering", group: { id: "digital-engineering-devops", name: "DevOps" }, roles: ["Practitioner"], groupRoles: [] }]);
    expect(Array.isArray(p.contributions)).toBe(true);
    expect(p.certifications).toBeNull();
    expect(p.usageReports).toBeNull();
  });

  test("[PEOPLE-API-02] a Lead reaches their own group's plans only; the Manager sees plans and usage reports for everyone", async ({ as }) => {
    const id = await ids(as);
    const lead = await as("de.lead");
    expect(Array.isArray((await lead.json(`/people/${id["de.dev1"]}`)).certifications)).toBe(true);
    expect((await lead.json(`/people/${id["de.dev2"]}`)).certifications).toBeNull();
    expect((await lead.json(`/people/${id["de.dev1"]}`)).usageReports).toBeNull();
    const ofLead = await (await as("de.dev1")).json(`/people/${id["de.lead"]}`);
    expect(ofLead.practices[0].groupRoles).toEqual([{ role: "Practice Lead", group: { id: "digital-engineering-fullstack", name: "Fullstack" } }]);

    const manager = await as("de.manager");
    for (const u of ["de.dev1", "de.dev2"]) {
      const p = await manager.json(`/people/${id[u]}`);
      expect(Array.isArray(p.certifications) && Array.isArray(p.usageReports), u).toBe(true);
    }
  });

  test("[PEOPLE-API-03] outside the practice only the name shows; Cert Admin sees plans; an AI Member gets 404", async ({ as }) => {
    const id = await ids(as);
    const outsider = await (await as("qa.tester1")).json(`/people/${id["de.dev1"]}`);
    expect(outsider.displayName).toBe("Riley Patel");
    expect(outsider.practices).toEqual([]);
    expect([outsider.contributions, outsider.certifications, outsider.usageReports]).toEqual([null, null, null]);

    const byCertAdmin = await (await as("cert.admin")).json(`/people/${id["de.dev1"]}`);
    expect(Array.isArray(byCertAdmin.certifications)).toBe(true);
    expect([byCertAdmin.practices, byCertAdmin.contributions]).toEqual([[], null]);

    const aiMember = await as("aitracker.member");
    expect((await aiMember.get(`/people/${id["de.dev1"]}`)).status()).toBe(404);
    expect((await aiMember.get("/people/000000000000000000000000")).status()).toBe(404);
    expect((await aiMember.get("/people/not-an-id")).status()).toBe(404);
    expect((await (await as()).get(`/people/${id["de.dev1"]}`)).status()).toBe(401);
  });

  test("[PEOPLE-API-04] Practices Admin is named to practice members; other app roles only to whoever manages access", async ({ as }) => {
    const id = await ids(as);
    const dev = await as("de.dev1");
    expect(roleNames(await dev.json(`/people/${id["practices.admin"]}`))).toEqual(["Practices Admin"]);
    expect(roleNames(await dev.json(`/people/${id["cert.admin"]}`))).toEqual([]);
    expect(roleNames(await (await as("superadmin")).json(`/people/${id["cert.admin"]}`))).toEqual(["Cert Admin"]);
  });

  test("[PEOPLE-API-05] everyone sees all of their own profile", async ({ as }) => {
    const id = await ids(as);
    const me = await (await as("de.dev1")).json(`/people/${id["de.dev1"]}`);
    expect(me.isSelf).toBe(true);
    expect(me.practices[0].group.name).toBe("Fullstack");
    expect(Array.isArray(me.contributions) && Array.isArray(me.certifications) && Array.isArray(me.usageReports)).toBe(true);
  });
});
