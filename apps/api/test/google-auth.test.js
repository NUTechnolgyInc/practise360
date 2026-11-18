// Google sign-in: the claim checks that decide whose Google account may become a session.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.JWT_SECRET ||= "test-only";
// These POST to the real app; without this the audit log would write to whatever database .env points at.
process.env.AUDIT_LOG = "off";
const { identityFromClaims } = require("../src/lib/google-auth");

const claims = (over = {}) => ({ email: "Alex.Rivera@Example.com", email_verified: true, name: "Alex Rivera", ...over });

test("verified email is returned lower-cased with the display name", () => {
  assert.deepEqual(identityFromClaims(claims(), []), { email: "alex.rivera@example.com", name: "Alex Rivera" });
});

test("unverified or missing email is refused", () => {
  assert.ok(identityFromClaims(claims({ email_verified: false }), []).error);
  assert.ok(identityFromClaims(claims({ email_verified: "true" }), []).error, "only the boolean true counts");
  assert.ok(identityFromClaims(claims({ email: "" }), []).error);
});

test("with allowed domains, only Workspace accounts on them pass", () => {
  assert.equal(identityFromClaims(claims({ hd: "example.com" }), ["example.com"]).email, "alex.rivera@example.com");
  assert.ok(identityFromClaims(claims({ hd: "other.com" }), ["example.com"]).error);
  // A personal Google account registered with a company address has no `hd` — it must not pass.
  assert.ok(identityFromClaims(claims(), ["example.com"]).error);
});

test("without allowed domains, any verified Google account passes the claim check", () => {
  assert.equal(identityFromClaims(claims({ email: "someone@gmail.com" }), []).email, "someone@gmail.com");
});

/** POSTs to a fresh app instance with the given env, so module-level env reads see it. */
async function postGoogle(env, body) {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  const app = require("../src/app");
  const server = http.createServer(app).listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/auth/google`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
    process.env = saved;
  }
}

test("POST /auth/google is 501 when no Client ID is configured", async () => {
  // Empty, not deleted: app.js loads dotenv, which would refill a missing key from a developer's local .env.
  const res = await postGoogle({ GOOGLE_CLIENT_ID: "" }, { credential: "x" });
  assert.equal(res.status, 501);
});

test("POST /auth/google needs a credential", async () => {
  const res = await postGoogle({ GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com" }, {});
  assert.equal(res.status, 400);
});
