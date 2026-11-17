// AUTH-API — dev login, token handling, user enumeration and injection attempts (CLAUDE.md → Auth, rbac.md §7).
const jwt = require("jsonwebtoken");
const { test, expect } = require("../../support/fixtures");
const { E2E } = require("../../env");
const { SEED_USER_COUNT } = require("../../support/users");

const login = (request, data, headers) => request.post(`${E2E.apiUrl}/auth/login`, { data, headers });
const me = (request, token) => request.get(`${E2E.apiUrl}/me`, { headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });

test.describe("Auth API", () => {
  test("[AUTH-API-01] valid username + password returns a JWT that opens /me", async ({ request }) => {
    const res = await login(request, { username: "de.dev1", password: "password" });
    expect(res.status()).toBe(200);
    const { token } = await res.json();
    expect(token.split(".")).toHaveLength(3);
    const profile = await (await me(request, token)).json();
    expect(profile).toMatchObject({ username: "de.dev1", displayName: "Riley Patel" });
  });

  test("[AUTH-API-02] username is case-insensitive and surrounding spaces are ignored", async ({ request }) => {
    const res = await login(request, { username: "  DE.Dev1  ", password: "password" });
    expect(res.status()).toBe(200);
  });

  test("[AUTH-API-02b] seeded users can also sign in with their email (any case)", async ({ request }) => {
    expect((await login(request, { username: "De.Dev1@Example.com", password: "password" })).status()).toBe(200);
    expect((await login(request, { username: "nobody@example.com", password: "password" })).status()).toBe(401);
  });

  test("[AUTH-API-03] wrong password is rejected with 401", async ({ request }) => {
    const res = await login(request, { username: "de.dev1", password: "wrong-password" });
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid username, email or password" });
  });

  test("[AUTH-API-04] unknown username gets the same message as a wrong password (no user enumeration)", async ({ request }) => {
    const unknown = await login(request, { username: "nobody.here", password: "password" });
    const wrong = await login(request, { username: "de.dev1", password: "nope" });
    expect(unknown.status()).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  test("[AUTH-API-05] password is case-sensitive", async ({ request }) => {
    expect((await login(request, { username: "de.dev1", password: "Password" })).status()).toBe(401);
    expect((await login(request, { username: "de.dev1", password: "PASSWORD" })).status()).toBe(401);
  });

  for (const [label, body] of [
    ["missing password", { username: "de.dev1" }],
    ["missing username", { password: "password" }],
    ["empty strings", { username: "", password: "" }],
    ["empty body", {}],
  ]) {
    test(`[AUTH-API-06] ${label} → 400`, async ({ request }) => {
      const res = await login(request, body);
      expect(res.status()).toBe(400);
      expect((await res.json()).error).toBe("Username or email and password are required");
    });
  }

  test("[AUTH-API-07] NoSQL-injection style username object does not log anyone in", async ({ request }) => {
    const res = await login(request, { username: { $ne: null }, password: "password" });
    expect(res.status()).toBe(401);
    const regex = await login(request, { username: { $regex: ".*" }, password: "password" });
    expect(regex.status()).toBe(401);
  });

  test("[AUTH-API-08] /auth/config advertises dev login and lists demo users without secrets", async ({ request }) => {
    const res = await request.get(`${E2E.apiUrl}/auth/config`);
    const body = await res.json();
    expect(body.devLogin).toBe(true);
    expect(body.google).toEqual({ enabled: false });
    expect(body.demoUsers).toHaveLength(SEED_USER_COUNT);
    expect(body.demoUsers.find((u) => u.username === "multi.user").roles).toEqual(expect.arrayContaining(["Practice Lead", "Practitioner", "AI Member"]));
    expect(JSON.stringify(body)).not.toMatch(/password"\s*:/i);
  });

  test("[AUTH-API-09] Google sign-in is a 501 stub", async ({ request }) => {
    const res = await request.post(`${E2E.apiUrl}/auth/google`);
    expect(res.status()).toBe(501);
  });

  test("[AUTH-API-10] /me without a token → 401 Not signed in", async ({ request }) => {
    const res = await me(request);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Not signed in" });
  });

  test("[AUTH-API-11] garbage token → 401", async ({ request }) => {
    const res = await me(request, "not-a-jwt");
    expect(res.status()).toBe(401);
  });

  test("[AUTH-API-12] token signed with a different secret (forged) → 401", async ({ request, as }) => {
    const { id } = await (await as("superadmin")).me();
    const forged = jwt.sign({ sub: id }, "attacker-guess", { expiresIn: "1h" });
    expect((await me(request, forged)).status()).toBe(401);
  });

  test("[AUTH-API-13] expired token → 401 Session expired", async ({ request, as }) => {
    const { id } = await (await as("de.dev1")).me();
    const expired = jwt.sign({ sub: id, exp: Math.floor(Date.now() / 1000) - 60 }, E2E.jwtSecret);
    const res = await me(request, expired);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Session expired" });
  });

  test("[AUTH-API-14] validly signed token for a user that doesn't exist → 401 Account not available", async ({ request }) => {
    const ghost = jwt.sign({ sub: "64b000000000000000000000" }, E2E.jwtSecret, { expiresIn: "1h" });
    const res = await me(request, ghost);
    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Account not available" });
  });

  test("[AUTH-API-15] alg=none token is rejected", async ({ request, as }) => {
    const { id } = await (await as("de.dev1")).me();
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: id })}.`;
    expect((await me(request, unsigned)).status()).toBe(401);
  });

  test("[AUTH-API-16] /me returns grants, visible apps and practices for a multi-role user", async ({ as }) => {
    const profile = await (await as("multi.user")).me();
    expect(profile.grants.map((g) => `${g.roleName}@${g.scopeLabel}`)).toEqual(expect.arrayContaining(["Practice Lead@QA · Manual Testing", "Practitioner@QA", "Practitioner@AI", "AI Member@AI Tracker"]));
    expect(profile.apps.map((a) => a.id).sort()).toEqual(["ai-tracker", "cert-tracker", "practices"]);
    expect(profile.practices.map((p) => p.id).sort()).toEqual(["ai", "digital-engineering", "platform", "qa"]);
  });
});
