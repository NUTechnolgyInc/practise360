// Thin fetch wrapper for the Practise360 API. The token only identifies the user; the API enforces every permission.
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const TOKEN_KEY = "p360.token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const token = tokenStore.get();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the server. Is the API running?", 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data;
}

const authHeader = () => {
  const token = tokenStore.get();
  return token ? { authorization: `Bearer ${token}` } : {};
};

async function send(path, init) {
  try {
    return await fetch(`${BASE}${path}`, { ...init, headers: { ...authHeader(), ...init?.headers } });
  } catch {
    throw new ApiError("Can't reach the server. Is the API running?", 0);
  }
}

async function failed(res) {
  const data = await res.json().catch(() => ({}));
  return new ApiError(data.error || `Request failed (${res.status})`, res.status);
}

/** PUT a file as the raw request body (the API reads PDFs with express.raw, so no multipart parser is needed). */
export async function apiUpload(path, file, { method = "PUT" } = {}) {
  const res = await send(path, { method, headers: { "content-type": file.type || "application/octet-stream" }, body: file });
  if (!res.ok) throw await failed(res);
  return res.json();
}

/** GET binary content (e.g. a report PDF) — the token is a header, so a plain <a href> can't fetch it. */
export async function apiBlob(path) {
  const res = await send(path);
  if (!res.ok) throw await failed(res);
  return res.blob();
}
