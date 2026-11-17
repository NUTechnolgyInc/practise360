// Fresh, known data for every run: drop the e2e database, then run the normal dev seed into it.
const { execFileSync } = require("child_process");
const path = require("path");
const mongoose = require("mongoose");
const { E2E } = require("./env");

module.exports = async function globalSetup() {
  const dbName = new URL(E2E.mongoUri).pathname.slice(1);
  // Dropping is destructive — refuse anything that isn't clearly an e2e database.
  if (!dbName.endsWith("_e2e")) throw new Error(`Refusing to reset "${dbName}": E2E_MONGODB_URI must name a *_e2e database`);

  const conn = await mongoose.createConnection(E2E.mongoUri).asPromise();
  await conn.dropDatabase();
  await conn.close();

  execFileSync(process.execPath, [path.join(__dirname, "../apps/api/src/seed/index.js")], {
    env: { ...process.env, MONGODB_URI: E2E.mongoUri, AUTH_MODE: "dev" },
    stdio: "inherit",
  });
};
