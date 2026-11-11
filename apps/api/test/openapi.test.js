// Keeps the Swagger docs honest: every Express route must appear in the OpenAPI spec and vice versa.
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET ||= "test-only";
const app = require("../src/app");
const { buildSpec } = require("../src/openapi");

const DOC_ROUTES = new Set(["GET /openapi.json", "GET /docs"]);

/** Walks the Express router stack, joining mount paths (mounts here are plain strings). */
function expressRoutes(stack = app._router.stack, prefix = "") {
  const out = [];
  for (const layer of stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) out.push(`${method.toUpperCase()} ${(prefix + layer.route.path).replace(/\/$/, "") || "/"}`);
    } else if (layer.name === "router" && layer.handle.stack) {
      const mount = layer.regexp.source.replace(/^\^\\?/, "").replace(/\\\/\?\(\?=\\\/\|\$\)$/, "").replace(/\\\//g, "/");
      out.push(...expressRoutes(layer.handle.stack, prefix + (mount ? `/${mount.replace(/^\//, "")}` : "")));
    }
  }
  return out;
}

const specRoutes = () =>
  Object.entries(buildSpec().paths).flatMap(([path, ops]) =>
    Object.keys(ops)
      .filter((k) => k !== "parameters")
      .map((m) => `${m.toUpperCase()} ${path.replace(/\{(\w+)\}/g, ":$1")}`),
  );

test("every route is documented in the OpenAPI spec", () => {
  const documented = new Set(specRoutes());
  const missing = expressRoutes().filter((r) => !DOC_ROUTES.has(r) && !documented.has(r));
  assert.deepEqual(missing, []);
});

test("the spec documents no routes that don't exist", () => {
  const real = new Set(expressRoutes());
  assert.deepEqual(specRoutes().filter((r) => !real.has(r)), []);
});
