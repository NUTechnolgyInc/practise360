// The RBAC tree cache (src/rbac/load.js) must never serve a tree older than the DB's change stamp.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createVersionedCache } = require("../src/lib/versioned-cache");

function harness() {
  const state = { token: "a", loads: 0, fail: false };
  const cache = createVersionedCache({
    readToken: async () => state.token,
    load: async () => {
      state.loads += 1;
      if (state.fail) throw new Error("db down");
      return { load: state.loads };
    },
  });
  return { state, cache };
}

test("reuses the value while the token is unchanged", async () => {
  const { state, cache } = harness();
  assert.deepEqual(await cache.get(), { load: 1 });
  assert.deepEqual(await cache.get(), { load: 1 });
  assert.equal(state.loads, 1);
});

test("reloads as soon as the token changes (a write on any instance)", async () => {
  const { state, cache } = harness();
  await cache.get();
  state.token = "b";
  assert.deepEqual(await cache.get(), { load: 2 });
});

test("invalidate forces a reload even with the same token (a write on this instance)", async () => {
  const { state, cache } = harness();
  await cache.get();
  cache.invalidate();
  await cache.get();
  assert.equal(state.loads, 2);
});

test("concurrent callers share one load", async () => {
  const { state, cache } = harness();
  const [a, b] = await Promise.all([cache.get(), cache.get()]);
  assert.equal(a, b);
  assert.equal(state.loads, 1);
});

test("a failed load is not cached", async () => {
  const { state, cache } = harness();
  state.fail = true;
  await assert.rejects(cache.get());
  state.fail = false;
  assert.deepEqual(await cache.get(), { load: 2 });
});

test("tree models bump the stamp on every kind of write", () => {
  const { App, Practice, Group, GroupMembership, bumpTreeVersion } = require("../src/models");
  for (const M of [App, Practice, Group, GroupMembership]) {
    const posts = M.schema.s.hooks._posts;
    for (const op of ["save", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete", "replaceOne", "insertMany", "bulkWrite"]) {
      assert.ok(posts.get(op)?.some((h) => h.fn === bumpTreeVersion), `${M.modelName} has no post-${op} stamp bump`);
    }
  }
});
