// Non-destructive: writes the catalog's permissions into the DB and inserts any missing system roles,
// without touching users, contributions, plans or reports. Run after changing src/rbac/catalog.js.
// Existing system roles keep Super Admin's portal edits, with these exceptions:
// - permissions that are new to the catalog (not yet in the DB) are added to the system roles whose defaults include
//   them — otherwise a new feature would be invisible until someone ticked every box by hand;
// - the fields admins can't edit (scope type, scopeId, assignableFrom) always follow the catalog. A role that moves to
//   another scope level (Practice Lead: practice → group) also gets its default permissions back, and assignments left
//   at the old level are removed — practice-level ones become Practitioner so nobody drops out of their practice.
// Pass --reset to restore all defaults.
// Run: npm run sync-roles -w api [-- --reset]
require("dotenv").config();
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { Permission, Role, RoleAssignment, User } = require("../models");
const { PERMISSIONS, SYSTEM_ROLES } = require("../rbac/catalog");

const FIXED = ["scopeType", "scopeId", "assignableFrom"];

async function sync() {
  await connectDb();
  const known = new Set((await Permission.find({}, "_id").lean()).map((p) => p._id));
  const added = PERMISSIONS.map((p) => p._id).filter((k) => !known.has(k));
  await Promise.all(PERMISSIONS.map((p) => Permission.updateOne({ _id: p._id }, p, { upsert: true })));
  const reset = process.argv.includes("--reset");
  const before = new Map((await Role.find({ _id: { $in: SYSTEM_ROLES.map((r) => r._id) } }).lean()).map((r) => [r._id, r]));
  const update = (r) => (reset ? r : { $setOnInsert: r });
  await Promise.all(SYSTEM_ROLES.map((r) => Role.updateOne({ _id: r._id }, update(r), { upsert: true })));

  const moved = [];
  if (!reset) {
    for (const r of SYSTEM_ROLES) {
      const old = before.get(r._id);
      if (!old || FIXED.every((k) => (old[k] ?? null) === (r[k] ?? null))) continue;
      const levelChanged = old.scopeType !== r.scopeType;
      if (levelChanged) moved.push(`${r.name}: ${old.scopeType} → ${r.scopeType}`);
      const fixed = Object.fromEntries(FIXED.map((k) => [k, r[k] ?? null]));
      await Role.updateOne({ _id: r._id }, { $set: { ...fixed, ...(levelChanged && { permissions: r.permissions }) } });
    }
  }

  if (!reset && added.length) {
    await Promise.all(
      SYSTEM_ROLES.map((r) => {
        const extra = r.permissions.filter((p) => added.includes(p));
        return extra.length ? Role.updateOne({ _id: r._id, permissions: { $ne: "*" } }, { $addToSet: { permissions: { $each: extra } } }) : null;
      }),
    );
  }

  // Assignments whose scope no longer matches their role grant nothing (rbac/load.js) — clear them out.
  const levelOf = new Map((await Role.find({}, "scopeType name").lean()).map((r) => [r._id, r]));
  const stale = (await RoleAssignment.find().lean()).filter((a) => levelOf.has(a.roleId) && levelOf.get(a.roleId).scopeType !== a.scopeType);
  const names = new Map((await User.find({ _id: { $in: stale.map((a) => a.userId) } }, "username").lean()).map((u) => [String(u._id), u.username]));
  for (const a of stale) {
    if (a.scopeType === "practice") {
      await RoleAssignment.updateOne(
        { userId: a.userId, roleId: "practitioner", scopeType: "practice", scopeId: a.scopeId },
        { $setOnInsert: { grantedBy: a.grantedBy, grantedAt: new Date() } },
        { upsert: true },
      );
    }
    await RoleAssignment.deleteOne({ _id: a._id });
  }

  console.log(`Synced ${PERMISSIONS.length} permissions (${added.length} new); ${reset ? "reset" : "inserted missing"} ${SYSTEM_ROLES.length} system roles.`);
  if (moved.length) console.log(`Moved to a new scope level (permissions reset to defaults): ${moved.join("; ")}`);
  if (stale.length) {
    console.log(`Removed ${stale.length} assignment(s) left at the old level; practice-level ones are now Practitioner. Re-appoint them where needed:`);
    for (const a of stale) console.log(`  - ${names.get(String(a.userId)) ?? a.userId}: ${levelOf.get(a.roleId).name} @ ${a.scopeType}:${a.scopeId}`);
  }
}

sync()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
