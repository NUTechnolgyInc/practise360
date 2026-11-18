/**
 * One cached value guarded by a version token: `get()` asks for the current token (cheap) and reloads the value only
 * when the token differs from the one it was loaded under. Concurrent callers share one load, and a failed load is
 * not kept, so the next call tries again.
 *
 * The token is read *before* loading, so a value can only ever be newer than the token it's stored under — a write
 * that lands mid-load moves the token again and forces the next reload.
 */
function createVersionedCache({ readToken, load }) {
  let entry = null; // { token, promise }

  async function get() {
    const token = await readToken();
    if (entry && entry.token === token) return entry.promise;
    const promise = load();
    const mine = { token, promise };
    entry = mine;
    promise.catch(() => {
      if (entry === mine) entry = null;
    });
    return promise;
  }

  return {
    get,
    invalidate: () => {
      entry = null;
    },
  };
}

module.exports = { createVersionedCache };
