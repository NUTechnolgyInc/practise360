// Empties a Practise360 database and starts it over with only the RBAC catalog and the given Super Admins.
// Used to take the demo deployment from seeded data to real people. Emails come from the command line so real
// addresses never land in the repo.
//
// Run:
//   MONGODB_URI=[REDACTED] npm run reset -w api -- \
//     --confirm <database-name> \
//     --google a@example.com,b@example.com \
//     --password admin@example.com \
//     --backup-dir /some/folder
//
// --google    Super Admins who sign in with Google only (the demo password is refused for them).
// --password  Super Admins who may also use the demo password login (AUTH_MODE=dev).
// --confirm   Must equal the database name in MONGODB_URI — a guard against wiping the wrong one.
// Every collection is written to <backup-dir>/<db>-<timestamp>.json (Extended JSON) before anything is deleted.
require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const { connectDb } = require("../db");
const { App, Practice, Permission, Role, RoleAssignment, User } = require("../models");
const { APPS, PRACTICES, PERMISSIONS, SYSTEM_ROLES } = require("../rbac/catalog");
const { usernameBase, displayNameFromEmail } = require("../lib/invites");

const EMAIL = /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`Unexpected argument "${argv[i]}"`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  const emails = (v) =>
    String(v || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  const google = emails(out.google);
  const password = emails(out.password);
  const bad = [...google, ...password].filter((e) => !EMAIL.test(e));
  if (bad.length) throw new Error(`Not an email: ${bad.join(", ")}`);
  if (!google.length && !password.length) throw new Error("Give at least one Super Admin with --google or --password");
  if (!out.confirm) throw new Error("--confirm <database-name> is required");
  if (!out["backup-dir"]) throw new Error("--backup-dir is required");
  return { google, password, confirm: out.confirm, backupDir: out["backup-dir"] };
}

async function backup(db, dir) {
  const { EJSON } = mongoose.mongo.BSON;
  const collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const dump = {};
  for (const name of collections) dump[name] = await db.collection(name).find().toArray();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${db.databaseName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, EJSON.stringify(dump, null, 1, { relaxed: false }));
  return { file, counts: Object.fromEntries(collections.map((n) => [n, dump[n].length])) };
}

async function reset() {
  const args = parseArgs(process.argv.slice(2));
  await connectDb();
  const db = mongoose.connection.db;
  if (db.databaseName !== args.confirm) throw new Error(`--confirm "${args.confirm}" does not match the database "${db.databaseName}"`);

  const { file, counts } = await backup(db, args.backupDir);
  console.log(`Backed up ${db.databaseName} to ${file}`);
  console.log(counts);

  // deleteMany, not drop: keeps the collections' indexes (unique email, single-holder roles…) in place.
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  for (const name of names) await db.collection(name).deleteMany({});

  // The catalog is what makes the apps work at all; the four default practices come from docs/rbac.md, empty.
  await App.insertMany(APPS);
  await Practice.insertMany(PRACTICES);
  await Permission.insertMany(PERMISSIONS);
  await Role.insertMany(SYSTEM_ROLES);

  const people = [...args.google.map((email) => ({ email, googleOnly: true })), ...args.password.map((email) => ({ email, googleOnly: false }))];
  const taken = new Set();
  const users = await User.insertMany(
    people.map(({ email, googleOnly }) => {
      let username = usernameBase(email);
      for (let n = 2; taken.has(username); n++) username = `${usernameBase(email)}-${n}`;
      taken.add(username);
      return { username, displayName: displayNameFromEmail(email), email, googleOnly };
    }),
  );
  await RoleAssignment.insertMany(users.map((u) => ({ userId: u._id, roleId: "super_admin", scopeType: "platform", scopeId: null, grantedBy: users[0]._id })));
  await Promise.all([User.syncIndexes(), RoleAssignment.syncIndexes()]);

  console.log(`Reset ${db.databaseName}: ${users.length} Super Admins`);
  for (const u of users) console.log(`  ${u.email}  (${u.googleOnly ? "Google only" : "Google or demo password"})`);
}

reset()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
