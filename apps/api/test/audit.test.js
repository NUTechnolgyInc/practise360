// Audit log (docs/rbac.md §4 "Audit log"): every write route is named, secrets never reach an entry, outcomes are classified.
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "test-only";
const app = require("../src/app");
const { ACTIONS, describeRequest } = require("../src/lib/audit-actions");
const { buildEntry, sanitize, outcomeOf } = require("../src/lib/audit");
const { can } = require("../src/rbac/engine");
const { SYSTEM_ROLES } = require("../src/rbac/catalog");

/** Same walk as test/openapi.test.js: "METHOD /full/path" for every Express route. */
function expressRoutes(stack = app._router.stack, prefix = "") {
  const out = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) out.push([method.toUpperCase(), (prefix + layer.route.path).replace(/\/$/, "") || "/"]);
    } else if (layer.name === "router" && layer.handle.stack) {
      const mount = layer.regexp.source.replace(/^\^\\?/, "").replace(/\\\/\?\(\?=\\\/\|\$\)$/, "").replace(/\\\//g, "/");
      out.push(...expressRoutes(layer.handle.stack, prefix + (mount ? `/${mount.replace(/^\//, "")}` : "")));
    }
  }
  return out;
}
const writeRoutes = () => expressRoutes().filter(([m]) => ["POST", "PUT", "PATCH", "DELETE"].includes(m));
// A concrete URL for a pattern; param values that can't collide with a literal segment.
const sample = (pattern) => pattern.replace(/:(\w+)/g, (_, n) => `x-${n}`);

test("every write route is a named audit action, and matches its own pattern", () => {
  const unnamed = writeRoutes().filter(([method, path]) => describeRequest(method, sample(path))?.route !== path);
  assert.deepEqual(unnamed, []);
});

test("the action catalog lists no route that doesn't exist", () => {
  const real = new Set(writeRoutes().map(([m, p]) => `${m} ${p}`));
  assert.deepEqual(ACTIONS.filter((a) => !real.has(`${a.method} ${a.pattern}`)).map((a) => `${a.method} ${a.pattern}`), []);
});

test("literal segments win over params, and the query string is ignored", () => {
  assert.equal(describeRequest("POST", "/practices/qa/invites/bulk").action, "invite.send.bulk");
  assert.equal(describeRequest("DELETE", "/contributions/abc/join-requests/mine").action, "contribution.join.withdraw");
  assert.equal(describeRequest("POST", "/contributions/abc/invites/respond").action, "contribution.invite.respond");
  assert.deepEqual(describeRequest("POST", "/practices/qa/overview/files?fileName=a.pdf").params, { id: "qa" });
  assert.equal(describeRequest("GET", "/practices"), null);
  assert.equal(describeRequest("POST", "/nowhere"), null);
});

test("sanitize drops secrets and file bytes at any depth and shortens long text", () => {
  const clean = sanitize({
    username: "de.dev1",
    password: "[REDACTED]",
    credential: "[REDACTED]",
    nested: { inviteToken: "[REDACTED]", keep: 1 },
    file: Buffer.from("bytes"),
    description: "x".repeat(500),
    list: Array.from({ length: 25 }, (_, i) => i),
  });
  assert.deepEqual(Object.keys(clean).sort(), ["description", "list", "nested", "username"]);
  assert.deepEqual(clean.nested, { keep: 1 });
  assert.equal(clean.description.length, 201);
  assert.equal(clean.list.length, 21);
});

test("outcome: 2xx/3xx success, 401/403 denied, anything else failed", () => {
  assert.deepEqual([200, 201, 204, 401, 403, 400, 404, 409, 500].map(outcomeOf), ["success", "success", "success", "denied", "denied", "failed", "failed", "failed", "failed"]);
});

const req = (over) => ({ method: "POST", originalUrl: "/rbac/assignments", headers: { "user-agent": "test", "x-forwarded-for": "10.0.0.1, 10.0.0.2" }, query: {}, body: {}, ...over });
const res = (statusCode, locals = {}) => ({ statusCode, locals });

test("an entry names the signed-in actor and keeps the request's details", () => {
  const user = { id: "64f0c0ffee0000000000000a", displayName: "Riley Patel", username: "de.dev1" };
  const e = buildEntry(req({ user, body: { userId: "u2", roleId: "practitioner", scopeType: "practice", scopeId: "qa" } }), res(201, { auditBody: { id: "a1" } }));
  assert.equal(e.action, "rbac.assignment.grant");
  assert.equal(e.actorName, "Riley Patel");
  assert.equal(e.outcome, "success");
  assert.equal(e.resultId, "a1");
  assert.equal(e.ip, "10.0.0.1");
  assert.deepEqual(e.details, { userId: "u2", roleId: "practitioner", scopeType: "practice", scopeId: "qa" });
});

test("a refused request is kept with the error the caller saw", () => {
  const e = buildEntry(req({ user: { id: "u1", displayName: "A", username: "a" } }), res(403, { auditBody: { error: "Missing permission practices.roles.assign" } }));
  assert.equal(e.outcome, "denied");
  assert.equal(e.error, "Missing permission practices.roles.assign");
  assert.equal(e.resultId, null);
});

test("a failed password sign-in keeps the username but never the password", () => {
  const e = buildEntry(req({ originalUrl: "/auth/login", body: { username: "de.dev1", password: "[REDACTED]" } }), res(401, { auditBody: { error: "Invalid username, email or password" } }));
  assert.equal(e.actorId, null);
  assert.deepEqual(e.details, { username: "de.dev1" });
});

test("invitation links: the token in the URL is never stored", () => {
  const e = buildEntry(req({ originalUrl: "/invites/abc123secret/accept", body: { displayName: "Sam" } }), res(200, { auditActor: { id: "u9", displayName: "Sam", username: "sam" } }));
  assert.equal(e.route, "/invites/:token/accept");
  assert.deepEqual(e.params, {});
  assert.equal(JSON.stringify(e).includes("abc123secret"), false);
  assert.equal(e.actorName, "Sam");
});

test("a delete can name what it removed, since the target is gone afterwards", () => {
  const e = buildEntry(req({ method: "DELETE", originalUrl: "/rbac/assignments/a1", user: { id: "u1" } }), res(204, { auditDetails: { userId: "u2", roleId: "practitioner" } }));
  assert.deepEqual(e.params, { id: "a1" });
  assert.deepEqual(e.details, { userId: "u2", roleId: "practitioner" });
});

test("file uploads log the query (file name), not the bytes", () => {
  const e = buildEntry(req({ method: "PUT", originalUrl: "/ai/usage-reports/mine/2026-10?fileName=report.pdf", query: { fileName: "report.pdf" }, body: Buffer.from("%PDF") }), res(200));
  assert.deepEqual(e.details, { fileName: "report.pdf" });
  assert.deepEqual(e.params, { period: "2026-10" });
});

test("only Super Admin holds platform.audit.view by default", () => {
  const PLATFORM = { type: "platform", id: null };
  const holders = SYSTEM_ROLES.filter((r) => can({ id: "u", grants: [{ scopeType: "platform", scopeId: null, permissions: r.permissions }] }, "platform.audit.view", PLATFORM, undefined, []));
  assert.deepEqual(holders.map((r) => r._id), ["super_admin"]);
});
