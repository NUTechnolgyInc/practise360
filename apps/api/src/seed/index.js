// Dev seed (docs/rbac.md §7). Wipes and recreates every RBAC collection. Synthetic people only.
// Run: npm run seed -w api
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { App, Practice, Group, GroupMembership, Invitation, Permission, Role, RoleAssignment, UsageReport, User, CertCatalogItem, CertPlan, CertFile } = require("../models");
const { APPS, PRACTICES, PERMISSIONS, SYSTEM_ROLES } = require("../rbac/catalog");
const { catalogKey } = require("../rbac/cert-access");
const { USERS, GROUPS, CUSTOM_ROLES, CERT_CATALOG } = require("./data");

async function seed() {
  // The seed destroys data — never let it touch a non-dev database.
  if (process.env.AUTH_MODE !== "dev") throw new Error("Refusing to seed: AUTH_MODE must be 'dev'");
  await connectDb();

  // Usage reports and cert plans point at user ids, so they go too — otherwise they'd be orphaned by the new users.
  const models = [App, Practice, Group, GroupMembership, Permission, Role, RoleAssignment, UsageReport, User, Invitation, CertCatalogItem, CertPlan, CertFile];
  await Promise.all(models.map((M) => M.deleteMany({})));
  await App.insertMany(APPS);
  await Practice.insertMany(PRACTICES);
  await Group.insertMany(GROUPS);
  await Permission.insertMany(PERMISSIONS);
  await Role.insertMany([...SYSTEM_ROLES, ...CUSTOM_ROLES]);

  // Synthetic addresses (example.com is reserved) so email login and "is this email already on Practise360?" work in dev.
  const users = await User.insertMany(USERS.map(({ username, displayName }) => ({ username, displayName, email: `${username}@example.com` })));
  await User.syncIndexes();
  const idOf = new Map(users.map((u) => [u.username, u._id]));
  const superAdmin = idOf.get("superadmin");

  const assignments = USERS.flatMap((u) =>
    u.roles.map(([roleId, scopeType, scopeId = null]) => ({ userId: idOf.get(u.username), roleId, scopeType, scopeId, grantedBy: superAdmin })),
  );
  await RoleAssignment.insertMany(assignments);
  await RoleAssignment.syncIndexes();

  const practiceOf = new Map(GROUPS.map((g) => [g._id, g.practiceId]));
  const memberships = USERS.flatMap((u) => (u.groups || []).map((groupId) => ({ practiceId: practiceOf.get(groupId), groupId, userId: idOf.get(u.username), addedBy: superAdmin })));
  await GroupMembership.insertMany(memberships);
  await GroupMembership.syncIndexes();

  const certAdmin = idOf.get("cert.admin");
  await CertCatalogItem.insertMany(CERT_CATALOG.map((c) => ({ ...c, key: catalogKey(c.title, c.provider), createdBy: certAdmin })));
  await CertCatalogItem.syncIndexes();

  console.log(
    `Seeded ${users.length} users, ${GROUPS.length} groups, ${SYSTEM_ROLES.length + CUSTOM_ROLES.length} roles, ${assignments.length} assignments, ${memberships.length} group memberships, ${CERT_CATALOG.length} catalog entries.`,
  );
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
