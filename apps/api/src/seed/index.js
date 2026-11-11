// Dev seed (docs/rbac.md §7). Wipes and recreates every RBAC collection. Synthetic people only.
// Run: npm run seed -w api
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { App, Practice, Permission, Role, RoleAssignment, UsageReport, User } = require("../models");
const { APPS, PRACTICES, PERMISSIONS, SYSTEM_ROLES } = require("../rbac/catalog");
const { USERS, CUSTOM_ROLES } = require("./data");

async function seed() {
  // The seed destroys data — never let it touch a non-dev database.
  if (process.env.AUTH_MODE !== "dev") throw new Error("Refusing to seed: AUTH_MODE must be 'dev'");
  await connectDb();

  // Usage reports point at user ids, so they go too — otherwise they'd be orphaned by the new users.
  await Promise.all([App, Practice, Permission, Role, RoleAssignment, UsageReport, User].map((M) => M.deleteMany({})));
  await App.insertMany(APPS);
  await Practice.insertMany(PRACTICES);
  await Permission.insertMany(PERMISSIONS);
  await Role.insertMany([...SYSTEM_ROLES, ...CUSTOM_ROLES]);

  const users = await User.insertMany(USERS.map(({ username, displayName }) => ({ username, displayName })));
  const idOf = new Map(users.map((u) => [u.username, u._id]));
  const superAdmin = idOf.get("superadmin");

  const assignments = USERS.flatMap((u) =>
    u.roles.map(([roleId, scopeType, scopeId = null]) => ({ userId: idOf.get(u.username), roleId, scopeType, scopeId, grantedBy: superAdmin })),
  );
  await RoleAssignment.insertMany(assignments);
  await RoleAssignment.syncIndexes();

  console.log(`Seeded ${users.length} users, ${SYSTEM_ROLES.length + CUSTOM_ROLES.length} roles, ${assignments.length} assignments.`);
}

seed()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
