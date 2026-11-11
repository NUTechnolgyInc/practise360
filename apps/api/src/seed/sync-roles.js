// Non-destructive: writes the catalog's permissions into the DB and inserts any missing system roles,
// without touching users, assignments or reports. Run after changing src/rbac/catalog.js.
// Existing system roles are left alone because Super Admin may have edited them in the portal;
// pass --reset to overwrite them with the catalog defaults.
// Run: npm run sync-roles -w api [-- --reset]
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { Permission, Role } = require("../models");
const { PERMISSIONS, SYSTEM_ROLES } = require("../rbac/catalog");

async function sync() {
  await connectDb();
  await Promise.all(PERMISSIONS.map((p) => Permission.updateOne({ _id: p._id }, p, { upsert: true })));
  const reset = process.argv.includes("--reset");
  const update = (r) => (reset ? r : { $setOnInsert: r });
  await Promise.all(SYSTEM_ROLES.map((r) => Role.updateOne({ _id: r._id }, update(r), { upsert: true })));
  console.log(`Synced ${PERMISSIONS.length} permissions; ${reset ? "reset" : "inserted missing"} ${SYSTEM_ROLES.length} system roles.`);
}

sync()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
