// PLAT — service health, unknown routes, body parsing, CORS and API docs.
const { test, expect } = require("../../support/fixtures");
const { E2E } = require("../../env");

test.describe("Platform & HTTP behaviour", () => {
  test("[PLAT-01] health and root endpoints respond", async ({ request }) => {
    const health = await request.get(`${E2E.apiUrl}/health`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });
    const root = await request.get(`${E2E.apiUrl}/`);
    expect(await root.json()).toEqual({ name: "practise360-api" });
  });

  test("[PLAT-02] unknown route returns a JSON 404, not an HTML error page", async ({ request }) => {
    const res = await request.get(`${E2E.apiUrl}/no/such/route`);
    expect(res.status()).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  test("[PLAT-03] malformed JSON body is rejected as a client error (400), not a server crash", async ({ request }) => {
    const res = await request.post(`${E2E.apiUrl}/auth/login`, {
      headers: { "content-type": "application/json" },
      data: '{"username": "de.dev1", "password": ',
    });
    // A truncated body is the caller's fault; a 5xx here pages on-call for nothing and hides real outages.
    expect(res.status(), `got ${res.status()} ${await res.text()}`).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body isn't valid JSON" });
  });

  test("[PLAT-04] JSON body over the 1 MB limit gets 413 with a readable message", async ({ request }) => {
    const res = await request.post(`${E2E.apiUrl}/auth/login`, {
      headers: { "content-type": "application/json" },
      data: JSON.stringify({ username: "x".repeat(1.2 * 1024 * 1024), password: "password" }),
    });
    expect(res.status()).toBe(413);
    expect((await res.json()).error).toMatch(/Too large/);
  });

  test("[PLAT-05] CORS allows the configured web origin and no other", async ({ request }) => {
    const allowed = await request.get(`${E2E.apiUrl}/health`, { headers: { origin: E2E.webUrl } });
    expect(allowed.headers()["access-control-allow-origin"]).toBe(E2E.webUrl);
    const other = await request.get(`${E2E.apiUrl}/health`, { headers: { origin: "https://evil.example" } });
    expect(other.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("[PLAT-06] OpenAPI spec and Swagger UI are served", async ({ request }) => {
    const spec = await request.get(`${E2E.apiUrl}/openapi.json`);
    expect(spec.status()).toBe(200);
    const body = await spec.json();
    expect(body.openapi).toMatch(/^3\./);
    expect(Object.keys(body.paths)).toEqual(expect.arrayContaining(["/auth/login", "/me", "/contributions"]));
    const docs = await request.get(`${E2E.apiUrl}/docs`);
    expect(docs.headers()["content-type"]).toContain("text/html");
  });
});
