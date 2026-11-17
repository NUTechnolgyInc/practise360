// Where the e2e stack runs. It is a separate API + web build on its own ports and its own Mongo database,
// so a run never touches the dev DB behind localhost:3000/4000. Override with E2E_* env vars if needed.
const E2E = {
  apiUrl: process.env.E2E_API_URL || "http://localhost:4100",
  webUrl: process.env.E2E_WEB_URL || "http://localhost:3200",
  // Must end in "_e2e": global-setup drops this database before seeding.
  mongoUri: process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:27017/practise360_e2e",
  // Test-only value for the throwaway local stack (tests sign expired/forged tokens with it). Not used anywhere real.
  jwtSecret: process.env.E2E_JWT_SECRET || "e2e-local-stack-only-not-a-real-secret",
  password: "password", // dev-login password for every seeded user (AUTH_MODE=dev, docs/rbac.md §7)
};

module.exports = { E2E };
