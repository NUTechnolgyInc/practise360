// Shared fixtures:
//   as(username)        → API client signed in as a seed user (dev login), for API tests and test data setup
//   loginAs(username)   → puts that user's token in the page's localStorage before any page script runs
//   pageAs(username)    → a second, independent browser page signed in as someone else (multi-user journeys)
const base = require("@playwright/test");
const { E2E } = require("../env");

const TOKEN_KEY = "p360.token"; // apps/web/lib/api.js

class ApiClient {
  constructor(request, token, username) {
    this.request = request;
    this.token = token;
    this.username = username;
  }

  headers(extra = {}) {
    return { ...(this.token ? { authorization: `Bearer ${this.token}` } : {}), ...extra };
  }

  get(path, opts = {}) {
    return this.request.get(E2E.apiUrl + path, { ...opts, headers: this.headers(opts.headers) });
  }

  post(path, data, opts = {}) {
    return this.request.post(E2E.apiUrl + path, { ...opts, data, headers: this.headers(opts.headers) });
  }

  put(path, data, opts = {}) {
    return this.request.put(E2E.apiUrl + path, { ...opts, data, headers: this.headers(opts.headers) });
  }

  patch(path, data, opts = {}) {
    return this.request.patch(E2E.apiUrl + path, { ...opts, data, headers: this.headers(opts.headers) });
  }

  delete(path, opts = {}) {
    return this.request.delete(E2E.apiUrl + path, { ...opts, headers: this.headers(opts.headers) });
  }

  /** Raw-body upload (the API reads files with express.raw, not multipart). */
  upload(method, path, buffer, contentType) {
    return this.request.fetch(E2E.apiUrl + path, { method, data: buffer, headers: this.headers({ "content-type": contentType }) });
  }

  /** GET and parse, failing the test with the API's error message if it isn't 2xx. */
  async json(path) {
    const res = await this.get(path);
    base.expect(res.ok(), `${this.username} GET ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
    return res.json();
  }

  me() {
    return this.json("/me");
  }
}

async function login(request, username) {
  const res = await request.post(`${E2E.apiUrl}/auth/login`, { data: { username, password: E2E.password } });
  base.expect(res.status(), `login as ${username}`).toBe(200);
  return (await res.json()).token;
}

const test = base.test.extend({
  as: async ({ request }, use) => {
    const tokens = new Map();
    await use(async (username) => {
      if (!username) return new ApiClient(request, null, "anonymous");
      if (!tokens.has(username)) tokens.set(username, await login(request, username));
      return new ApiClient(request, tokens.get(username), username);
    });
  },

  loginAs: async ({ page, request }, use) => {
    await use(async (username) => {
      const token = await login(request, username);
      await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [TOKEN_KEY, token]);
      return token;
    });
  },

  pageAs: async ({ browser, request }, use) => {
    const contexts = [];
    await use(async (username) => {
      const token = await login(request, username);
      const context = await browser.newContext({ baseURL: E2E.webUrl, viewport: { width: 1366, height: 900 } });
      contexts.push(context);
      await context.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [TOKEN_KEY, token]);
      return context.newPage();
    });
    await Promise.all(contexts.map((c) => c.close()));
  },
});

/** Unique, readable names so tests never collide with each other or with earlier runs. */
const unique = (label) => `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const isoDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** The previous calendar month as YYYY-MM (reports cover a finished month; the UI defaults to it). */
function previousMonth(back = 1) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
}

function monthLabel(period) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

module.exports = { test, expect: base.expect, ApiClient, TOKEN_KEY, unique, isoDay, previousMonth, monthLabel };
